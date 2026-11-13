from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import config, llm
from app.config import TZ
from app.db.models import Expense, LlmCall, Order, Product, ProductSize, Quote, utcnow

NOW = datetime(2026, 11, 14, 12, tzinfo=TZ)
CFG = {"llm": {
    "daily_budget_usd": 5, "max_tokens": 16000, "effort": "medium", "refusal_fallback": True,
    "prices_per_mtok": {"claude-opus-5-5": {"input": 4, "output": 20, "cache_write": 5, "cache_read": 0.2},
                        "claude-opus-4-8": {"input": 5, "output": 25, "cache_write": 6.25, "cache_read": 0.5}},
    "pii_allowlist": ["@poizon_uz"],
}}


def response(text="Salom", stop="end_turn", model="claude-opus-5-5", inp=1000, out=500, cw=0, cr=0, category=None):
    return SimpleNamespace(
        model=model, stop_reason=stop, _request_id="req_1",
        stop_details=SimpleNamespace(category=category) if stop == "refusal" else None,
        content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=text)],
        usage=SimpleNamespace(input_tokens=inp, output_tokens=out,
                              cache_creation_input_tokens=cw, cache_read_input_tokens=cr))


class FakeClient:
    def __init__(self, *responses):
        self.responses, self.calls = list(responses), []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **kw):
        self.calls.append(kw)
        return self.responses.pop(0)


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "claude-opus-5-5")


@pytest.fixture
def factory(db):
    return sessionmaker(bind=db.get_bind())


def make(factory, client, alerts=None):
    return llm.Llm(factory, client=client, settings=CFG,
                   alert=(alerts.append if alerts is not None else None))


# --- request shape ---

def test_request_shape_caching_effort_fallback(env, factory):
    c = FakeClient(response("Post matni"))
    out = make(factory, c).complete("content", "STABLE SYSTEM PROMPT", "Nike Dunk Low, EU 42", now=NOW)
    assert out == "Post matni"
    kw = c.calls[0]
    assert kw["model"] == "claude-opus-5-5"   # from env
    assert kw["system"] == [{"type": "text", "text": "STABLE SYSTEM PROMPT",
                             "cache_control": {"type": "ephemeral"}}]
    assert kw["messages"] == [{"role": "user", "content": "Nike Dunk Low, EU 42"}]
    assert kw["output_config"] == {"effort": "medium"}
    assert kw["betas"] == [llm.FALLBACK_BETA] and kw["fallbacks"] == "default"
    assert "thinking" not in kw and "temperature" not in kw


def test_model_must_come_from_env(monkeypatch, factory):
    monkeypatch.delenv("LLM_MODEL", raising=False)
    with pytest.raises(config.ConfigError, match="LLM_MODEL"):
        make(factory, FakeClient()).complete("content", "s", "u", now=NOW)


def test_unpriced_model_refused_before_call(monkeypatch, factory):
    monkeypatch.setenv("LLM_MODEL", "claude-mystery-9")
    c = FakeClient()
    with pytest.raises(config.ConfigError, match="no price"):
        make(factory, c).complete("content", "s", "u", now=NOW)
    assert c.calls == []


# --- cost / logging ---

def test_call_recorded_with_cost_no_text(env, factory, db):
    c = FakeClient(response(inp=1000, out=500, cw=2000, cr=10000))
    make(factory, c).complete("content", "s", "secret product text", now=NOW)
    row = db.scalar(select(LlmCall))
    # 1000*4 + 500*20 + 2000*5 + 10000*0.2 = 26000 per 1M -> $0.026
    assert row.cost_usd == Decimal("0.026000")
    assert (row.purpose, row.model, row.cache_read_tokens, row.request_id) == ("content", "claude-opus-5-5", 10000, "req_1")
    assert not any("secret" in str(v) for v in vars(row).values())


def test_fallback_model_costed_at_its_own_price(env, factory, db):
    make(factory, FakeClient(response(model="claude-opus-4-8", inp=1_000_000, out=0))).complete("c", "s", "u", now=NOW)
    assert db.scalar(select(LlmCall.cost_usd)) == Decimal("5.000000")


def test_refusal_and_truncation_raise_but_are_recorded(env, factory, db):
    with pytest.raises(llm.LlmRefused, match="cyber"):
        make(factory, FakeClient(response(stop="refusal", category="cyber"))).complete("c", "s", "u", now=NOW)
    with pytest.raises(llm.LlmError, match="max_tokens"):
        make(factory, FakeClient(response(stop="max_tokens"))).complete("c", "s", "u", now=NOW)
    assert db.query(LlmCall).count() == 2  # billed, so counted toward the budget


# --- daily budget ---

def add_spend(db, usd, when=None):
    db.add(LlmCall(purpose="x", model="claude-opus-5-5", input_tokens=0, output_tokens=0,
                   cost_usd=Decimal(str(usd)), created_at=(when or NOW).astimezone(timezone.utc)))
    db.commit()


def test_budget_blocks_and_alerts_once(env, factory, db):
    add_spend(db, 5)
    alerts, c = [], FakeClient()
    client = make(factory, c, alerts)
    for _ in range(3):
        with pytest.raises(llm.LlmBudgetExceeded, match="limiti"):
            client.complete("c", "s", "u", now=NOW)
    assert c.calls == [] and len(alerts) == 1


def test_alert_when_a_call_crosses_the_budget(env, factory, db):
    add_spend(db, 4.99)
    alerts = []
    make(factory, FakeClient(response(inp=10_000, out=0)), alerts).complete("c", "s", "u", now=NOW)  # +$0.04
    assert len(alerts) == 1 and "tugadi" in alerts[0]


def test_budget_is_per_tashkent_day(env, factory, db):
    # 23:30 Tashkent yesterday = 18:30 UTC: belongs to yesterday, not today
    add_spend(db, 10, datetime(2026, 11, 13, 23, 30, tzinfo=TZ))
    assert llm.spent_usd(db, date(2026, 11, 13)) == Decimal(10)
    assert llm.spent_usd(db, date(2026, 11, 14)) == 0
    assert make(factory, FakeClient(response())).complete("c", "s", "u", now=NOW) == "Salom"
    # 00:10 Tashkent today = 19:10 UTC yesterday: belongs to today
    add_spend(db, 7, datetime(2026, 11, 14, 0, 10, tzinfo=TZ))
    assert llm.spent_usd(db, date(2026, 11, 14)) > 5


def test_rollup_expenses_idempotent(db):
    add_spend(db, "1.25")
    add_spend(db, "0.75")
    row = llm.rollup_expenses(db, date(2026, 11, 14), Decimal("12000"))
    assert (row.type, row.amount_uzs) == ("ai", 24000)
    add_spend(db, "1")
    llm.rollup_expenses(db, date(2026, 11, 14), Decimal("12000"))
    rows = db.scalars(select(Expense)).all()
    assert len(rows) == 1 and rows[0].amount_uzs == 36000
    assert llm.rollup_expenses(db, date(2026, 11, 1), Decimal("12000")) is None


# --- PII guard ---

@pytest.mark.parametrize("text,kind", [
    ("Mijoz +998 90 123 45 67 so'radi", "telefon"),
    ("tel: 998901234567", "telefon"),
    ("901234567 ga qo'ng'iroq", "telefon"),
    ("(90) 123-45-67", "telefon"),
    ("93.123.45.67", "telefon"),
    ("71 234 56 78", "telefon"),
    ("+7 916 123-45-67", "telefon"),
    ("ali.valiyev@gmail.com", "email"),
    ("Telegram: @ali_valiyev", "username"),
    ("Chilonzor, Bunyodkor ko'chasi 12", "manzil"),
    ("kv. 45", "manzil"),
    ("ул. Навои дом 5", "manzil"),
    ("улица 3", "manzil"),
])
def test_pii_detected(text, kind):
    assert kind in llm.find_pii(text)


@pytest.mark.parametrize("text", [
    "Nike Dunk Low Retro, style DD1391-100, EU 42.5",
    "Narxi 1 730 000 so'm, yetkazish 20–30 kun",
    "Air Max 90, New Balance 990v6, 2002R",
    "Jordan 1 Retro High OG DZ5485-612, 1299 CNY",
    "Puxovik 700-fill, EU 40 2/3",
    "Buyurtma uchun @poizon_uz ga yozing",   # our own handle, allowlisted
    "uy kiyimi uchun qulay",
])
def test_product_text_is_clean(text):
    assert llm.find_pii(text, allowlist=["@poizon_uz"]) == []


def test_known_customer_name_detected_as_word():
    known = ["Dilnoza Karimova", "Ali"]
    assert llm.find_pii("Buyurtmachi: dilnoza karimova", known) == ["ism/kontakt"]
    assert llm.find_pii("Buyurtmachi Ali", known) == ["ism/kontakt"]
    assert llm.find_pii("Quality Alife sneakers", known) == []   # not a whole word


def seed_order(db, name, contact):
    p = Product(source="manual_sheet", brand="NB", model_name="530", style_code="X", category="sneakers",
                sizes=[ProductSize(size_eu="42", source_price=1, source_currency="USD")])
    db.add(p)
    db.flush()
    q = Quote(product_id=p.id, size="42", landed_cost_usd=1, sell_price_uzs=1, usd_rate=1,
              valid_until=utcnow() + timedelta(hours=24), breakdown={})
    db.add(q)
    db.flush()
    db.add(Order(product_id=p.id, quote_id=q.id, size="42", sell_price_uzs=1, customer_name=name,
                 customer_contact=contact, customs_value_usd=1, weight_kg=1))
    db.commit()


def test_guard_blocks_call_with_customer_data_from_db(env, factory, db, caplog):
    seed_order(db, "Dilnoza Karimova", "+998901234567")
    c = FakeClient(response())
    with pytest.raises(llm.PiiError) as e:
        make(factory, c).complete("demand", "s", "Eng faol mijoz: Dilnoza Karimova", now=NOW)
    assert c.calls == []                                   # nothing sent
    assert "Dilnoza" not in str(e.value) and "Dilnoza" not in caplog.text  # value never logged
    with pytest.raises(llm.PiiError, match="telefon"):
        make(factory, c).complete("demand", "s", "Raqam: 90 123 45 67", now=NOW)
    assert c.calls == []
