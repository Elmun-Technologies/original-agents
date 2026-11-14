from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from app.agents import orders
from app.agents.content import create_draft, post_quotes
from app.agents.orders import OrderError, apply_action, create_order, parse_neworder, preview_order
from app.config import TZ
from app.db.models import Expense, Lead, Order, TrendNote
from app.pricing.rates import Rate
from tests.helpers import FX, NOW, FakeLlm, make_product

PHONE = "+998901234567"


def published(db, tmp_path, stock=False, **kw):
    p = make_product(db, **kw)
    d = create_draft(db, p, FakeLlm(), FX, now=NOW, out_root=tmp_path, stock=stock)
    d.post.status = "published"
    db.flush()
    return d.post, p


def order(db, post, size, contact=PHONE, now=NOW, args=""):
    req = parse_neworder(f"{post.id} {size} Ali Valiyev {contact} {args}")
    pv = preview_order(db, req, FX, now)
    return pv, create_order(db, pv, now)


# --- contacts / parsing ---

@pytest.mark.parametrize("raw,norm", [
    ("+998 90 123 45 67", PHONE), ("901234567", PHONE), ("998901234567", PHONE), ("(90) 123-45-67", PHONE),
    ("@Ali_Valiyev", "@ali_valiyev"), ("+7 916 123 45 67", "+79161234567"), ("12345", None), ("ali", None),
])
def test_normalize_contact(raw, norm):
    assert orders.normalize_contact(raw) == norm


def test_mask_contact():
    assert orders.mask_contact(PHONE) == "+99890*****67"
    assert orders.mask_contact("@ali_valiyev") == "@al***"


@pytest.mark.parametrize("args,expected", [
    ("12 42.5 Ali Valiyev +998 90 123 45 67", (12, "42.5", "Ali Valiyev", PHONE, Decimal(0), None)),
    ("12 42,5 Ali 901234567", (12, "42.5", "Ali", PHONE, Decimal(0), None)),
    ("7 40 2/3 Dilnoza @dilnoza_k ext=120 novac", (7, "40 2/3", "Dilnoza", "@dilnoza_k", Decimal(120), False)),
    ("7 m Sardor Karimov 99 888 77 66", (7, "M", "Sardor Karimov", "+998998887766", Decimal(0), None)),
])
def test_parse_neworder(args, expected):
    r = parse_neworder(args)
    assert (r.post_id, r.size, r.name, r.contact, r.external_usd, r.vacuum) == expected


@pytest.mark.parametrize("args,msg", [
    ("", "Format"), ("12 42 Ali", "Format"), ("12 42 Ali Valiyev noPhone", "topilmadi"),
("x 42 Ali +998901234567", "Format"), ("12 42 Ali 901234567 ext=-5", "manfiy"),
])
def test_parse_neworder_errors(args, msg):
    with pytest.raises(OrderError, match=msg):
        parse_neworder(args)


# --- preview / create ---

def test_valid_posted_quote_is_reused(db, tmp_path):
    post, p = published(db, tmp_path)
    posted = {q.size: q for q in post_quotes(db, post)}
    pv, o = order(db, post, "42,5")
    assert pv.reuse_quote is posted["42.5"] and pv.warnings == []
    assert (o.quote_id, o.sell_price_uzs, o.size) == (posted["42.5"].id, posted["42.5"].sell_price_uzs, "42.5")
    assert o.customer_contact == PHONE and o.prepayment_status == "awaiting_prepayment" and not o.from_stock
    assert o.customs_value_usd == Decimal("76.35")  # 509 CNY * 1800 / 12000


def test_draft_post_cannot_be_ordered(db, tmp_path):
    post, _ = published(db, tmp_path)
    post.status = "draft"
    with pytest.raises(OrderError, match="tasdiqlanmagan"):
        order(db, post, "41")


def test_unknown_size(db, tmp_path):
    post, _ = published(db, tmp_path)
    with pytest.raises(OrderError, match="44 oʻlcham yoʻq"):
        order(db, post, "44")


def test_expired_quote_recalculated(db, tmp_path):
    post, _ = published(db, tmp_path)
    pv = preview_order(db, parse_neworder(f"{post.id} 41 Ali {PHONE}"), FX, NOW + timedelta(hours=25))
    assert pv.reuse_quote is None and any("muddati oʻtgan" in w for w in pv.warnings)
    o = create_order(db, pv, NOW + timedelta(hours=25))
    assert o.quote_id not in {q.id for q in post_quotes(db, post)}


def test_monthly_limit_same_recipient(db, tmp_path):
    post, _ = published(db, tmp_path, sizes=(("42", 1300),))       # $195 each, under $200 alone
    _, first = order(db, post, "42")
    assert first.customs_value_usd == Decimal("195.00")
    pv, second = order(db, post, "42")                             # same phone, same month: $390 total
    assert pv.reuse_quote is None and second.sell_price_uzs > first.sell_price_uzs
    assert any("limitdan oshdi" in w for w in pv.warnings) and any("farq qiladi" in w for w in pv.warnings)
    assert pv.new_quote.breakdown["customs_usd"] == 57.0           # 0.3 * (390 - 200)


def test_monthly_limit_other_recipient_cancelled_or_next_month(db, tmp_path):
    post, _ = published(db, tmp_path, sizes=(("42", 1300),))
    _, first = order(db, post, "42")
    assert order(db, post, "42", contact="@someone_else")[0].reuse_quote is not None
    first.cancelled_at = NOW
    assert order(db, post, "42")[0].reuse_quote is not None        # cancelled orders don't count


def test_month_is_tashkent_calendar_month(db, tmp_path):
    post, product = published(db, tmp_path, sizes=(("42", 1300),))
    late = datetime(2026, 11, 30, 23, 30, tzinfo=TZ)                # = 18:30 UTC, still November
    product.sizes[0].checked_at = late                             # fresh price: no stale buffer
    order(db, post, "42", now=late)
    assert orders.month_totals(db, PHONE, datetime(2026, 11, 30, 23, 50, tzinfo=TZ))[0] == Decimal("195.00")
    assert orders.month_totals(db, PHONE, datetime(2026, 12, 1, 0, 10, tzinfo=TZ))[0] == 0


def test_external_parcels_count(db, tmp_path):
    post, _ = published(db, tmp_path, sizes=(("42", 1300),))
    pv, o = order(db, post, "42", args="ext=120")
    assert pv.new_quote.breakdown["customs_usd"] == pytest.approx(34.5)   # 0.3 * (315 - 200)
    assert o.external_parcels_usd == 120


def test_no_vacuum_recalculates(db, tmp_path):
    post, _ = published(db, tmp_path, sku="TNF1", brand="TNF", model="Nuptse", category="puffer",
                        sizes=(("M", 1599),))
    pv, o = order(db, post, "M", args="novac")
    posted = post_quotes(db, post)[0]
    assert o.vacuum_packing is False and o.sell_price_uzs > posted.sell_price_uzs
    assert pv.new_quote.breakdown["chargeable_weight_kg"] == 6.67


# --- stock ---

def stock_post(db, tmp_path, qty=1, cost=1_000_000):
    p = make_product(db, sku="STK1", sizes=(("42", 489),))
    p.sizes[0].stock_qty, p.sizes[0].stock_cost_uzs = qty, cost
    d = create_draft(db, p, FakeLlm(), FX, now=NOW, out_root=tmp_path, stock=True)
    d.post.status = "published"
    db.flush()
    return d.post, p


def test_stock_post_price_and_text(db, tmp_path):
    post, _ = stock_post(db, tmp_path)
    q = post_quotes(db, post)[0]
    assert q.sell_price_uzs == 1_300_000 and q.breakdown["stock"] is True     # 1 000 000 * 1.30
    assert "Mavjud · 1 kunda yetkazamiz" in post.caption_uz and "20–30" not in post.caption_uz


def test_stock_order_reserves_and_cancel_restores(db, tmp_path):
    post, p = stock_post(db, tmp_path)
    pv, o = order(db, post, "42")
    assert o.from_stock and (o.buyout_status, o.shipping_status) == ("bought", "in_tashkent")
    assert o.customs_value_usd == 0 and p.sizes[0].stock_qty == 0
    with pytest.raises(OrderError, match="qolmagan"):
        order(db, post, "42")
    apply_action(db, o, "cancel", NOW)
    assert p.sizes[0].stock_qty == 1 and o.cancelled_at is not None


def test_stock_order_ignores_monthly_limit(db, tmp_path):
    post, _ = stock_post(db, tmp_path, qty=2)
    order(db, post, "42")
    assert order(db, post, "42")[0].warnings == []


# --- statuses ---

def test_status_flow(db, tmp_path):
    post, _ = published(db, tmp_path)
    _, o = order(db, post, "41")
    with pytest.raises(OrderError, match="mumkin emas"):
        apply_action(db, o, "bought", NOW)
    seen = []
    while acts := [a for a, _ in orders.next_actions(o) if a not in ("cancel", "stock")]:
        apply_action(db, o, acts[0], NOW)
        seen.append(o.shipping_status if acts[0] == "ship" else acts[0])
    assert seen == ["paid", "bought", "in_china_warehouse", "shipped", "in_tashkent", "delivered"]
    assert o.delivered_at is not None and "cancel" not in dict(orders.next_actions(o))
    assert "yetkazildi" in orders.order_text(db, o)


def test_to_stock_sets_cost_from_order_quote(db, tmp_path):
    post, p = published(db, tmp_path)
    _, o1 = order(db, post, "41")
    _, o2 = order(db, post, "41", contact="@other_client")
    for o in (o1, o2):
        for a in ("paid", "bought", "ship", "ship", "ship"):
            apply_action(db, o, a, NOW)
    q = db.get(orders.Quote, o1.quote_id)
    unit = int(Decimal(q.landed_cost_usd) * Decimal(q.usd_rate))
    apply_action(db, o1, "stock", NOW)
    ps = next(s for s in p.sizes if s.size_eu == "41")
    assert (ps.stock_qty, ps.stock_cost_uzs) == (1, unit) and o1.cancelled_at is not None
    ps.stock_cost_uzs = unit + 100_000                       # admin corrected the first unit
    apply_action(db, o2, "stock", NOW)
    assert (ps.stock_qty, ps.stock_cost_uzs) == (2, unit + 50_000)   # weighted average


def test_set_stock_cost(db):
    p = make_product(db, sku="STK2", sizes=(("41", 1), ("42", 1)))
    p.sizes[1].stock_qty = 1
    assert "42 (1 dona)" in orders.set_stock_cost(db, "STK2 1500000")
    assert p.sizes[1].stock_cost_uzs == 1_500_000 and p.sizes[0].stock_cost_uzs is None
    orders.set_stock_cost(db, "STK2 900000 41")
    assert p.sizes[0].stock_cost_uzs == 900_000
    for bad, msg in [("", "Format"), ("NOPE 100", "yoʻq"), ("STK2 abc", "musbat"), ("STK2 100 47", "yoʻq")]:
        with pytest.raises(OrderError, match=msg):
            orders.set_stock_cost(db, bad)


def test_lead_expense_trend(db, tmp_path):
    post, _ = published(db, tmp_path)
    lead = orders.add_lead(db, f"{post.id} 42")
    assert (lead.post_id, lead.size, lead.status) == (post.id, "42", "new")
    e = orders.add_expense(db, "150000 reklama Instagram target", NOW.date())
    assert (e.type, e.amount_uzs, e.note) == ("ads", 150000, "Instagram target")
    with pytest.raises(OrderError):
        orders.add_expense(db, "150000 kripto", NOW.date())
    with pytest.raises(OrderError):
        orders.add_lead(db, "999")
    assert orders.add_trend(db, "New Balance 530 koʻp soʻralyapti", 1).text.startswith("New Balance")
    assert db.query(Lead).count() == 1 and db.query(Expense).count() == 1 and db.query(TrendNote).count() == 1
