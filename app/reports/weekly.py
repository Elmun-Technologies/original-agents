"""Weekly report (CLAUDE.md §8): plain language, "how much we spent / how much came in".

- Tushum: price of orders whose payment the admin confirmed in the period (not cancelled).
- Goods + shipping + customs for those orders: the real /buyprice cost if entered, else the
  quote's landed cost; stock orders use the stock cost.
- Other expenses: the expenses table by type (AI spend is rolled up from llm_calls first).
- No ROAS or other ratios except the trial criteria from settings.yaml (trial).
The Excel file has no customer names or contacts (CLAUDE.md §2).
"""
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from openpyxl import Workbook
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import config
from app.agents.content import display_model
from app.agents.orders import STATUS_UZ
from app.config import TZ
from app.db.models import Expense, Lead, Order, Product, Quote
from app.llm import rollup_expenses
from app.uz import format_uzs

EXPENSE_LABELS = {"ads": "Reklama", "ai": "AI", "server": "Server", "manager": "Menejer", "other": "Boshqa"}
GOODS = "Tovar + yetkazish + bojxona"


def last_week(now: datetime) -> tuple[date, date]:
    monday = now.astimezone(TZ).date() - timedelta(days=now.astimezone(TZ).weekday())
    return monday - timedelta(days=7), monday - timedelta(days=1)


def this_week(now: datetime) -> tuple[date, date]:
    today = now.astimezone(TZ).date()
    return today - timedelta(days=today.weekday()), today


def utc_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    return (datetime.combine(start, time(), TZ).astimezone(timezone.utc),
            datetime.combine(end + timedelta(days=1), time(), TZ).astimezone(timezone.utc))


def order_cost(session: Session, o: Order) -> int:
    if o.buy_cost_uzs is not None:
        return o.buy_cost_uzs
    q = session.get(Quote, o.quote_id)
    if o.from_stock and q.breakdown.get("stock_cost_uzs") is not None:
        return int(q.breakdown["stock_cost_uzs"])
    return int(Decimal(q.landed_cost_usd) * Decimal(q.usd_rate))


def is_size_problem(o: Order) -> bool:
    return (o.problem or "").casefold().startswith(("oʻlcham", "o'lcham", "olcham"))


@dataclass
class Report:
    start: date
    end: date
    revenue: int = 0
    paid: list[Order] = field(default_factory=list)
    costs: dict[str, int] = field(default_factory=dict)       # label -> UZS
    new_orders: int = 0
    cancelled: int = 0
    size_problems: int = 0
    top: list[tuple[str, int]] = field(default_factory=list)
    criteria: list[tuple[str, str]] = field(default_factory=list)  # (mark, text)
    order_rows: list[list] = field(default_factory=list)
    expense_rows: list[list] = field(default_factory=list)

    @property
    def total_costs(self) -> int:
        return sum(self.costs.values())

    @property
    def net(self) -> int:
        return self.revenue - self.total_costs


def expenses(session: Session, start: date, end: date) -> list[Expense]:
    return list(session.scalars(select(Expense).where(Expense.date >= start, Expense.date <= end)
                                .order_by(Expense.date, Expense.id)))


def trial_criteria(session: Session, upto: date, usd_rate: Decimal) -> list[tuple[str, str]]:
    t = config.settings()["trial"]
    start = t["start"] if isinstance(t["start"], date) else date.fromisoformat(str(t["start"]))
    last = start + timedelta(days=t["days"] - 1)
    end = min(last, upto)
    if end < start:
        return []
    finished = upto >= last
    lo, hi = utc_bounds(start, end)
    paid = session.scalars(select(Order).where(Order.cancelled_at.is_(None), Order.prepayment_status == "paid",
                                               Order.admin_confirmed_at >= lo, Order.admin_confirmed_at < hi)).all()
    made = session.scalars(select(Order).where(Order.created_at >= lo, Order.created_at < hi)).all()
    ads = sum(e.amount_uzs for e in expenses(session, start, end) if e.type == "ads")
    wait = "⏳"
    out = [(f"Sinov: {start:%d.%m}–{last:%d.%m.%Y}, {(end - start).days + 1}-kun"
            + (" (tugadi)" if finished else ""), "")]
    n, need = len(paid), t["paid_orders_min"]
    out.append(("✅" if n >= need else ("❌" if finished else wait), f"Toʻlangan buyurtmalar: {n} / {need}"))
    cap = t["ads_per_order_max_uzs"]
    if paid:
        per = ads // len(paid)
        out.append(("✅" if per <= cap else "❌", f"Bitta buyurtmaga reklama: {format_uzs(per)} (chegara {format_uzs(cap)})"))
    else:
        out.append(("❌" if ads and finished else wait,
                    f"Bitta buyurtmaga reklama: hali buyurtma yoʻq (reklama {format_uzs(ads)})"))
    sizes = sum(is_size_problem(o) for o in made)
    pct = sizes / len(made) if made else 0
    limit = t["size_problem_max_pct"]
    out.append(("✅" if pct < limit else "❌", f"Oʻlcham muammolari: {pct:.0%} ({sizes} / {len(made)}, chegara {limit:.0%} dan kam)"))
    return out


def build(session: Session, start: date, end: date, usd_rate: Decimal) -> Report:
    rep = Report(start, end)
    lo, hi = utc_bounds(start, end)
    d = start
    while d <= end:  # AI spend into expenses (idempotent)
        rollup_expenses(session, d, usd_rate)
        d += timedelta(days=1)

    rep.paid = list(session.scalars(select(Order).where(
        Order.cancelled_at.is_(None), Order.prepayment_status == "paid",
        Order.admin_confirmed_at >= lo, Order.admin_confirmed_at < hi).order_by(Order.id)))
    rep.revenue = sum(o.sell_price_uzs for o in rep.paid)
    rep.costs = {GOODS: sum(order_cost(session, o) for o in rep.paid)} | {v: 0 for v in EXPENSE_LABELS.values()}
    for e in expenses(session, start, end):
        rep.costs[EXPENSE_LABELS[e.type]] += e.amount_uzs
        rep.expense_rows.append([e.date, EXPENSE_LABELS[e.type], e.amount_uzs, e.note or ""])

    made = list(session.scalars(select(Order).where(Order.created_at >= lo, Order.created_at < hi)))
    rep.new_orders = len(made)
    rep.cancelled = session.query(Order).filter(Order.cancelled_at >= lo, Order.cancelled_at < hi,
                                                or_(Order.notes.is_(None), ~Order.notes.contains("Omborga"))).count()
    rep.size_problems = sum(is_size_problem(o) for o in made)

    asked: dict[int, int] = {}
    for pid in [o.product_id for o in made] + list(session.scalars(
            select(Lead.product_id).where(Lead.created_at >= lo, Lead.created_at < hi))):
        asked[pid] = asked.get(pid, 0) + 1
    for pid, n in sorted(asked.items(), key=lambda x: -x[1])[:5]:
        p = session.get(Product, pid)
        rep.top.append((f"{p.brand} {display_model(p)}", n))

    for o in rep.paid:
        p = session.get(Product, o.product_id)
        cost = order_cost(session, o)
        rep.order_rows.append([o.id, o.admin_confirmed_at.astimezone(TZ).date(), f"{p.brand} {display_model(p)}",
                               p.style_code, o.size, o.sell_price_uzs, cost, o.sell_price_uzs - cost,
                               "ha" if o.buy_cost_uzs is not None else "yoʻq (taxminiy)",
                               STATUS_UZ[o.shipping_status], o.problem or ""])
    rep.criteria = trial_criteria(session, end, usd_rate)
    session.flush()
    return rep


def text(rep: Report) -> str:
    lines = [f"📈 Hisobot: {rep.start:%d.%m}–{rep.end:%d.%m.%Y}", "",
             f"💰 Tushum: {format_uzs(rep.revenue)} ({len(rep.paid)} ta toʻlangan buyurtma)",
             f"💸 Xarajatlar: {format_uzs(rep.total_costs)}"]
    lines += [f"  • {k}: {format_uzs(v)}" for k, v in rep.costs.items() if v or k == GOODS]
    lines.append(f"🟰 Qoldi: {format_uzs(rep.net)}" if rep.net >= 0 else f"🔻 Zarar: {format_uzs(-rep.net)}")
    if any(r[8] != "ha" for r in rep.order_rows):
        lines.append("  (tovar narxi /buyprice kiritilmagan buyurtmalarda taxminiy)")
    lines += ["", f"📦 Buyurtmalar: {rep.new_orders} ta yangi, {rep.cancelled} ta bekor qilindi, "
                  f"{rep.size_problems} ta oʻlcham muammosi"]
    if rep.top:
        lines += ["", "🔥 Eng koʻp soʻralgan:"] + [f"  {i}. {name} — {n} marta" for i, (name, n) in enumerate(rep.top, 1)]
    if rep.criteria:
        lines += ["", "🎯 " + rep.criteria[0][1]] + [f"  {mark} {t}" for mark, t in rep.criteria[1:]]
    return "\n".join(lines)


def excel(rep: Report, path: Path) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.title = "Xulosa"
    ws.append(["Davr", f"{rep.start:%d.%m.%Y} – {rep.end:%d.%m.%Y}"])
    ws.append(["Tushum, soʻm", rep.revenue])
    for k, v in rep.costs.items():
        ws.append([f"{k}, soʻm", v])
    ws.append(["Xarajatlar jami, soʻm", rep.total_costs])
    ws.append(["Qoldi, soʻm", rep.net])
    ws.append(["Yangi buyurtmalar", rep.new_orders])
    ws.append(["Bekor qilingan", rep.cancelled])
    ws.append(["Oʻlcham muammolari", rep.size_problems])
    for mark, t in rep.criteria[1:]:
        ws.append([t, {"✅": "bajarildi", "❌": "bajarilmadi", "⏳": "jarayonda"}[mark]])
    ws.column_dimensions["A"].width = 60
    ws.column_dimensions["B"].width = 25

    wo = wb.create_sheet("Buyurtmalar")  # no customer name/contact
    wo.append(["#", "Toʻlov sanasi", "Model", "SKU", "Oʻlcham", "Narx, soʻm", "Tannarx, soʻm", "Foyda, soʻm",
               "Haqiqiy xarid narxi", "Yetkazish", "Muammo"])
    for r in rep.order_rows:
        wo.append(r)
    we = wb.create_sheet("Xarajatlar")
    we.append(["Sana", "Turi", "Summa, soʻm", "Izoh"])
    for r in rep.expense_rows:
        we.append(r)
    for sheet in (wo, we):
        for col in "ABCDEFGHIJK":
            sheet.column_dimensions[col].width = 18
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
    return path
