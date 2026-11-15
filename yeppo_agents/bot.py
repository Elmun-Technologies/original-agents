"""Telegram side (admin only): daily post packages, sourcing proposals with buttons, commands, schedule.

Run: uv run python -m yeppo_agents.bot
Uses TELEGRAM_BOT_TOKEN (@Originalpobot) — only one process may poll a token, so the Poizon bot must stay paused.
"""
import asyncio
import html
import logging
from decimal import Decimal

import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandObject
from aiogram.types import (BufferedInputFile, CallbackQuery, FSInputFile, InlineKeyboardButton, InlineKeyboardMarkup,
                           InputMediaPhoto, Message)
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from yeppo_agents import content, sourcing, store
from yeppo_agents.catalog import Catalog
from yeppo_agents.content import fmt_uzs
from yeppo_agents.fetch import user_agent
from yeppo_agents.settings import TZ, admin_ids, cfg, dry_run, env

log = logging.getLogger(__name__)
LOCK = asyncio.Lock()
CAT_UZ = {"serum": "Serum", "essensiya": "Essensiya", "toner": "Toner", "spf": "SPF", "krem": "Krem",
          "tozalash": "Tozalovchi", "niqoblar": "Niqob", "toplamlar": "Toʻplam"}
HELP = (
    "<b>Yeppo agentlari</b>\n"
    "/posts — bugungi Instagram paketlarini hozir tayyorlash\n"
    "/source — Q-Depot'dan yangi tovar takliflarini qidirish\n"
    "/candidates — koʻrib chiqilmagan takliflar\n"
    "/trend &lt;matn&gt; — talab haqida kuzatuv (masalan: <i>/trend anua toner koʻp soʻralyapti</i>)\n"
    "/status — holat\n\n"
    "Jadval (Toshkent): takliflar {src} ({days}), paketlar har kuni {cnt}."
)


def is_admin(uid: int | None) -> bool:
    return uid is not None and uid in admin_ids()


async def notify(bot: Bot, text: str, **kw) -> None:
    for uid in admin_ids():
        try:
            await bot.send_message(uid, text, **kw)
        except Exception as e:
            log.warning("notify %s failed: %s", uid, type(e).__name__)


# --- content -------------------------------------------------------------------------------
async def send_package(bot: Bot, uid: int, pkg: content.Package) -> None:
    head = f"📦 <b>{html.escape(pkg.title)}</b>"
    if pkg.sample:
        head += "\n⚠️ Bu tovar sayt maʼlumotida «namuna» deb belgilangan — joylashdan oldin tekshiring."
    if pkg.body_source == "catalog":
        head += "\nℹ️ Matn katalogdagi tavsifdan olindi (AI matni tekshiruvdan oʻtmadi yoki ishlamadi)."
    await bot.send_message(uid, head)
    photos = [f for f in pkg.files if f.suffix == ".jpg"]
    await bot.send_media_group(uid, [InputMediaPhoto(media=FSInputFile(p)) for p in photos[:10]])
    reel = next((f for f in pkg.files if f.suffix == ".mp4"), None)
    if reel:
        await bot.send_video(uid, FSInputFile(reel), width=1080, height=1920, supports_streaming=True,
                             caption="🎬 Reels (musiqani Instagram'da qoʻshing)")
    await bot.send_message(uid, html.escape(pkg.caption), disable_web_page_preview=True)
    await bot.send_message(uid, f"🔗 Havola (stories / bio uchun):\n{html.escape(pkg.link)}", disable_web_page_preview=True)


async def run_content(bot: Bot) -> None:
    async with LOCK:
        cat = Catalog()
        try:
            demand = await asyncio.to_thread(sourcing.demand_from_catalog, cat)
            pkgs, errs = await asyncio.to_thread(content.daily, cat, demand)
        except Exception as e:
            log.exception("content run failed")
            await notify(bot, f"❗ Paket tayyorlashda xato: {html.escape(str(e))[:500]}")
            return
        for pkg in pkgs:
            for uid in admin_ids():
                try:
                    await send_package(bot, uid, pkg)
                except Exception:
                    log.exception("send package %s", pkg.slug)
            store.record_post(pkg.slug, pkg.caption, [str(f) for f in pkg.files])
        lines = [f"✅ Bugungi paketlar: {len(pkgs)} ta. Instagram'ga joylang."]
        lines += [f"• {html.escape(e)}" for e in errs]
        await notify(bot, "\n".join(lines))


# --- sourcing --------------------------------------------------------------------------------
def candidate_text(c: dict) -> str:
    reasons = "; ".join(c.get("reasons") or []) or "—"
    return (
        f"🧴 <b>{html.escape(c['brand'])}</b> {html.escape(c['name'])}\n"
        f"Toifa: {CAT_UZ.get(c['category'] or '', c['category'] or '—')}{' · ' + html.escape(c['volume']) if c.get('volume') else ''}\n"
        f"Q-Depot narxi: ${Decimal(c['price_usd']):.2f} (chakana; ulgurji narx boshqacha boʻlishi mumkin)\n"
        f"Sotuv narxi: <b>{fmt_uzs(c['sell_uzs'])} soʻm</b> · foyda ≈ {fmt_uzs(c['profit_uzs'])} soʻm\n"
        f"Nega: {html.escape(reasons)}\n"
        f"<a href=\"{html.escape(c['url'])}\">Manba sahifasi</a>"
    )


def candidate_kb(cid: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Katalogga qoʻshish", callback_data=f"yc:add:{cid}"),
        InlineKeyboardButton(text="❌ Kerak emas", callback_data=f"yc:no:{cid}"),
    ]])


async def send_candidates(bot: Bot, limit: int = 8) -> int:
    rows = [c for c in store.candidates_by_status("new", limit=limit) if c["score"] > 0] or store.candidates_by_status("new", limit=limit)
    sent = 0
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": user_agent()}) as h:
        for c in rows:
            photo = None
            if c.get("img"):  # we fetch the image ourselves: Telegram fetching third-party URLs times out
                try:
                    r = await h.get(c["img"])
                    if r.status_code == 200:
                        photo = BufferedInputFile(r.content, filename="p.jpg")
                except httpx.HTTPError:
                    pass
            ok = False
            for uid in admin_ids():
                try:
                    if photo:
                        await bot.send_photo(uid, photo, caption=candidate_text(c), reply_markup=candidate_kb(c["id"]))
                    else:
                        await bot.send_message(uid, candidate_text(c), reply_markup=candidate_kb(c["id"]))
                    ok = True
                except Exception as e:
                    log.warning("candidate %s to %s failed: %s", c["id"], uid, type(e).__name__)
            if ok:  # undelivered proposals stay "new" and go out next time
                store.set_status(c["id"], "sent")
                sent += 1
    return sent


async def run_sourcing(bot: Bot) -> None:
    async with LOCK:
        try:
            rep = await asyncio.to_thread(sourcing.run, Catalog())
        except Exception as e:
            log.exception("sourcing failed")
            await notify(bot, f"❗ Manba agentida xato: {html.escape(str(e))[:500]}")
            return
    msg = [f"🔎 Q-Depot: {rep.listed} ta tovar koʻrildi, {rep.opened} ta sahifa ochildi, {rep.saved} ta taklif."]
    if rep.blocked:
        msg.append(f"⛔ Sayt toʻxtatdi: {html.escape(rep.blocked)}. Chetlab oʻtilmaydi — keyinroq qayta urinamiz.")
    if rep.skipped:
        msg.append("Oʻtkazib yuborildi: " + ", ".join(f"{k} — {v}" for k, v in rep.skipped.most_common(6)))
    if rep.demand:
        msg.append("Talab asoslari:\n" + "\n".join(f"• {html.escape(x)}" for x in rep.demand[:8]))
    await notify(bot, "\n".join(msg))
    sent = await send_candidates(bot)
    if not sent:
        await notify(bot, "Yangi taklif yoʻq.")


async def add_candidate(cid: int) -> str:
    c = store.candidate(cid)
    if not c:
        return "Taklif topilmadi."
    if c["status"] == "added":
        return f"Allaqachon qoʻshilgan: {c['product_slug']}"
    if dry_run():
        return "DRY_RUN=true — katalogga yozilmadi. Haqiqiy ishda DRY_RUN=false qiling."
    cat = Catalog()
    cats = await asyncio.to_thread(cat.categories)
    cat_id = cats.get(c["category"] or "") or cats.get("yuz-parvarishi")
    image_ids = []
    if c.get("img"):
        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": user_agent()}) as h:
            r = await h.get(c["img"])
        if r.status_code == 200:
            image_ids.append(await asyncio.to_thread(cat.upload_image, r.content, c["img"].rsplit("/", 1)[-1], f"{c['brand']} {c['name']}"))
    sku = f"QD-{c['model'] or cid}"
    doc = await asyncio.to_thread(
        cat.create_product, name=c["name"], brand=c["brand"], category_id=cat_id, type_uz=CAT_UZ.get(c["category"] or ""),
        sku=sku, volume=c.get("volume"), price_uzs=c["sell_uzs"], image_ids=image_ids)
    store.set_status(cid, "added", doc["slug"])
    return (f"✅ Katalogga qoʻshildi (qoldiq 0 — saytda «tugagan» koʻrinadi).\n"
            f"Tovar kelganda admin panelda qoldiq, tavsif, partiya va yaroqlilik muddatini kiriting:\n"
            f"{cat.base}/admin/collections/products/{doc['id']}")


# --- wiring -------------------------------------------------------------------------------------
def build_dispatcher(bot: Bot) -> Dispatcher:
    dp = Dispatcher()
    admin = F.from_user.id.in_(set(admin_ids()))

    @dp.message(Command("start", "help"), admin)
    async def _help(m: Message):
        s = cfg()["schedule"]
        await m.answer(HELP.format(src=s["sourcing"], days=", ".join(s["sourcing_days"]), cnt=s["content"]))

    @dp.message(Command("trend"), admin)
    async def _trend(m: Message, command: CommandObject):
        if not command.args:
            await m.answer("Masalan: /trend anua toner koʻp soʻralyapti")
            return
        store.add_trend(command.args)
        await m.answer("Yozib oldim — keyingi qidiruvda hisobga olinadi.")

    @dp.message(Command("posts"), admin)
    async def _posts(m: Message):
        await m.answer("Tayyorlayapman… (1 tovar ≈ 20–40 soniya)")
        await run_content(bot)

    @dp.message(Command("source"), admin)
    async def _source(m: Message):
        await m.answer("Q-Depot'ni koʻryapman… sahifalar orasida 5–10 soniya pauza, bu 10–15 daqiqa oladi.")
        asyncio.create_task(run_sourcing(bot))

    @dp.message(Command("candidates"), admin)
    async def _cands(m: Message):
        if not await send_candidates(bot):
            await m.answer("Koʻrib chiqilmagan taklif yoʻq. /source bilan qidiring.")

    @dp.message(Command("status"), admin)
    async def _status(m: Message):
        new = len(store.candidates_by_status("new", "sent", limit=500))
        await m.answer(f"Takliflar (javob kutilmoqda): {new}\nLLM bugun: ${store.llm_spent_today():.3f}\n"
                       f"DRY_RUN: {'ha' if dry_run() else 'yoʻq'}\nTrendlar (14 kun): {len(store.recent_trends(14))}")

    @dp.callback_query(F.data.startswith("yc:"), admin)
    async def _cb(q: CallbackQuery):
        _, action, cid = q.data.split(":")
        if action == "no":
            store.set_status(int(cid), "rejected")
            await q.answer("Rad etildi")
            await q.message.edit_reply_markup(reply_markup=None)
            return
        await q.answer("Qoʻshyapman…")
        try:
            text = await add_candidate(int(cid))
        except Exception as e:
            log.exception("add candidate")
            text = f"❗ Xato: {html.escape(str(e))[:400]}"
        await q.message.edit_reply_markup(reply_markup=None)
        await q.message.answer(text)

    return dp


def schedule(bot: Bot) -> AsyncIOScheduler:
    s = cfg()["schedule"]
    sch = AsyncIOScheduler(timezone=TZ)
    h, m = map(int, s["sourcing"].split(":"))
    sch.add_job(run_sourcing, CronTrigger(day_of_week=",".join(s["sourcing_days"]), hour=h, minute=m, timezone=TZ), args=[bot])
    h, m = map(int, s["content"].split(":"))
    sch.add_job(run_content, CronTrigger(hour=h, minute=m, timezone=TZ), args=[bot])
    return sch


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    from aiogram.client.default import DefaultBotProperties
    bot = Bot(env("TELEGRAM_BOT_TOKEN", required=True), default=DefaultBotProperties(parse_mode="HTML"))
    if not admin_ids():
        raise RuntimeError("TELEGRAM_ADMIN_IDS is empty")
    schedule(bot).start()
    await bot.delete_webhook(drop_pending_updates=False)
    await build_dispatcher(bot).start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
