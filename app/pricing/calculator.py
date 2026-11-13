"""Price formula (CLAUDE.md §6.3). Pure code, no LLM, no I/O. All numbers come from config."""
import math
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from app import config

TZ = ZoneInfo("Asia/Tashkent")


def D(x) -> Decimal:
    return x if isinstance(x, Decimal) else Decimal(str(x))


@dataclass(frozen=True)
class Quote:
    category: str
    source_price_usd: Decimal
    landed_cost_usd: Decimal
    sell_price_uzs: int
    usd_rate: Decimal
    valid_until: datetime
    customs_value_usd: Decimal  # caller sums these per recipient/month for the $200 limit
    weight_kg: Decimal          # actual weight, also summed per recipient/month
    breakdown: dict
    warnings: list[str]


def chargeable_weight(cat: dict, divisor) -> Decimal:
    dims = cat["vacuum_package_cm"] if cat.get("vacuum_packing") else cat["package_cm"]
    volumetric = D(dims[0]) * D(dims[1]) * D(dims[2]) / D(divisor)
    return max(D(cat["weight_kg"]), volumetric)


def shipping_mode(cat: dict, month: int, avia_months: list[int]) -> str:
    return "avia" if cat["winter"] and month in avia_months else "auto"


def customs_rule(schedule: list[dict], on: date) -> dict:
    rules = [r for r in sorted(schedule, key=lambda r: r["from"]) if r["from"] <= on]
    if not rules:
        raise config.ConfigError(f"no customs rule for {on}")
    return rules[-1]


def customs_duty(value_usd: Decimal, weight_kg: Decimal, limit_usd, rule: dict) -> Decimal:
    # TODO(admin): confirm with broker — duty on excess over limit, min per kg of actual weight.
    if value_usd <= D(limit_usd):
        return Decimal(0)
    return max(D(rule["rate"]) * (value_usd - D(limit_usd)), D(rule["min_per_kg_usd"]) * weight_kg)


def calculate(
    source_price_usd,
    category: str,
    cbu_rate,
    *,
    now: datetime | None = None,
    prior_month_value_usd=0,
    prior_month_weight_kg=0,
    settings: dict | None = None,
    categories: dict | None = None,
) -> Quote:
    """prior_month_*: customs value / actual weight of this recipient's other orders this
    calendar month. The $200 limit is per recipient per month, so this item pays the
    *additional* duty the combined parcel triggers."""
    s = settings or config.settings()
    cats = categories or config.categories()
    if category not in cats:
        raise config.ConfigError(f"unknown category: {category}")
    p, c, cat = s["pricing"], s["customs"], cats[category]
    now = now or datetime.now(TZ)
    price = D(source_price_usd)
    if price <= 0:
        raise ValueError(f"source price must be positive, got {price}")

    buyout_fee = max(price * D(p["buyout_fee_pct"]), D(p["buyout_fee_min_usd"]))

    mode = shipping_mode(cat, now.month, p["avia_months"])
    ch_weight = chargeable_weight(cat, p["volumetric_divisor"])
    intl_shipping = ch_weight * D(p["ship_rate_per_kg_usd"][mode])
    shipping = intl_shipping + D(p["local_delivery_usd"])

    weight = D(cat["weight_kg"])
    value = price + (intl_shipping if c["customs_value_includes_shipping"] else 0)
    rule = customs_rule(c["schedule"], now.date())
    prior_v, prior_w = D(prior_month_value_usd), D(prior_month_weight_kg)
    limit = c["duty_free_limit_usd"]
    customs = (customs_duty(prior_v + value, prior_w + weight, limit, rule)
               - customs_duty(prior_v, prior_w, limit, rule))

    warnings = []
    if prior_v > 0 and prior_v + value > D(limit):
        warnings.append(
            f"Bu oluvchining shu oydagi boshqa buyurtmalari ${prior_v:.2f}. "
            f"Jami ${prior_v + value:.2f} — ${limit} limitdan oshdi, boj qayta hisoblandi: ${customs:.2f}."
        )

    landed = price + buyout_fee + shipping + customs
    usd_rate = D(cbu_rate) * (1 + D(p["usd_rate_buffer_pct"]))
    raw_uzs = landed * (1 + D(cat["markup"])) * usd_rate
    step = int(p["round_to_uzs"])
    sell = math.ceil(raw_uzs / step) * step

    r2 = lambda x: float(round(x, 2))
    return Quote(
        category=category,
        source_price_usd=price,
        landed_cost_usd=round(landed, 2),
        sell_price_uzs=sell,
        usd_rate=round(usd_rate, 2),
        valid_until=now + timedelta(hours=p["quote_valid_hours"]),
        customs_value_usd=value,
        weight_kg=weight,
        breakdown={
            "source_price_usd": r2(price),
            "buyout_fee_usd": r2(buyout_fee),
            "shipping_mode": mode,
            "chargeable_weight_kg": r2(ch_weight),
            "shipping_usd": r2(shipping),
            "customs_usd": r2(customs),
            "customs_rate": float(rule["rate"]),
            "landed_cost_usd": r2(landed),
            "markup": float(cat["markup"]),
            "cbu_rate": r2(D(cbu_rate)),
            "usd_rate": r2(usd_rate),
            "profit_uzs": int(sell - landed * usd_rate),
        },
        warnings=warnings,
    )
