from datetime import date, datetime, timedelta
from decimal import Decimal

from openpyxl import load_workbook

from app import config
from app.agents import orders
from app.agents.content import create_draft
from app.config import TZ
from app.db.models import Expense, LlmCall, Order
from app.reports import weekly
from tests.helpers import FX, NOW, FakeLlm, make_product

MON = datetime(2026, 11, 16, 9, tzinfo=TZ)          # Monday


def order(db, tmp_path, contact="+998901234567", paid_at=None, **kw):
    p = make_product(db, sku=f"S{db.query(Order).count()}")
    post = create_draft(db, p, FakeLlm(), FX, now=NOW, out_root=tmp_path).post
    post.status = "published"
    req = orders.parse_neworder(f"{post.id} 41 Ali {contact}")
    o = orders.create_order(db, orders.preview_order(db, req, FX, NOW), NOW)
    if paid_at:
        o.prepayment_status, o.admin_confirmed_at = "paid", paid_at
    for k, v in kw.items():
        setattr(o, k, v)
    db.flush()
    return o


def test_periods():
    assert weekly.last_week(MON) == (date(2026, 11, 9), date(2026, 11, 15))
    assert weekly.this_week(MON + timedelta(days=2)) == (date(2026, 11, 16), date(2026, 11, 18))


def test_report_money_and_counts(db, tmp_path, monkeypatch):
    monkeypatch.setitem(config.settings()["trial"], "start", date(2026, 11, 10))
    paid = order(db, tmp_path, paid_at=NOW)
    real = order(db, tmp_path, contact="+998901111111", paid_at=NOW, buy_cost_uzs=500_000)
    order(db, tmp_path, contact="+998902222222")                                  # not paid: no revenue
    order(db, tmp_path, contact="+998903333333", paid_at=NOW, cancelled_at=NOW)   # cancelled
    order(db, tmp_path, contact="+998904444444", problem="oʻlcham: kichik")
    db.add_all([Expense(date=date(2026, 11, 12), type="ads", amount_uzs=300_000, note="Instagram"),
                Expense(date=date(2026, 11, 1), type="ads", amount_uzs=999, note="old")])
    db.add(LlmCall(purpose="content", model="m", input_tokens=1, output_tokens=1, cost_usd=Decimal("1"),
                   created_at=NOW))
    rep = weekly.build(db, date(2026, 11, 9), date(2026, 11, 15), Decimal("12000"))
    assert rep.revenue == paid.sell_price_uzs + real.sell_price_uzs
    assert rep.costs["Reklama"] == 300_000 and rep.costs["AI"] == 12_000
    assert rep.costs[weekly.GOODS] == weekly.order_cost(db, paid) + 500_000
    assert rep.net == rep.revenue - rep.total_costs
    assert (rep.new_orders, rep.cancelled, rep.size_problems) == (5, 1, 1)
    t = weekly.text(rep)
    assert "Tushum" in t and "Qoldi" in t and "ROAS" not in t and "taxminiy" in t
    marks = dict((txt.split(":")[0], m) for m, txt in rep.criteria[1:])
    assert marks["Toʻlangan buyurtmalar"] == "⏳" and marks["Bitta buyurtmaga reklama"] == "✅"
    assert marks["Oʻlcham muammolari"] == "❌"                                  # 1 of 5 = 20%

    ws = load_workbook(weekly.excel(rep, tmp_path / "r.xlsx"))
    cells = " ".join(str(c.value) for sh in ws for row in sh.iter_rows() for c in row)
    assert "Ali" not in cells and "998" not in cells and "Reklama" in cells


def test_problem_command(db, tmp_path):
    o = order(db, tmp_path)
    assert "Muammo: oʻlcham: katta keldi" in orders.set_problem(db, f"{o.id} olcham katta keldi")
    assert weekly.is_size_problem(o)
