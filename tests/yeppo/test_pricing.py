from decimal import Decimal

from yeppo_agents.pricing import quote

P = {"ship_rate_per_kg_usd": 10, "weight_kg_default": 0.2, "weight_kg_by_category": {"serum": 0.1},
     "customs_pct": 0.1, "local_delivery_usd": 0, "markup": 0.3, "usd_rate_buffer_pct": 0, "round_to_uzs": 1000}


def test_formula_and_rounding():
    q = quote(Decimal("20"), "serum", Decimal("12000"), P)
    # 20 + 1 shipping + 2.1 customs = 23.1 landed; *1.3*12000 = 360 360 -> 361 000
    assert q.shipping_usd == Decimal("1.0") and q.landed_usd == Decimal("23.1")
    assert q.sell_uzs == 361000
    assert q.profit_uzs == 361000 - 277200


def test_default_weight_for_unknown_category():
    assert quote(Decimal("10"), None, Decimal("12000"), P).weight_kg == Decimal("0.2")


def test_exact_multiple_not_rounded_up():
    p = {**P, "customs_pct": 0, "markup": 0, "weight_kg_by_category": {}, "weight_kg_default": 0}
    assert quote(Decimal("10"), None, Decimal("12000"), p).sell_uzs == 120000
