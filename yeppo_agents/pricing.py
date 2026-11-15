"""Sell price for a Korean product (pure code, no LLM). All numbers: config/yeppo.yaml `pricing`.

landed_usd = price + weight_kg * ship_rate_per_kg + customs_pct * (price + shipping) + local_delivery
sell_uzs   = ceil_to(landed_usd * (1 + markup) * usd_rate * (1 + buffer), round_to)
"""
import json
import logging
import math
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal

import httpx

from yeppo_agents.settings import DATA, TZ, cfg

log = logging.getLogger(__name__)
CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/{day}/"
MAX_STALE = timedelta(hours=72)


class RateUnavailable(Exception):
    pass


@dataclass(frozen=True)
class Quote:
    source_usd: Decimal
    shipping_usd: Decimal
    customs_usd: Decimal
    landed_usd: Decimal
    usd_rate: Decimal
    sell_uzs: int
    profit_uzs: int
    weight_kg: Decimal


def D(x) -> Decimal:
    return Decimal(str(x))


def quote(price_usd: Decimal, category: str | None, usd_rate: Decimal, p: dict | None = None) -> Quote:
    p = p or cfg()["pricing"]
    weight = D(p["weight_kg_by_category"].get(category or "", p["weight_kg_default"]))
    shipping = weight * D(p["ship_rate_per_kg_usd"])
    customs = (price_usd + shipping) * D(p["customs_pct"])
    landed = price_usd + shipping + customs + D(p["local_delivery_usd"])
    rate = usd_rate * (1 + D(p["usd_rate_buffer_pct"]) / 100)
    step = int(p["round_to_uzs"])
    raw = landed * (1 + D(p["markup"])) * rate
    sell = math.ceil(raw / step) * step
    return Quote(price_usd, shipping, customs, landed, usd_rate, sell, int(sell - landed * rate), weight)


def usd_rate(client: httpx.Client | None = None, today: date | None = None) -> Decimal:
    """CBU rate, fetched once a day; last good value kept for 72 h if cbu.uz is down."""
    today = today or datetime.now(TZ).date()
    cache = DATA / "cbu_usd.json"
    saved = None
    try:
        saved = json.loads(cache.read_text())
        if saved["day"] == today.isoformat():
            return D(saved["rate"])
    except Exception:
        pass
    try:
        c = client or httpx.Client(timeout=20)
        r = c.get(CBU_URL.format(day=today.isoformat()))
        r.raise_for_status()
        rate = D(r.json()[0]["Rate"])
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps({"day": today.isoformat(), "rate": str(rate), "at": datetime.now(TZ).isoformat()}))
        return rate
    except Exception as e:
        log.warning("CBU rate failed: %s", type(e).__name__)
        if saved and datetime.now(TZ) - datetime.fromisoformat(saved["at"]) < MAX_STALE:
            return D(saved["rate"])
        raise RateUnavailable("CBU kursi olinmadi va saqlangani eskirgan") from e
