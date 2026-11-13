import copy
from datetime import date, datetime
from decimal import Decimal

import httpx
import pytest

from app import config
from app.pricing import rates
from app.pricing.calculator import TZ, calculate

# Fixed config so tests don't break when admin tunes settings.yaml.
S = {
    "pricing": {
        "buyout_fee_pct": 0.05, "buyout_fee_min_usd": 3,
        "ship_rate_per_kg_usd": {"auto": 5.5, "avia": 9.2}, "avia_months": [11, 12, 1],
        "local_delivery_usd": 2, "volumetric_divisor": 6000, "usd_rate_buffer_pct": 0.015,
        "round_to_uzs": 10000, "quote_valid_hours": 24,
    },
    "customs": {
        "duty_free_limit_usd": 200, "customs_value_includes_shipping": False,
        "schedule": [
            {"from": date(2000, 1, 1), "rate": 0.30, "min_per_kg_usd": 3},
            {"from": date(2027, 1, 1), "rate": 0.20, "min_per_kg_usd": 2},
        ],
    },
}
C = {
    "sneakers": {"weight_kg": 1.5, "package_cm": [33, 22, 12], "markup": 0.23, "winter": False},
    "puffer": {"weight_kg": 1.3, "package_cm": [50, 40, 20], "vacuum_packing": False,
               "vacuum_package_cm": [40, 30, 8], "markup": 0.25, "winter": True},
}
NOV = datetime(2026, 11, 14, 12, 0, tzinfo=TZ)


def q(price, cat="sneakers", now=NOV, s=S, c=C, rate=12000, **kw):
    return calculate(price, cat, rate, now=now, settings=s, categories=c, **kw)


def test_basic_sneakers():
    r = q(100)
    b = r.breakdown
    assert b["buyout_fee_usd"] == 5
    assert b["chargeable_weight_kg"] == 1.5  # actual 1.5 > volumetric 1.452
    assert b["shipping_mode"] == "auto"
    assert b["shipping_usd"] == 10.25
    assert b["customs_usd"] == 0
    assert r.landed_cost_usd == Decimal("115.25")
    assert r.usd_rate == Decimal("12180.00")
    # 115.25 * 1.23 * 12180 = 1_726_606.35 -> ceil to 10k
    assert r.sell_price_uzs == 1_730_000
    assert r.warnings == []


def test_buyout_fee_minimum():
    assert q(40).breakdown["buyout_fee_usd"] == 3


@pytest.mark.parametrize("price,duty", [
    (199.99, 0), (200, 0),
    (200.01, 4.5),   # max(0.3*0.01, 3*1.5)
    (300, 30),       # max(0.3*100, 4.5)
])
def test_customs_limit_boundary(price, duty):
    assert q(price).breakdown["customs_usd"] == duty


@pytest.mark.parametrize("day,price,duty", [
    (datetime(2026, 12, 31, 23, 59, tzinfo=TZ), 300, 30),
    (datetime(2027, 1, 1, 0, 0, tzinfo=TZ), 300, 20),
    (datetime(2026, 12, 31, 23, 59, tzinfo=TZ), 201, 4.5),  # min 3/kg
    (datetime(2027, 1, 1, 0, 0, tzinfo=TZ), 201, 3),        # min 2/kg
])
def test_customs_2027_switch(day, price, duty):
    assert q(price, now=day).breakdown["customs_usd"] == duty


def test_customs_value_includes_shipping():
    s = copy.deepcopy(S)
    s["customs"]["customs_value_includes_shipping"] = True
    # 195 + 1.5kg*5.5 = 203.25 > 200 -> min 4.5
    assert q(195, s=s).breakdown["customs_usd"] == 4.5
    assert q(195).breakdown["customs_usd"] == 0


def test_rounding_exact_and_up():
    s = copy.deepcopy(S)
    p = s["pricing"]
    p.update(buyout_fee_pct=0, buyout_fee_min_usd=0, local_delivery_usd=0, usd_rate_buffer_pct=0)
    p["ship_rate_per_kg_usd"] = {"auto": 0, "avia": 0}
    c = copy.deepcopy(C)
    c["sneakers"]["markup"] = 0
    assert q(100, s=s, c=c, rate=12000).sell_price_uzs == 1_200_000
    assert q(100, s=s, c=c, rate="12000.01").sell_price_uzs == 1_210_000


def test_volumetric_and_vacuum_and_avia():
    r = q(150, cat="puffer")
    assert r.breakdown["chargeable_weight_kg"] == 6.67  # 50*40*20/6000 > 1.3
    assert r.breakdown["shipping_mode"] == "avia"       # winter item in November
    c = copy.deepcopy(C)
    c["puffer"]["vacuum_packing"] = True
    assert q(150, cat="puffer", c=c).breakdown["chargeable_weight_kg"] == 1.6
    june = datetime(2026, 6, 1, tzinfo=TZ)
    assert q(150, cat="puffer", now=june).breakdown["shipping_mode"] == "auto"


def test_monthly_aggregation_crosses_limit():
    r = q(100, prior_month_value_usd=150, prior_month_weight_kg=1.5)
    # combined 250: max(0.3*50, 3*3.0)=15, prior alone 0 -> this item pays 15
    assert r.breakdown["customs_usd"] == 15
    assert len(r.warnings) == 1 and "limitdan oshdi" in r.warnings[0]


def test_monthly_aggregation_already_over():
    r = q(100, prior_month_value_usd=250, prior_month_weight_kg=1.5)
    # duty(350, 3.0)=45 minus duty(250, 1.5)=15
    assert r.breakdown["customs_usd"] == 30
    assert r.warnings


def test_monthly_aggregation_under_limit_no_warning():
    r = q(40, prior_month_value_usd=100, prior_month_weight_kg=1.5)
    assert r.breakdown["customs_usd"] == 0 and r.warnings == []


def test_valid_until_24h():
    assert (q(100).valid_until - NOV).total_seconds() == 24 * 3600


def test_bad_input():
    with pytest.raises(config.ConfigError):
        q(100, cat="spaceship")
    with pytest.raises(ValueError):
        q(0)


def test_real_config_all_categories():
    s, cats = config.settings(), config.categories()
    for name in cats:
        r = calculate(120, name, 12000, now=NOV, settings=s, categories=cats)
        assert r.sell_price_uzs > 0 and r.sell_price_uzs % s["pricing"]["round_to_uzs"] == 0


def test_config_missing_key():
    with pytest.raises(config.ConfigError, match="buyout_fee_pct"):
        bad = copy.deepcopy(S) | {"poizon_tos_reviewed": False, "sourcing_mode": "x",
                                  "image_source_policy": "x"}
        del bad["pricing"]["buyout_fee_pct"]
        config.validate(bad, C)


CBU_JSON = [{"Ccy": "USD", "Rate": "11973.44", "Date": "13.11.2026"}]


def client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_cbu_rate_ok():
    def h(req):
        assert req.url.path == "/uz/arkhiv-kursov-valyut/json/USD/2026-11-13/"
        return httpx.Response(200, json=CBU_JSON)
    assert rates.fetch_usd_rate(date(2026, 11, 13), client(h)) == Decimal("11973.44")


def test_cbu_rate_errors():
    with pytest.raises(httpx.HTTPStatusError):
        rates.fetch_usd_rate(date(2026, 11, 13), client(lambda r: httpx.Response(500)))
    with pytest.raises(ValueError):
        rates.fetch_usd_rate(date(2026, 11, 13), client(lambda r: httpx.Response(200, json=[])))
