"""Admin Telegram bot (CLAUDE.md §6.5, §7). Thin layer: business logic lives in
app.agents.{publisher,orders,content}. Only TELEGRAM_ADMIN_IDS can use it.

Run:  uv run --env-file .env python -m app.bot.admin_bot
"""
import asyncio
import logging
import os
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from aiogram import Bot, Dispatcher, F, Router
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from aiogram.filters import Command, CommandObject
from aiogram.types import (BufferedInputFile, CallbackQuery, FSInputFile, InlineKeyboardButton, InlineKeyboardMarkup,
                           InputMediaDocument, InputMediaPhoto, Message)
import pillow_heif
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app import config
from app.agents import orders, publisher, screens, sourcing
from app.agents.content import ContentError, own_photos, photo_dir
from app.config import TZ
from app.db.models import Order, Post, Product
from app.llm import Llm, spent_usd
from app.pricing import rates
from app.reports import prices as price_report
from app.reports import weekly
from app.uz import format_uzs

log = logging.getLogger(__name__)
pillow_heif.register_heif_opener()  # iPhone photos sent as files are HEIC
PHOTO_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")

HELP = """Buyruqlar:
/today — bugungi holat
/summary — kunlik xulosa (avto rejimda har kuni kechqurun keladi)
/drafts — hozir draft tayyorlash
/publish — navbatdagi postni hozir nashr qilish
/orders — ochiq buyurtmalar
/neworder <post_id> <oʻlcham> <ism> <telefon|@username> [ext=<USD>] [novac]
/lead <post_id> [oʻlcham] — DMda narx soʻrashdi
/stockcost <SKU> <summa> [oʻlcham]
/buyprice <buyurtma_id> <yuan> — haqiqiy xarid narxi, foyda qayta hisoblanadi
/allow <SKU> — narxi past deb rad etilgan tovarni baribir qoʻshish
/prices [kun] — brendlar boʻyicha haqiqiy narxlar (min_price chegaralarini tuzatish uchun)
/problem <buyurtma_id> <oʻlcham|kechikish|nuqson|boshqa> [izoh]
/report — shu hafta hisoboti + Excel; /report otgan — oʻtgan hafta
/trend <matn>
/rate — CBU kurslari
/expense <summa> <reklama|ai|server|menejer|boshqa> <izoh>
/pause, /resume — avtomatik ishni (yuklash, draft, nashr) toʻxtatish/yoqish
/cancel — tahrirlashni bekor qilish
Yangi tovar: ilovadan mahsulot sahifasining 1–3 ta skrinshotini izohsiz yuboring, xohlasangiz bir albomda
ilovadan «Save image» qilingan rasm bilan (kartochkaga oʻsha ishlatiladi). Havolani izohga yozish mumkin.
Narxni yangilash: shu tovarning skrinshotini qayta yuboring.
Tovar surati: SKUni izohga yozib yuboring (yaxshisi fayl sifatida), bitta SKUga 10 tagacha."""

LINK_REPLY = ("🔗 Havoladan oʻqib boʻlmaydi: poizon.com bot'ga nom, narx va oʻlchamlarni bermaydi. "
              "Ilovadan mahsulot sahifasining 1–3 ta skrinshotini yuboring (nom, SKU, narx, oʻlchamlar, "
              "sotilgan soni koʻrinsin). Havolani skrinshot izohiga yozsangiz, manba sifatida saqlanadi.")


@dataclass
class Ctx:
    factory: sessionmaker
    admin_ids: set[int]
    channel_id: str | None
    llm: Llm | None = None
    alerts: list[str] = field(default_factory=list)
    pending_edit: dict[int, int] = field(default_factory=dict)          # admin -> post_id
    pending_orders: dict[str, tuple[orders.NewOrderRequest, int]] = field(default_factory=dict)  # token -> (req, shown price)
    album_sku: dict[str, str] = field(default_factory=dict)            # media_group_id -> SKU
    album_url: dict[str, str] = field(default_factory=dict)            # media_group_id -> link from caption
    screen_groups: dict[str, list[Path]] = field(default_factory=dict) # album being collected
    pending_screens: dict[str, tuple[list[Path], dict, str | None]] = field(default_factory=dict)  # token -> (paths, data, url)
    pending_fix: dict[int, str] = field(default_factory=dict)          # admin -> screen token
    awaiting_sizes: dict[int, str] = field(default_factory=dict)       # admin -> screen token missing sizes


def now() -> datetime:
    return datetime.now(TZ)


def fx_now(at: datetime) -> tuple[dict | None, list[str]]:
    try:
        fx = {"USD": rates.rate("USD", at), "CNY": rates.rate("CNY", at)}
    except rates.RateUnavailable as e:
        return None, [str(e)]
    return fx, [r.warning for r in fx.values() if r.warning]


def kb(rows: list[list[tuple[str, str]]]) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=t, callback_data=d) for t, d in row]
                                                 for row in rows])


def post_kb(post_id: int) -> InlineKeyboardMarkup:
    return kb([[("✅ Tasdiqlash", f"post:approve:{post_id}"), ("✏️ Tahrirlash", f"post:edit:{post_id}")],
               [("❌ Rad etish", f"post:reject:{post_id}"), ("🔄 Narxni yangilash", f"post:refresh:{post_id}")]])


def order_kb(o: Order) -> InlineKeyboardMarkup | None:
    acts = orders.next_actions(o)
    return kb([[(label, f"ord:{a}:{o.id}")] for a, label in acts]) if acts else None


# --- sync helpers (run in a thread; testable without Telegram) ----------------------

@dataclass
class PostView:
    id: int
    status: str
    caption: str
    images: list[str]
    summary: str


def post_view(s: Session, post: Post) -> PostView:
    return PostView(post.id, post.status, post.caption_uz or "", list(post.image_paths or []),
                    publisher.admin_summary(s, post))


def today_text(s: Session, at: datetime) -> str:
    day_start = publisher._day_start_utc(at)
    count = lambda *w: s.scalar(select(func.count(Post.id)).where(*w))
    return "\n".join([
        f"📊 {at:%d.%m.%Y}" + (" · ⏸ PAUZA" if publisher.is_paused(s) else ""),
        f"Draftlar (bugun): {count(Post.created_at >= day_start)}",
        f"Tasdiqlash kutilmoqda: {count(Post.status == 'draft')}",
        f"Nashr navbatida: {count(Post.status == 'approved')}",
        f"Bugun nashr qilindi: {count(Post.published_at >= day_start)}",
        f"Ochiq buyurtmalar: {len(orders.open_orders(s))}",
        f"LLM xarajati bugun: ${spent_usd(s, at.date()):.2f}",
        f"Rejim: {'DRY_RUN (kanalga chiqmaydi)' if config.dry_run() else 'jonli'}",
    ])


def rate_text(at: datetime) -> str:
    lines = []
    for ccy in ("USD", "CNY"):
        try:
            r = rates.rate(ccy, at)
            lines.append(f"{ccy}: {r.value} soʻm (CBU, {r.fetched_at.astimezone(TZ):%d.%m %H:%M})"
                         + (f"\n⚠️ {r.warning}" if r.warning else ""))
        except rates.RateUnavailable as e:
            lines.append(f"{ccy}: ❌ {e}")
    buf = config.settings()["pricing"]["usd_rate_buffer_pct"]
    return "\n".join(lines) + f"\nNarxlarda USD buferi: +{buf:.1%}"


def caption_url(caption: str | None) -> str | None:
    return next((w for w in (caption or "").split() if w.startswith(("http://", "https://"))), None)


def resolve_sku(caption: str | None, media_group_id: str | None, album_sku: dict[str, str]) -> str | None:
    """SKU from the caption; in an album only the first photo has it. A link is not a SKU."""
    sku = (caption or "").strip().split()[0] if (caption or "").strip() and not caption_url(caption) else None
    if media_group_id:
        if sku:
            album_sku[media_group_id] = sku
        else:
            sku = album_sku.get(media_group_id)
    return sku


def photo_target(s: Session, sku: str, ext: str, unique: str) -> tuple[Path | None, str]:
    """(path to save to, error). Checks the SKU exists and the per-SKU limit."""
    product = s.scalar(select(Product).where(Product.style_code == sku))
    if product is None:
        return None, f"SKU {sku} bazada yoʻq. Avval jadvalni yuklang."
    limit = config.settings()["publishing"]["photos_max_per_sku"]
    if len(own_photos(product)) >= limit:
        return None, f"{sku}: {limit} ta surat limiti toʻldi."
    d = photo_dir(product)
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{datetime.now(timezone.utc):%Y%m%d%H%M%S}_{unique}{ext}", ""


def check_image(path: Path) -> Path | None:
    """Verifies the file is an image; HEIC is converted to JPEG (renderer/Telegram need it).
    Returns the final path, or None (file deleted) if it is not a readable image."""
    try:
        with Image.open(path) as im:
            im.verify()
        if path.suffix.lower() in (".heic", ".heif"):
            with Image.open(path) as im:
                jpg = path.with_suffix(".jpg")
                im.convert("RGB").save(jpg, "JPEG", quality=95)
            path.unlink()
            return jpg
        return path
    except Exception as e:
        log.info("photo rejected, not an image: %s (%r)", path.name, e)
        path.unlink(missing_ok=True)
        return None


# --- Telegram sending ----------------------------------------------------------------

class Tg:
    def __init__(self, bot: Bot, ctx: Ctx):
        self.bot, self.ctx = bot, ctx

    async def admins(self, text: str, markup=None) -> None:
        for chunk in [text[i:i + 4000] for i in range(0, len(text), 4000)] or [""]:
            for admin in self.ctx.admin_ids:
                await self.bot.send_message(admin, chunk, reply_markup=markup)

    async def album(self, chat_id, paths: list[str], caption: str | None = None) -> int | None:
        media = [InputMediaPhoto(media=FSInputFile(p), caption=caption if i == 0 else None)
                 for i, p in enumerate(paths[:10])]
        msgs = await self.bot.send_media_group(chat_id, media)
        return msgs[0].message_id if msgs else None

    async def flush_alerts(self) -> None:
        while self.ctx.alerts:
            await self.admins("🔔 " + self.ctx.alerts.pop(0))

    async def draft(self, v: PostView, notes: list[str] = ()) -> None:
        for admin in self.ctx.admin_ids:
            await self.album(admin, v.images[:-1] or v.images, v.caption)
            await self.bot.send_message(admin, v.summary, reply_markup=post_kb(v.id) if v.status == "draft" else None)
        if notes:
            await self.admins("\n".join("• " + n for n in notes))

    async def instagram_package(self, v: PostView) -> None:
        """Uncompressed PNGs as files + caption text, for manual Instagram posting."""
        for admin in self.ctx.admin_ids:
            await self.bot.send_media_group(admin, [InputMediaDocument(media=FSInputFile(p)) for p in v.images[:10]])
            await self.bot.send_message(admin, f"📸 Instagram paket, post #{v.id}:\n\n{v.caption}")


# --- jobs (also called by the scheduler) -----------------------------------------------

def auto() -> bool:
    return config.settings()["auto_publish"]


async def job_import(ctx: Ctx, tg: Tg) -> None:
    """Daily manual_sheet import from settings.sheet_url. Failures go to the daily summary."""
    def run():
        with ctx.factory() as s:
            if publisher.is_paused(s):
                return
            try:
                report = sourcing.import_daily(s)
            except sourcing.SheetError as e:
                s.rollback()
                publisher.note_problem(s, f"Jadval yuklanmadi: {e}", now())
                s.commit()
                return
            if report and (report.rejected or report.row_errors):
                publisher.note_problem(s, report.text(), now())
                s.commit()
    await asyncio.to_thread(run)


async def job_daily_drafts(ctx: Ctx, tg: Tg, manual: bool = False) -> None:
    def run():
        at = now()
        fx, warns = fx_now(at)
        with ctx.factory() as s:
            if fx is None:
                if auto():
                    publisher.note_problem(s, "Draftlar tayyorlanmadi: " + "; ".join(warns), at)
                    s.commit()
                return [], warns
            res = publisher.make_daily_drafts(s, ctx.llm, fx, at)
            views = [post_view(s, d.post) for d in res.drafts]
            return views, warns + res.notes + [f"❌ {e}" for e in res.errors]
    views, notes = await asyncio.to_thread(run)
    if manual or not auto():  # scheduled auto run: everything goes into the daily summary
        for v in views:
            await tg.draft(v)
        if notes:
            await tg.admins("\n".join("• " + n for n in notes))
    await tg.flush_alerts()  # LLM budget etc.: always at once


async def job_summary(ctx: Ctx, tg: Tg) -> None:
    await tg.admins(await asyncio.to_thread(lambda: summary_text(ctx)))


def report_files(ctx: Ctx, previous: bool) -> tuple[str, bytes, str]:
    """(text, xlsx bytes, file name) for this week so far or last full week."""
    at = now()
    start, end = (weekly.last_week if previous else weekly.this_week)(at)
    fx, _ = fx_now(at)
    usd = fx["USD"].value if fx else None
    with ctx.factory() as s:
        if usd is None:  # no CBU rate: AI spend is not rolled up, everything else still works
            from decimal import Decimal
            usd = Decimal(0)
        rep = weekly.build(s, start, end, usd)
        s.commit()
        name = f"hisobot_{start:%Y%m%d}_{end:%Y%m%d}.xlsx"
        path = weekly.excel(rep, config.DATA_DIR / "reports" / name)
        return weekly.text(rep), path.read_bytes(), name


async def job_weekly(ctx: Ctx, tg: Tg) -> None:
    text, data, name = await asyncio.to_thread(report_files, ctx, True)
    await tg.admins(text)
    for admin in ctx.admin_ids:
        await tg.bot.send_document(admin, BufferedInputFile(data, name))


def summary_text(ctx: Ctx) -> str:
    with ctx.factory() as s:
        return publisher.daily_summary(s, now())


async def job_publish(ctx: Ctx, tg: Tg, manual: bool = False) -> bool:
    """Publishes the next approved post. Returns False if there was nothing to publish."""
    def prepare():
        at = now()
        with ctx.factory() as s:
            post = publisher.next_to_publish(s)
            if post is None:
                return None, None, []
            fx, warns = fx_now(at)
            if fx is None:
                return None, f"Post #{post.id} nashr qilinmadi: " + "; ".join(warns), []
            out = publisher.prepare_publish(s, post, fx, at)
            s.commit()
            return (post_view(s, post) if out.ok else None), (None if out.ok else out.message), warns + out.notes
    view, error, notes = await asyncio.to_thread(prepare)
    if error and (manual or not auto()):  # scheduled auto run: recorded for the daily summary
        await tg.admins("⚠️ " + error)
    if view is None:
        return error is not None
    cards = view.images[:-1]  # the story image is for Instagram only
    if config.dry_run() or not ctx.channel_id:
        await tg.admins(f"[DRY_RUN] Kanalga shu chiqardi (post #{view.id}):")
        for admin in ctx.admin_ids:
            await tg.album(admin, cards, view.caption)
        message_id = None
    else:
        message_id = await tg.album(ctx.channel_id, cards, view.caption)

    def done():
        with ctx.factory() as s:
            publisher.mark_published(s, s.get(Post, view.id), message_id, now())
            s.commit()
    await asyncio.to_thread(done)
    if notes and (manual or not auto()):
        await tg.admins("\n".join("• " + n for n in notes))
    return True


def schedule(ctx: Ctx, tg: Tg) -> AsyncIOScheduler:
    """All times Asia/Tashkent (settings.schedule). /pause is checked inside each job."""
    sc = config.settings()["schedule"]
    sched = AsyncIOScheduler(timezone=TZ)

    def at(hhmm: str) -> CronTrigger:
        h, m = hhmm.split(":")
        return CronTrigger(hour=int(h), minute=int(m), timezone=TZ)
    sched.add_job(job_import, at(sc["import_time"]), args=(ctx, tg), id="import", misfire_grace_time=3600)
    sched.add_job(job_daily_drafts, at(sc["draft_time"]), args=(ctx, tg), id="drafts", misfire_grace_time=3600)
    for i, hhmm in enumerate(sc["publish_times"]):
        sched.add_job(job_publish, at(hhmm), args=(ctx, tg), id=f"publish{i}", misfire_grace_time=1800)
    sched.add_job(job_summary, at(sc["summary_time"]), args=(ctx, tg), id="summary", misfire_grace_time=3600)
    day, hhmm = sc["weekly_report"].split()
    h, m = hhmm.split(":")
    sched.add_job(job_weekly, CronTrigger(day_of_week=day, hour=int(h), minute=int(m), timezone=TZ),
                  args=(ctx, tg), id="weekly", misfire_grace_time=6 * 3600)
    return sched


# --- handlers ------------------------------------------------------------------------

def create_router(ctx: Ctx, tg: Tg) -> Router:
    r = Router()
    is_admin = F.from_user.id.in_(ctx.admin_ids)
    r.message.filter(is_admin)
    r.callback_query.filter(is_admin)

    def db(fn):
        """Run fn(session) in a thread, commit on success."""
        def run():
            with ctx.factory() as s:
                out = fn(s)
                s.commit()
                return out
        return asyncio.to_thread(run)

    async def safe(message: Message, fn):
        try:
            await message.answer(await db(fn))
        except (orders.OrderError, ContentError) as e:
            await message.answer(f"❌ {e}")

    @r.message(Command("start", "help"))
    async def help_(m: Message):
        await m.answer(HELP)

    @r.message(Command("today"))
    async def today(m: Message):
        await m.answer(await db(lambda s: today_text(s, now())))

    @r.message(Command("summary"))
    async def summary(m: Message):
        await m.answer(await asyncio.to_thread(lambda: summary_text(ctx)))

    @r.message(Command("rate"))
    async def rate(m: Message):
        await m.answer(await asyncio.to_thread(rate_text, now()))

    @r.message(Command("pause"))
    async def pause(m: Message):
        await db(lambda s: publisher.set_paused(s, True))
        await m.answer("⏸ Avtomatik ish (yuklash, draft, nashr) toʻxtatildi. Kunlik xulosa keladi. /resume — davom ettirish.")

    @r.message(Command("resume"))
    async def resume(m: Message):
        await db(lambda s: publisher.set_paused(s, False))
        await m.answer("▶️ Davom etamiz.")

    @r.message(Command("drafts"))
    async def drafts(m: Message):
        await m.answer("⏳ Draftlar tayyorlanmoqda…")
        await job_daily_drafts(ctx, tg, manual=True)

    @r.message(Command("publish"))
    async def publish(m: Message):
        if not await job_publish(ctx, tg, manual=True):
            await m.answer("Nashr navbati boʻsh (yoki pauza yoqilgan).")

    @r.message(Command("trend"))
    async def trend(m: Message, command: CommandObject):
        await safe(m, lambda s: f"📝 Yozib qoʻyildi: {orders.add_trend(s, command.args, m.from_user.id).text}")

    @r.message(Command("expense"))
    async def expense(m: Message, command: CommandObject):
        await safe(m, lambda s: (lambda e: f"💸 Xarajat: {format_uzs(e.amount_uzs)} · {e.type}")(
            orders.add_expense(s, command.args, now().date())))

    @r.message(Command("lead"))
    async def lead(m: Message, command: CommandObject):
        await safe(m, lambda s: f"👀 Lead #{orders.add_lead(s, command.args).id} yozildi.")

    @r.message(Command("stockcost"))
    async def stockcost(m: Message, command: CommandObject):
        await safe(m, lambda s: "📦 " + orders.set_stock_cost(s, command.args))

    @r.message(Command("cancel"))
    async def cancel(m: Message):
        ctx.pending_edit.pop(m.from_user.id, None)
        await m.answer("Bekor qilindi.")

    @r.message(Command("orders"))
    async def open_orders(m: Message):
        items = await db(lambda s: [(orders.order_text(s, o), order_kb(o)) for o in orders.open_orders(s)[:20]])
        if not items:
            await m.answer("Ochiq buyurtma yoʻq.")
        for text, markup in items:
            await m.answer(text, reply_markup=markup)

    # /neworder: preview -> confirm (price is re-checked at confirm time)
    async def show_preview(m: Message, req: orders.NewOrderRequest):
        def run(s):  # build the text inside the session: ORM objects are detached afterwards
            fx, _ = fx_now(now())
            pv = orders.preview_order(s, req, fx, now())
            return pv.text(), pv.price_uzs
        try:
            text, price = await db(run)
        except orders.OrderError as e:
            await m.answer(f"❌ {e}")
            return
        token = secrets.token_hex(6)
        ctx.pending_orders[token] = (req, price)
        await m.answer(text, reply_markup=kb([[("✅ Yaratish", f"no:ok:{token}"), ("❌ Bekor", f"no:no:{token}")]]))

    @r.message(Command("neworder"))
    async def neworder(m: Message, command: CommandObject):
        try:
            req = orders.parse_neworder(command.args)
        except orders.OrderError as e:
            await m.answer(f"❌ {e}")
            return
        await show_preview(m, req)

    @r.callback_query(F.data.startswith("no:"))
    async def neworder_confirm(call: CallbackQuery):
        _, action, token = call.data.split(":")
        pending = ctx.pending_orders.pop(token, None)
        await call.answer()
        if pending is None or action == "no":
            await call.message.edit_reply_markup(reply_markup=None)
            await call.message.answer("Bekor qilindi." if pending else "Bu soʻrov eskirgan, /neworder ni qayta yuboring.")
            return
        req, shown_price = pending

        def run(s):
            fx, _ = fx_now(now())
            pv = orders.preview_order(s, req, fx, now())
            if pv.price_uzs != shown_price:
                return None
            o = orders.create_order(s, pv, now())
            return orders.order_text(s, o), order_kb(o)
        try:
            created = await db(run)
        except orders.OrderError as e:
            await call.message.answer(f"❌ {e}")
            return
        await call.message.edit_reply_markup(reply_markup=None)
        if created is None:
            await call.message.answer("⚠️ Narx oʻzgardi, qayta tasdiqlang:")
            await show_preview(call.message, req)
            return
        await call.message.answer("✅ Buyurtma yaratildi. Toʻlov rekvizitlarini mijozga siz yuborasiz.\n\n"
                                  + created[0], reply_markup=created[1])

    @r.callback_query(F.data.startswith("ord:"))
    async def order_action(call: CallbackQuery):
        _, action, oid = call.data.split(":")
        await call.answer()

        def run(s):
            o = s.get(Order, int(oid))
            return orders.apply_action(s, o, action, now()), order_kb(o)
        try:
            text, markup = await db(run)
        except orders.OrderError as e:
            await call.message.answer(f"❌ {e}")
            return
        await call.message.edit_text(text, reply_markup=markup)

    @r.callback_query(F.data.startswith("post:"))
    async def post_action(call: CallbackQuery):
        _, action, pid = call.data.split(":")
        post_id = int(pid)
        await call.answer()
        if action == "edit":
            ctx.pending_edit[call.from_user.id] = post_id
            await call.message.answer(f"Post #{post_id} uchun yangi tavsif matnini yuboring. Narx, oʻlcham va "
                                      "shartlar avtomatik qoʻshiladi. Bekor qilish: /cancel")
            return

        def run(s):
            at = now()
            fx, warns = fx_now(at)
            if fx is None and action in ("approve", "refresh"):
                return publisher.Outcome(False, "; ".join(warns)), None
            if action == "approve":
                out = publisher.approve(s, post_id, call.from_user.id, fx, at)
            elif action == "reject":
                out = publisher.reject(s, post_id)
            else:
                out = publisher.refresh_price(s, post_id, fx, at)
            out.notes = warns + out.notes
            return out, post_view(s, s.get(Post, post_id))
        try:
            out, view = await db(run)
        except ContentError as e:
            await call.message.answer(f"❌ {e}")
            return
        await call.message.edit_reply_markup(reply_markup=None)
        await call.message.answer(("✅ " if out.ok else "⚠️ ") + out.message)
        if view and view.status == "approved":
            await tg.instagram_package(view)
        elif view and view.status == "draft" and action != "reject":
            await tg.draft(view, out.notes)

    @r.message(F.photo | F.document)
    async def media(m: Message):
        if m.document and not (m.document.mime_type or "").startswith("image/"):
            await m.answer("Faqat rasm fayllari (JPG/PNG/WEBP) qabul qilinadi.")
            return
        url = caption_url(m.caption)
        if url and m.media_group_id:
            ctx.album_url[m.media_group_id] = url
        sku = resolve_sku(m.caption, m.media_group_id, ctx.album_sku)
        for _ in range(15):  # album items are handled in parallel; wait for the captioned one
            if sku or not m.media_group_id or url or m.media_group_id in ctx.album_url:
                break
            await asyncio.sleep(0.2)
            sku = ctx.album_sku.get(m.media_group_id)
        kind = f"document {m.document.mime_type}" if m.document else "photo"
        if m.document:  # sent as a file: original quality
            file_id, unique = m.document.file_id, m.document.file_unique_id
            ext = Path(m.document.file_name or "").suffix.lower() or "." + m.document.mime_type.split("/")[-1]
        else:           # compressed by Telegram: take the largest size
            file_id, unique, ext = m.photo[-1].file_id, m.photo[-1].file_unique_id, ".jpg"
        if not sku:     # no SKU: app screenshots of a new product (or a price update)
            await screenshot(m, file_id, unique, ext)
            return
        if ext not in PHOTO_EXTS:
            log.info("photo rejected: format %s (%s) sku=%s", ext, kind, sku)
            await m.answer(f"{ext} format qabul qilinmaydi — JPG/PNG/WEBP/HEIC yuboring.")
            return
        target, error = await db(lambda s: photo_target(s, sku, ext, unique))
        if error:
            log.info("photo rejected: %s", error)
            await m.answer(f"❌ {error}")
            return
        try:
            await m.bot.download(file_id, destination=target)
        except Exception as e:  # e.g. Bot API limit: files over 20 MB can't be downloaded
            log.warning("photo download failed sku=%s: %r", sku, e)
            await m.answer("❌ Rasm yuklab olinmadi (Telegram bot 20 MB dan katta faylni ololmaydi).")
            return
        if await asyncio.to_thread(check_image, target) is None:
            await m.answer("❌ Fayl rasm sifatida ochilmadi. JPG/PNG/WEBP/HEIC yuboring.")
            return
        log.info("photo saved sku=%s (%s)", sku, kind)
        count = await db(lambda s: len(own_photos(s.scalar(select(Product).where(Product.style_code == sku)))))
        with Image.open(target if target.exists() else target.with_suffix(".jpg")) as im:
            small = max(im.size) < config.settings()["images"]["min_side_px"]
            size = im.size
        await m.answer(f"✓ {sku}: surat saqlandi ({count}/{config.settings()['publishing']['photos_max_per_sku']})"
                       + (f"\n⚠️ {screens.LOW_QUALITY.format(w=size[0], h=size[1])}" if small else
                          "" if m.document else ". Maslahat: sifat uchun fayl sifatida yuboring."))

    async def screenshot(m: Message, file_id: str, unique: str, ext: str):
        gid = m.media_group_id or f"single{m.message_id}"
        if ext not in PHOTO_EXTS:
            await m.answer(f"{ext} format qabul qilinmaydi — JPG/PNG/WEBP/HEIC yuboring.")
            return
        target = config.DATA_DIR / "screens" / gid / f"{unique}{ext}"
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            await m.bot.download(file_id, destination=target)
        except Exception as e:
            log.warning("screenshot download failed: %r", e)
            await m.answer("❌ Skrinshot yuklab olinmadi.")
            return
        path = await asyncio.to_thread(check_image, target)
        if path is None:
            await m.answer("❌ Fayl rasm sifatida ochilmadi.")
            return
        group = ctx.screen_groups.setdefault(gid, [])
        group.append(path)
        if len(group) > 1:
            return          # the first item of the album processes the whole group
        seen = 0
        while seen != len(group):  # let the rest of the album arrive: wait until it stops growing
            seen = len(group)
            await asyncio.sleep(1.5)
        paths = ctx.screen_groups.pop(gid)
        url = ctx.album_url.pop(gid, None) or caption_url(m.caption)
        previous = None
        token = ctx.awaiting_sizes.pop(m.from_user.id, None)
        if token in ctx.pending_screens:  # the size-picker screenshot for the product shown before
            old_paths, previous, old_url = ctx.pending_screens.pop(token)
            paths, url = old_paths + paths, url or old_url
        if len(paths) > screens.MAX_IMAGES:
            await m.answer(f"Faqat birinchi {screens.MAX_IMAGES} ta rasm oʻqiladi ({len(paths)} ta keldi).")
        await read_and_preview(m, paths[:screens.MAX_IMAGES], url, previous,
                               "Added the size picker screenshot: read the sizes and prices from it." if previous else None)

    async def read_and_preview(m: Message, paths: list[Path], url: str | None,
                               previous: dict | None = None, correction: str | None = None):
        await m.answer("🔎 Skrinshot oʻqilmoqda…")
        try:
            data = await asyncio.to_thread(screens.read_screens, ctx.llm, paths, now(), previous, correction)
        except Exception as e:  # LLM error, budget, unreadable answer
            log.warning("screens read failed: %r", e)
            await m.answer(f"❌ {e}")
            await tg.flush_alerts()
            return
        token = secrets.token_hex(6)
        ctx.pending_screens[token] = (paths, data, url)
        crops, warns = await asyncio.to_thread(screens.card_photos, paths, data,
                                               config.DATA_DIR / "screens" / "preview", token)
        if crops:
            await m.answer_media_group([InputMediaPhoto(media=FSInputFile(c), caption="Kartochka uchun rasm" if i == 0 else None)
                                        for i, c in enumerate(crops[:10])])
        errs = screens.problems(data)
        if errs == [screens.ASK_SIZES]:
            ctx.awaiting_sizes[m.from_user.id] = token  # next screenshot is added to this product
        first = ([("✅ Toʻgʻri", f"scr:ok:{token}")] if not errs else
                 [("➕ Baribir qoʻshish", f"scr:force:{token}")] if screens.only_too_cheap(errs) else [])
        row = first + [("✏️ Tuzatish", f"scr:fix:{token}"), ("❌ Bekor", f"scr:no:{token}")]
        await m.answer(screens.preview_text(data, warns), reply_markup=kb([row]))

    @r.callback_query(F.data.startswith("scr:"))
    async def screen_action(call: CallbackQuery):
        _, action, token = call.data.split(":")
        await call.answer()
        await call.message.edit_reply_markup(reply_markup=None)
        if token not in ctx.pending_screens:
            await call.message.answer("Bu soʻrov eskirgan — skrinshotlarni qayta yuboring.")
            return
        if action == "fix":
            ctx.pending_fix[call.from_user.id] = token
            await call.message.answer("Nimani tuzatish kerak? Yozing, masalan: «SKU MR530SG», «42 oʻlcham narxi 509», "
                                      "«US 9 = EU 42.5», «kategoriya hoodie».")
            return
        paths, data, url = ctx.pending_screens.pop(token)
        ctx.awaiting_sizes.pop(call.from_user.id, None)
        if action == "no":
            await call.message.answer("Bekor qilindi.")
            return
        if action == "force" and not screens.only_too_cheap(screens.problems(data)):
            await call.message.answer("❌ Bu tovarni qoʻshib boʻlmaydi.")  # knock-off / replica: never
            return
        _, msg = await db(lambda s: screens.save(s, data, paths, url, force_cheap=action == "force"))
        log.info("screens saved: %s", screens.style_code(data))
        await call.message.answer(msg)

    @r.message(Command("allow"))
    async def allow(m: Message, command: CommandObject):
        sku = (command.args or "").strip()
        if not sku:
            await m.answer("Format: /allow <SKU>")
            return
        try:
            await db(lambda s: sourcing.allow_cheap(s, sku))
            await m.answer(f"➕ {sku} qoʻshildi (narx chegarasidan past, siz tasdiqladingiz).")
        except sourcing.SheetError as e:
            await m.answer(f"❌ {e}")

    @r.message(Command("prices"))
    async def prices(m: Message, command: CommandObject):
        arg = (command.args or "").strip()
        days = int(arg) if arg.isdigit() else 30
        await m.answer(await db(lambda s: price_report.text(s, now(), days)))

    @r.message(Command("problem"))
    async def problem(m: Message, command: CommandObject):
        await safe(m, lambda s: orders.set_problem(s, command.args))

    @r.message(Command("report"))
    async def report(m: Message, command: CommandObject):
        previous = (command.args or "").strip().casefold().startswith(("otgan", "oʻtgan", "o'tgan"))
        text, data, name = await asyncio.to_thread(report_files, ctx, previous)
        await m.answer(text)
        await m.answer_document(BufferedInputFile(data, name))

    @r.message(Command("buyprice"))
    async def buyprice(m: Message, command: CommandObject):
        await safe(m, lambda s: orders.set_buy_price(s, command.args, fx_now(now())[0], now()))

    @r.message(F.text & ~F.text.startswith("/"))
    async def text(m: Message):
        token = ctx.pending_fix.pop(m.from_user.id, None)
        if token in ctx.pending_screens:
            paths, data, url = ctx.pending_screens.pop(token)
            await read_and_preview(m, paths, url, data, m.text)
            return
        post_id = ctx.pending_edit.pop(m.from_user.id, None)
        if post_id is None:
            await m.answer(LINK_REPLY if screens.has_link(m.text) else HELP)
            return

        def run(s):
            at = now()
            fx, _ = fx_now(at)
            if fx is None:
                return publisher.Outcome(False, "Kurs yoʻq — keyinroq urinib koʻring."), None
            out = publisher.edit_body(s, post_id, m.text, fx, at)
            return out, post_view(s, s.get(Post, post_id))
        out, view = await db(run)
        await m.answer(("✅ " if out.ok else "❌ ") + out.message)
        if out.ok:
            await tg.draft(view, out.notes)
        else:
            ctx.pending_edit[m.from_user.id] = post_id  # let the admin try again
    return r


def build(token: str | None = None) -> tuple[Bot, Dispatcher, Ctx, Tg]:
    from app.db import make_engine
    admin_ids = {int(x) for x in config.env("TELEGRAM_ADMIN_IDS").replace(" ", "").split(",") if x}
    ctx = Ctx(factory=sessionmaker(bind=make_engine()), admin_ids=admin_ids,
              channel_id=os.environ.get("TELEGRAM_CHANNEL_ID") or None)
    ctx.llm = Llm(ctx.factory, alert=ctx.alerts.append)
    bot = Bot(token or config.env("TELEGRAM_BOT_TOKEN"))
    tg = Tg(bot, ctx)
    dp = Dispatcher()
    dp.include_router(create_router(ctx, tg))
    return bot, dp, ctx, tg


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    bot, dp, ctx, tg = build()
    sched = schedule(ctx, tg)
    sched.start()
    log.info("scheduler: %s", ", ".join(f"{j.id} {j.next_run_time:%d.%m %H:%M}" for j in sched.get_jobs()))
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
