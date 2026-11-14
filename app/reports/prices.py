"""/prices: real lowest prices of accepted products by brand and category, to tune min_price
(categories.yaml). Uses the latest observation per SKU in the period."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import config
from app.agents.sourcing import min_price
from app.db.models import PriceObservation

SIGN = {"CNY": "¥", "USD": "$"}


def text(session: Session, now: datetime, days: int = 30) -> str:
    since = now.astimezone(timezone.utc) - timedelta(days=days)
    latest: dict[str, PriceObservation] = {}
    for o in session.scalars(select(PriceObservation).where(PriceObservation.created_at >= since)
                             .order_by(PriceObservation.created_at, PriceObservation.id)):
        latest[o.style_code] = o
    if not latest:
        return f"Oxirgi {days} kunda qabul qilingan tovar yoʻq — narx statistikasi hali boʻsh."
    groups: dict[tuple, list[PriceObservation]] = defaultdict(list)
    for o in latest.values():
        groups[(o.brand.strip().casefold(), o.category, o.currency)].append(o)
    cats = config.categories()
    lines = [f"💹 Narxlar (oxirgi {days} kun, har tovarning eng arzon oʻlchami):"]
    for (_, cat, ccy), obs in sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        prices = [float(o.min_price) for o in obs]
        sign, c = SIGN.get(ccy, ""), cats.get(cat, {})
        floor = min_price(c, obs[0].brand, ccy) if c else None
        forced = sum(o.override for o in obs)
        lines.append(f"• {obs[0].brand} · {c.get('label_uz', cat)}: {len(obs)} ta tovar, eng arzon {sign}{min(prices):g}, "
                     f"oʻrtacha {sign}{sum(prices) / len(prices):.0f}"
                     + (f", chegara {sign}{floor}" if floor is not None else "")
                     + (f" · {forced} tasi chegaradan past, siz qoʻshgansiz" if forced else ""))
    lines.append("\nChegaralar: config/categories.yaml → min_price / min_price_by_brand.")
    return "\n".join(lines)
