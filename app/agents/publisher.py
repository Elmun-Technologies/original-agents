"""Publishing workflow (CLAUDE.md §6.5): daily drafts -> admin approval -> channel slots.

Business logic only; the Telegram bot does the sending. Rules:
- Draft order: our stock -> products matching /trend notes -> newest active products without a post.
  Per day at most per_brand_daily_max drafts per brand and per_model_daily_max per model.
- No approval without the admin's own photos (own_photos_only).
- Before approval and before publishing, prices are re-quoted with current rates; a change
  above price_change_alert_pct sends the post back to the admin with the reason per size
  (source price vs exchange rate).
"""
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import config
from app.agents.content import (ContentError, Draft, create_draft, display_model, own_photos, post_quotes,
                                refresh_post)
from app.config import TZ
from app.db.models import AppState, Post, Product, Quote, TrendNote
from app.pricing.calculator import price_change
from app.pricing.rates import Rate
from app.uz import format_uzs

log = logging.getLogger(__name__)

STOPWORDS = {"koʻp", "kop", "ko'p", "soʻralyapti", "so'ralyapti", "soralyapti", "kerak", "bor", "juda",
             "yangi", "zoʻr", "zor", "model", "rang", "rangi", "uchun", "va", "ham", "очень", "много", "нужно"}


# --- pause flag ----------------------------------------------------------------

def is_paused(session: Session) -> bool:
    row = session.get(AppState, "paused")
    return row is not None and row.value == "1"


def set_paused(session: Session, paused: bool) -> None:
    row = session.get(AppState, "paused") or AppState(key="paused", value="0")
    row.value = "1" if paused else "0"
    session.add(row)
    session.flush()


# --- daily selection -------------------------------------------------------------

def _day_start_utc(now: datetime) -> datetime:
    return datetime.combine(now.astimezone(TZ).date(), time(), TZ).astimezone(timezone.utc)


def trend_terms(session: Session, now: datetime) -> list[set[str]]:
    since = now.astimezone(timezone.utc) - timedelta(days=config.settings()["publishing"]["trend_days"])
    notes = session.scalars(select(TrendNote.text).where(TrendNote.created_at >= since))
    out = []
    for text in notes:
        words = {w for w in re.findall(r"[\wʻ'’]+", text.casefold()) if len(w) >= 2 and w not in STOPWORDS}
        if words:
            out.append(words)
    return out


def trend_score(product: Product, terms: list[set[str]]) -> int:
    hay = set(re.findall(r"[\wʻ'’]+", f"{product.brand} {product.model_name} {product.style_code}".casefold()))
    best = 0
    for words in terms:
        hit = len(words & hay)
        if hit >= min(2, len(words)):
            best = max(best, hit)
    return best


def pick_products(session: Session, now: datetime, limit: int) -> list[tuple[Product, bool]]:
    """[(product, as_stock_post)] in priority order, respecting the per-day diversity caps."""
    p = config.settings()["publishing"]
    day_start = _day_start_utc(now)
    posts = list(session.scalars(select(Post).where(Post.status != "rejected")))
    has_post = {x.product_id for x in posts}
    open_post = {x.product_id for x in posts if x.status in ("draft", "approved")}
    repost_after = now - timedelta(days=p["stock_repost_after_days"])
    recent_stock_post = {x.product_id for x in posts
                         if x.is_stock and x.published_at is not None and x.published_at > repost_after}

    brands: dict[str, int] = {}
    models: dict[str, int] = {}
    for x in posts:  # drafts already created today count toward today's caps
        if x.created_at >= day_start:
            prod = session.get(Product, x.product_id)
            brands[prod.brand.casefold()] = brands.get(prod.brand.casefold(), 0) + 1
            mk = display_model(prod).casefold()
            models[mk] = models.get(mk, 0) + 1

    products = list(session.scalars(select(Product).order_by(Product.first_seen_at.desc(), Product.id.desc())))
    terms = trend_terms(session, now)
    replica = lambda pr: (pr.rejected_reason or "").startswith("replika")
    stock = [pr for pr in products if pr.in_stock and not replica(pr)
             and pr.id not in open_post and pr.id not in recent_stock_post]
    fresh = [pr for pr in products if pr.is_active and pr.id not in has_post and pr not in stock]
    trending = sorted((pr for pr in fresh if trend_score(pr, terms)), key=lambda pr: -trend_score(pr, terms))
    newest = [pr for pr in fresh if pr not in trending]

    picked: list[tuple[Product, bool]] = []
    for pr, as_stock in [(x, True) for x in stock] + [(x, False) for x in trending + newest]:
        if len(picked) >= limit:
            break
        b, m = pr.brand.casefold(), display_model(pr).casefold()
        if brands.get(b, 0) >= p["per_brand_daily_max"] or models.get(m, 0) >= p["per_model_daily_max"]:
            continue
        brands[b] = brands.get(b, 0) + 1
        models[m] = models.get(m, 0) + 1
        picked.append((pr, as_stock))
    return picked


@dataclass
class DailyResult:
    drafts: list[Draft] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def make_daily_drafts(session: Session, llm_client, fx: dict[str, Rate], now: datetime, out_root=None) -> DailyResult:
    """Creates up to daily_drafts.max drafts; each draft is committed on its own."""
    res = DailyResult()
    if is_paused(session):
        res.notes.append("Pauza yoqilgan (/resume) — draftlar tayyorlanmadi.")
        return res
    p = config.settings()["publishing"]["daily_drafts"]
    for product, as_stock in pick_products(session, now, p["max"]):
        try:
            d = create_draft(session, product, llm_client, fx, now=now, out_root=out_root, stock=as_stock)
            session.commit()
            res.drafts.append(d)
            res.notes += [n for n in d.notes if n not in res.notes]
        except Exception as e:  # one bad product must not stop the rest
            session.rollback()  # earlier drafts are already committed
            log.warning("draft failed for %s: %s", product.style_code, e)
            res.errors.append(f"{product.style_code}: {e}")
    if len(res.drafts) < p["min"]:
        res.notes.append(f"Bugun {len(res.drafts)} ta draft (reja: {p['min']}–{p['max']}). "
                         "Yangi mahsulot yuklang yoki /trend yozing.")
    return res


# --- price recheck -----------------------------------------------------------------

def change_report(old: list[Quote], new: list[Quote], threshold: float) -> tuple[bool, list[str]]:
    """(exceeded, lines) comparing quotes per size; splits source-price vs exchange-rate change."""
    old_by = {q.size: q for q in old}
    new_by = {q.size: q for q in new}
    exceeded, lines = False, []
    for size, nq in new_by.items():
        oq = old_by.get(size)
        if oq is None:
            lines.append(f"{size}: yangi oʻlcham, {format_uzs(nq.sell_price_uzs)}")
            continue
        total = nq.sell_price_uzs / oq.sell_price_uzs - 1
        if abs(total) > threshold:
            exceeded = True
        if nq.sell_price_uzs == oq.sell_price_uzs:
            continue
        why = ""
        if not nq.breakdown.get("stock") and not oq.breakdown.get("stock"):
            ch = price_change(oq.breakdown, nq.breakdown)
            if ch["source"] is not None:
                why = f" (manba narxi {ch['source']:+.1%}, kurs {ch['fx']:+.1%})"
        lines.append(f"{size}: {format_uzs(oq.sell_price_uzs)} → {format_uzs(nq.sell_price_uzs)} "
                     f"({total:+.1%}){why}")
    for size in old_by.keys() - new_by.keys():
        exceeded = True
        lines.append(f"{size}: endi mavjud emas")
    return exceeded, lines


@dataclass
class Outcome:
    ok: bool
    message: str
    notes: list[str] = field(default_factory=list)


def _get_post(session: Session, post_id: int, statuses: tuple[str, ...]) -> Post:
    post = session.get(Post, post_id)
    if post is None:
        raise ContentError(f"Post #{post_id} topilmadi.")
    if post.status not in statuses:
        raise ContentError(f"Post #{post_id} holati: {post.status}.")
    return post


def approve(session: Session, post_id: int, admin_id: int, fx: dict[str, Rate], now: datetime,
            out_root=None) -> Outcome:
    post = _get_post(session, post_id, ("draft",))
    product = session.get(Product, post.product_id)
    if not own_photos(product):
        return Outcome(False, f"Post #{post_id}: surat yoʻq — tasdiqlab boʻlmaydi. Botga SKU {product.style_code} "
                              "izohi bilan surat yuboring.")
    threshold = config.settings()["publishing"]["price_change_alert_pct"]
    old, new, notes = refresh_post(session, post, fx, now=now, out_root=out_root)  # re-render with photos
    exceeded, lines = change_report(old, new, threshold)
    if exceeded:
        session.flush()
        return Outcome(False, f"Post #{post_id}: narx {threshold:.0%} dan koʻp oʻzgardi, post qayta hisoblandi. "
                              "Koʻrib chiqib, yana tasdiqlang.\n" + "\n".join(lines), notes)
    post.status, post.approved_by, post.approved_at = "approved", admin_id, now.astimezone(timezone.utc)
    session.flush()
    return Outcome(True, f"Post #{post_id} tasdiqlandi." + ("\n" + "\n".join(lines) if lines else ""), notes)


def reject(session: Session, post_id: int) -> Outcome:
    post = _get_post(session, post_id, ("draft", "approved"))
    post.status = "rejected"
    session.flush()
    return Outcome(True, f"Post #{post_id} rad etildi.")


def edit_body(session: Session, post_id: int, text: str, fx: dict[str, Rate], now: datetime, out_root=None) -> Outcome:
    """Admin's own text goes through the same checks as the LLM's. Post stays a draft."""
    post = _get_post(session, post_id, ("draft",))
    try:  # the text is checked before anything is changed, so a refusal leaves the post as is
        _, _, notes = refresh_post(session, post, fx, now=now, body=text, out_root=out_root)
    except ContentError as e:
        return Outcome(False, str(e))
    return Outcome(True, f"Post #{post_id} matni yangilandi.", notes)


def refresh_price(session: Session, post_id: int, fx: dict[str, Rate], now: datetime, out_root=None) -> Outcome:
    post = _get_post(session, post_id, ("draft",))
    old, new, notes = refresh_post(session, post, fx, now=now, out_root=out_root)
    _, lines = change_report(old, new, 1.0)
    return Outcome(True, f"Post #{post_id} narxi yangilandi." + ("\n" + "\n".join(lines) if lines else " Oʻzgarish yoʻq."), notes)


# --- publishing ---------------------------------------------------------------------

def next_to_publish(session: Session) -> Post | None:
    if is_paused(session):
        return None
    return session.scalar(select(Post).where(Post.status == "approved").order_by(Post.approved_at, Post.id))


def prepare_publish(session: Session, post: Post, fx: dict[str, Rate], now: datetime, out_root=None) -> Outcome:
    """Fresh quotes right before posting, so the 24h price window starts at publication.
    A big change sends the post back to draft for the admin."""
    threshold = config.settings()["publishing"]["price_change_alert_pct"]
    old, new, notes = refresh_post(session, post, fx, now=now, out_root=out_root)
    exceeded, lines = change_report(old, new, threshold)
    if exceeded:
        post.status = "draft"
        session.flush()
        return Outcome(False, f"Post #{post.id} nashr qilinmadi: narx {threshold:.0%} dan koʻp oʻzgardi. "
                              "Qayta tasdiqlang.\n" + "\n".join(lines), notes)
    return Outcome(True, "", notes)


def mark_published(session: Session, post: Post, message_id: int | None, now: datetime) -> None:
    post.status, post.published_at, post.telegram_message_id = "published", now.astimezone(timezone.utc), message_id
    session.flush()


def admin_summary(session: Session, post: Post) -> str:
    """Draft message for the admin: price breakdown per size (cost, markup, profit)."""
    product = session.get(Product, post.product_id)
    lines = [f"📝 Post #{post.id} · {post.status}{' · OMBOR' if post.is_stock else ''}",
             f"{product.brand} {product.model_name} · {product.style_code}"]
    for q in post_quotes(session, post):
        b = q.breakdown
        cost = (f"tannarx {format_uzs(b['stock_cost_uzs'])}" if b.get("stock")
                else f"manba {b['source_price']:g} {b['source_currency']}, tannarx ${b['landed_cost_usd']:.2f}")
        lines.append(f"• {q.size}: {format_uzs(q.sell_price_uzs)} — {cost}, foyda {format_uzs(b['profit_uzs'])}")
    return "\n".join(lines)
