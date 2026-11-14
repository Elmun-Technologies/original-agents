"""Orders, leads, stock and expenses (CLAUDE.md §7). Business logic only — the Telegram
bot calls these. Money and status decisions stay with the admin; this just records them.

Customer contacts are PII: stored for the order and the per-recipient customs limit,
shown to the admin, but only ever logged masked.
"""
import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents.content import post_quotes
from app.config import TZ
from app.db.models import (SHIPPING_STATUSES, Expense, Lead, Order, Post, Product, ProductSize, Quote,
                           TrendNote)
from app.pricing.calculator import Quote as Calc
from app.pricing.calculator import quote_from_source, stock_quote
from app.pricing.rates import Rate
from app.uz import format_uzs

log = logging.getLogger(__name__)

NEWORDER_USAGE = ("Format: /neworder <post_id> <oʻlcham> <ism> <telefon yoki @username> "
                  "[ext=<USD>] [novac]\n"
                  "ext — mijozning shu oydagi boshqa xorijiy posilkalari (USD), novac — vakuum qadoqsiz.")


class OrderError(Exception):
    pass


# --- contacts ----------------------------------------------------------------

HANDLE = re.compile(r"@[A-Za-z][A-Za-z0-9_]{3,31}")
PHONE = re.compile(r"\+?\d[\d\s\-()]{7,}\d")


def normalize_contact(raw: str) -> str | None:
    raw = raw.strip()
    if HANDLE.fullmatch(raw):
        return raw.lower()
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 9:
        return "+998" + digits
    if len(digits) == 12 and digits.startswith("998"):
        return "+" + digits
    if raw.startswith("+") and 10 <= len(digits) <= 15:
        return "+" + digits
    return None


def mask_contact(contact: str) -> str:
    if contact.startswith("@"):
        return contact[:3] + "***"
    return contact[:6] + "*" * max(len(contact) - 8, 0) + contact[-2:]


# --- /neworder ---------------------------------------------------------------

@dataclass
class NewOrderRequest:
    post_id: int
    size: str
    name: str
    contact: str
    external_usd: Decimal = Decimal(0)
    vacuum: bool | None = None


def parse_neworder(args: str | None) -> NewOrderRequest:
    tokens = (args or "").split()
    ext, vacuum = Decimal(0), None
    rest = []
    for t in tokens:
        if t.lower() == "novac":
            vacuum = False
        elif t.lower().startswith("ext="):
            try:
                ext = Decimal(t[4:].replace(",", "."))
            except ArithmeticError:
                raise OrderError("ext=<USD> notoʻgʻri.\n" + NEWORDER_USAGE) from None
            if ext < 0:
                raise OrderError("ext manfiy boʻlolmaydi.\n" + NEWORDER_USAGE)
        else:
            rest.append(t)
    if len(rest) < 4 or not rest[0].isdigit():
        raise OrderError(NEWORDER_USAGE)
    post_id, size, rest = int(rest[0]), rest[1].replace(",", "."), rest[2:]
    if rest and rest[0] in ("1/3", "2/3"):  # "40 2/3"
        size, rest = f"{size} {rest[0]}", rest[1:]
    text = " ".join(rest)
    m = HANDLE.search(text) or (list(PHONE.finditer(text)) or [None])[-1]
    contact = normalize_contact(m.group(0)) if m else None
    if not contact:
        raise OrderError("Telefon (+998…) yoki @username topilmadi.\n" + NEWORDER_USAGE)
    name = " ".join((text[:m.start()] + " " + text[m.end():]).split())
    if not name:
        raise OrderError("Mijoz ismi yoʻq.\n" + NEWORDER_USAGE)
    return NewOrderRequest(post_id, size.upper() if size.isalpha() else size, name, contact, ext, vacuum)


def month_bounds_utc(now: datetime) -> tuple[datetime, datetime]:
    d = now.astimezone(TZ).date()
    start = date(d.year, d.month, 1)
    end = date(d.year + (d.month == 12), d.month % 12 + 1, 1)
    to_utc = lambda x: datetime.combine(x, time(), TZ).astimezone(timezone.utc)
    return to_utc(start), to_utc(end)


def month_totals(session: Session, contact: str, now: datetime, exclude_id: int | None = None) -> tuple[Decimal, Decimal]:
    """Customs value (USD) and actual weight of this recipient's parcels this calendar month
    (Tashkent time), excluding cancelled and stock orders.
    TODO(admin): per-recipient monthly $200 rule to be confirmed with a customs broker."""
    start, end = month_bounds_utc(now)
    q = (select(func.coalesce(func.sum(Order.customs_value_usd), 0), func.coalesce(func.sum(Order.weight_kg), 0))
         .where(Order.customer_contact == contact, Order.cancelled_at.is_(None), Order.from_stock.is_(False),
                Order.created_at >= start, Order.created_at < end))
    if exclude_id:
        q = q.where(Order.id != exclude_id)
    value, weight = session.execute(q).one()
    return Decimal(str(value)), Decimal(str(weight))


@dataclass
class OrderPreview:
    req: NewOrderRequest
    post: Post
    product: Product
    size_row: ProductSize
    price_uzs: int
    customs_value_usd: Decimal
    weight_kg: Decimal
    reuse_quote: Quote | None            # posted quote still valid and unchanged
    new_quote: Calc | None               # recalculated (expired / monthly limit / no vacuum)
    from_stock: bool
    warnings: list[str] = field(default_factory=list)

    def text(self) -> str:
        r, p = self.req, self.product
        lines = [f"🧾 Yangi buyurtma (tasdiqlang)",
                 f"Post #{self.post.id}: {p.brand} {p.model_name} · {p.style_code}",
                 f"Oʻlcham: {r.size}" + (" · OMBORDAN" if self.from_stock else ""),
                 f"Mijoz: {r.name}, {r.contact}",
                 f"Narx: {format_uzs(self.price_uzs)}"]
        if r.external_usd:
            lines.append(f"Mijozning boshqa posilkalari (shu oy): ${r.external_usd}")
        if r.vacuum is False:
            lines.append("Vakuum qadoqsiz")
        lines += [f"⚠️ {w}" for w in self.warnings]
        return "\n".join(lines)


def _match_size(size: str, options: list[str]) -> str | None:
    norm = lambda s: s.replace(",", ".").replace(" ", "").upper()
    return next((o for o in options if norm(o) == norm(size)), None)


def preview_order(session: Session, req: NewOrderRequest, fx: dict[str, Rate] | None, now: datetime) -> OrderPreview:
    post = session.get(Post, req.post_id)
    if post is None or post.status not in ("approved", "published"):
        raise OrderError(f"Post #{req.post_id} topilmadi yoki hali tasdiqlanmagan.")
    product = session.get(Product, post.product_id)
    quotes = {q.size: q for q in post_quotes(session, post)}
    size = _match_size(req.size, list(quotes))
    if size is None:
        raise OrderError(f"Post #{post.id}da {req.size} oʻlcham yoʻq. Bor: {', '.join(quotes) or '—'}")
    req.size = size
    posted = quotes[size]
    ps = next(s for s in product.sizes if s.size_eu == size)
    warnings: list[str] = []
    valid = posted.valid_until > now
    expired_note = (f"Postdagi narx muddati oʻtgan ({format_uzs(posted.sell_price_uzs)}). "
                    "Yangi narx joriy kurs bilan hisoblandi.")

    if post.is_stock:
        if ps.stock_qty <= 0:
            raise OrderError(f"{product.style_code} {size}: omborda qolmagan.")
        if valid:
            return OrderPreview(req, post, product, ps, posted.sell_price_uzs, Decimal(0), Decimal(0),
                                posted, None, True, warnings)
        if fx is None:
            raise OrderError("Kurs yoʻq — narxni qayta hisoblab boʻlmadi.")
        calc = stock_quote(ps.stock_cost_uzs, fx["USD"].value, now=now)
        return OrderPreview(req, post, product, ps, calc.sell_price_uzs, Decimal(0), Decimal(0),
                            None, calc, True, [expired_note])

    prior_v, prior_w = month_totals(session, req.contact, now)
    prior_v += req.external_usd
    if valid and prior_v == 0 and req.vacuum is None:
        b = posted.breakdown
        return OrderPreview(req, post, product, ps, posted.sell_price_uzs, Decimal(str(b["customs_value_usd"])),
                            Decimal(str(b["weight_kg"])), posted, None, False, warnings)
    if fx is None:
        raise OrderError("Kurs yoʻq — narxni qayta hisoblab boʻlmadi.")
    calc = quote_from_source(ps.source_price, ps.source_currency, product.category, fx, now=now,
                             prior_month_value_usd=prior_v, prior_month_weight_kg=prior_w,
                             vacuum_packing=req.vacuum)
    warnings += calc.warnings
    if not valid:
        warnings.append(expired_note)
    elif calc.sell_price_uzs != posted.sell_price_uzs:
        warnings.append(f"Narx postdagidan farq qiladi: {format_uzs(posted.sell_price_uzs)} → "
                        f"{format_uzs(calc.sell_price_uzs)}.")
    return OrderPreview(req, post, product, ps, calc.sell_price_uzs, calc.customs_value_usd, calc.weight_kg,
                        None, calc, False, warnings)


def create_order(session: Session, pv: OrderPreview, now: datetime) -> Order:
    if pv.reuse_quote is not None:
        quote = pv.reuse_quote
    else:
        c = pv.new_quote
        quote = Quote(product_id=pv.product.id, size=pv.req.size, landed_cost_usd=c.landed_cost_usd,
                      sell_price_uzs=c.sell_price_uzs, usd_rate=c.usd_rate, valid_until=c.valid_until,
                      breakdown=c.breakdown)
        session.add(quote)
        session.flush()
    order = Order(post_id=pv.post.id, product_id=pv.product.id, quote_id=quote.id, size=pv.req.size,
                  sell_price_uzs=pv.price_uzs, customer_name=pv.req.name, customer_contact=pv.req.contact,
                  customs_value_usd=pv.customs_value_usd, weight_kg=pv.weight_kg,
                  external_parcels_usd=pv.req.external_usd, vacuum_packing=pv.req.vacuum,
                  from_stock=pv.from_stock, created_at=now.astimezone(timezone.utc))
    if pv.from_stock:
        session.refresh(pv.size_row)
        if pv.size_row.stock_qty <= 0:
            raise OrderError("Omborda qolmagan.")
        pv.size_row.stock_qty -= 1
        order.buyout_status, order.shipping_status = "bought", "in_tashkent"
    session.add(order)
    session.flush()
    log.info("order #%s created: post #%s size %s contact %s price %s", order.id, pv.post.id,
             pv.req.size, mask_contact(pv.req.contact), pv.price_uzs)
    return order


# --- order status ------------------------------------------------------------

STATUS_UZ = {"awaiting_prepayment": "toʻlov kutilmoqda", "paid": "toʻlandi", "pending": "kutilmoqda",
             "bought": "sotib olindi", "in_china_warehouse": "Xitoy omborida", "shipped": "yoʻlda",
             "in_tashkent": "Toshkentda", "delivered": "yetkazildi"}


def next_actions(o: Order) -> list[tuple[str, str]]:
    if o.cancelled_at:
        return []
    acts = []
    if o.prepayment_status == "awaiting_prepayment":
        acts.append(("paid", "💰 Toʻlov keldi"))
    elif o.buyout_status == "pending":
        acts.append(("bought", "🛒 Sotib olindi"))
    elif o.shipping_status != "delivered":
        nxt = SHIPPING_STATUSES[SHIPPING_STATUSES.index(o.shipping_status) + 1]
        acts.append(("ship", f"🚚 {STATUS_UZ[nxt].capitalize()}"))
    if o.shipping_status in ("in_tashkent", "delivered") and not o.from_stock:
        acts.append(("stock", "📦 Omborga"))
    if o.shipping_status != "delivered":
        acts.append(("cancel", "❌ Bekor qilish"))
    return acts


def _add_to_stock(ps: ProductSize, unit_cost_uzs: int) -> None:
    """Weighted average cost over units in stock."""
    old_qty, old_cost = ps.stock_qty, ps.stock_cost_uzs or unit_cost_uzs
    ps.stock_qty = old_qty + 1
    ps.stock_cost_uzs = round((old_cost * old_qty + unit_cost_uzs) / ps.stock_qty)


def apply_action(session: Session, order: Order, action: str, now: datetime) -> str:
    if action not in dict(next_actions(order)):
        raise OrderError(f"Buyurtma #{order.id}: bu amal hozir mumkin emas.")
    ts = now.astimezone(timezone.utc)
    ps = session.scalar(select(ProductSize).where(ProductSize.product_id == order.product_id,
                                                  ProductSize.size_eu == order.size))
    if action == "paid":
        order.prepayment_status, order.admin_confirmed_at = "paid", ts
    elif action == "bought":
        order.buyout_status = "bought"
    elif action == "ship":
        order.shipping_status = SHIPPING_STATUSES[SHIPPING_STATUSES.index(order.shipping_status) + 1]
        if order.shipping_status == "delivered":
            order.delivered_at = ts
    elif action == "stock":
        quote = session.get(Quote, order.quote_id)
        unit_cost = int(Decimal(quote.landed_cost_usd) * Decimal(quote.usd_rate))
        _add_to_stock(ps, unit_cost)
        order.cancelled_at = ts
        order.notes = ((order.notes or "") + " Omborga olindi.").strip()
    elif action == "cancel":
        order.cancelled_at = ts
        if order.from_stock and ps is not None:
            ps.stock_qty += 1
    session.flush()
    log.info("order #%s: %s", order.id, action)
    return order_text(session, order)


def order_text(session: Session, o: Order) -> str:
    p = session.get(Product, o.product_id)
    state = "❌ BEKOR QILINGAN" if o.cancelled_at else (
        f"{STATUS_UZ[o.prepayment_status]} · {STATUS_UZ[o.buyout_status]} · {STATUS_UZ[o.shipping_status]}")
    text = (f"📦 Buyurtma #{o.id}{' · OMBORDAN' if o.from_stock else ''}\n"
            f"{p.brand} {p.model_name} · {p.style_code} · {o.size}\n"
            f"Mijoz: {o.customer_name}, {o.customer_contact}\n"
            f"Narx: {format_uzs(o.sell_price_uzs)}\n"
            f"Holat: {state}" + (f"\nIzoh: {o.notes}" if o.notes else ""))
    if o.buy_cost_uzs is not None:
        text += (f"\nXarid: ¥{o.buy_price_cny:g}, tannarx {format_uzs(o.buy_cost_uzs)}, "
                 f"foyda {format_uzs(o.sell_price_uzs - o.buy_cost_uzs)}")
    elif not o.cancelled_at and not o.from_stock and o.buyout_status == "pending":
        text += (f"\n⚠️ Xariddan oldin ilovada joriy narxni tekshiring. Sotib olgach: "
                 f"/buyprice {o.id} <yuan>")
    return text


def set_buy_price(session: Session, args: str | None, fx: dict[str, Rate] | None, now: datetime) -> str:
    """/buyprice <order_id> <yuan>: real purchase price -> landed cost and profit recalculated
    (same customs month aggregation as the order)."""
    t = (args or "").replace(",", ".").split()
    try:
        order_id, price = int(t[0]), Decimal(t[1])
    except (IndexError, ValueError, ArithmeticError):
        raise OrderError("Format: /buyprice <buyurtma_id> <yuan>, masalan /buyprice 12 489")
    if price <= 0:
        raise OrderError("Narx musbat boʻlsin.")
    o = session.get(Order, order_id)
    if o is None:
        raise OrderError(f"Buyurtma #{order_id} topilmadi.")
    if o.from_stock:
        raise OrderError(f"Buyurtma #{order_id} ombordan — xarid narxi yoʻq.")
    if fx is None:
        raise OrderError("Kurs yoʻq — keyinroq urinib koʻring.")
    product = session.get(Product, o.product_id)
    planned = session.get(Quote, o.quote_id).breakdown.get("profit_uzs")
    prior_v, prior_w = month_totals(session, o.customer_contact, now, exclude_id=o.id)
    calc = quote_from_source(price, "CNY", product.category, fx, now=now,
                             prior_month_value_usd=prior_v + o.external_parcels_usd,
                             prior_month_weight_kg=prior_w, vacuum_packing=o.vacuum_packing)
    o.buy_price_cny, o.buy_cost_uzs = price, int(calc.landed_cost_usd * calc.usd_rate)
    session.flush()
    profit = o.sell_price_uzs - o.buy_cost_uzs
    log.info("order #%s: buy price set", o.id)
    return (f"🛒 Buyurtma #{o.id}: xarid ¥{price:g}, tannarx {format_uzs(o.buy_cost_uzs)}\n"
            f"Foyda: {format_uzs(profit)}" + (f" (rejada {format_uzs(planned)})" if planned is not None else "")
            + ("\n⚠️ Zarar!" if profit < 0 else ""))


def open_orders(session: Session) -> list[Order]:
    return list(session.scalars(select(Order).where(Order.cancelled_at.is_(None), Order.delivered_at.is_(None))
                                .order_by(Order.id)))


# --- stock / leads / expenses / trends ----------------------------------------

def set_stock_cost(session: Session, args: str | None) -> str:
    """/stockcost <SKU> <summa> [oʻlcham]"""
    t = (args or "").split()
    if len(t) < 2:
        raise OrderError("Format: /stockcost <SKU> <summa soʻmda> [oʻlcham]")
    sku, amount, size = t[0], t[1].replace(" ", ""), " ".join(t[2:]) or None
    if not amount.isdigit() or int(amount) <= 0:
        raise OrderError("Summa musbat butun son boʻlishi kerak (soʻm).")
    product = session.scalar(select(Product).where(Product.style_code == sku))
    if product is None:
        raise OrderError(f"SKU {sku} bazada yoʻq.")
    if size:
        match = _match_size(size, [s.size_eu for s in product.sizes])
        rows = [s for s in product.sizes if s.size_eu == match]
    else:
        rows = [s for s in product.sizes if s.stock_qty > 0]
    if not rows:
        raise OrderError(f"{sku}: {'bu oʻlcham yoʻq' if size else 'omborda oʻlcham yoʻq'}.")
    for s in rows:
        s.stock_cost_uzs = int(amount)
    session.flush()
    return f"{sku}: tannarx {format_uzs(int(amount))} — " + ", ".join(f"{s.size_eu} ({s.stock_qty} dona)" for s in rows)


def add_lead(session: Session, args: str | None) -> Lead:
    t = (args or "").split()
    if not t or not t[0].isdigit():
        raise OrderError("Format: /lead <post_id> [oʻlcham]")
    post = session.get(Post, int(t[0]))
    if post is None:
        raise OrderError(f"Post #{t[0]} topilmadi.")
    lead = Lead(product_id=post.product_id, post_id=post.id, size=" ".join(t[1:]) or None)
    session.add(lead)
    session.flush()
    return lead


EXPENSE_TYPES_UZ = {"reklama": "ads", "ads": "ads", "ai": "ai", "server": "server",
                    "menejer": "manager", "manager": "manager", "boshqa": "other", "other": "other"}


def add_expense(session: Session, args: str | None, today: date) -> Expense:
    """/expense <summa> <turi> <izoh>"""
    t = (args or "").split(maxsplit=2)
    if len(t) < 2 or not t[0].replace(" ", "").isdigit() or t[1].lower() not in EXPENSE_TYPES_UZ:
        raise OrderError("Format: /expense <summa soʻmda> <reklama|ai|server|menejer|boshqa> <izoh>")
    e = Expense(date=today, type=EXPENSE_TYPES_UZ[t[1].lower()], amount_uzs=int(t[0]),
                note=t[2] if len(t) > 2 else None)
    session.add(e)
    session.flush()
    return e


def add_trend(session: Session, text: str | None, admin_id: int | None) -> TrendNote:
    if not text or not text.strip():
        raise OrderError("Format: /trend <matn>, masalan: /trend New Balance 530 koʻp soʻralyapti")
    n = TrendNote(text=text.strip(), created_by=admin_id)
    session.add(n)
    session.flush()
    return n
