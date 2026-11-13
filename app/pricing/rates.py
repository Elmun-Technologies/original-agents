"""Central Bank of Uzbekistan (cbu.uz) USD rate, fetched at most once per day per process."""
import logging
import time
from datetime import date
from decimal import Decimal
from functools import lru_cache

import httpx

CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/{day}/"
log = logging.getLogger(__name__)


def fetch_usd_rate(day: date, client: httpx.Client | None = None) -> Decimal:
    url = CBU_URL.format(day=day.isoformat())
    own = client is None
    c = client or httpx.Client(timeout=15)
    try:
        t0 = time.monotonic()
        r = c.get(url)
        log.info("GET %s -> %s in %.2fs", url, r.status_code, time.monotonic() - t0)
        r.raise_for_status()
        rows = r.json()
    finally:
        if own:
            c.close()
    for row in rows:
        if row.get("Ccy") == "USD":
            rate = Decimal(row["Rate"])
            if rate <= 0:
                raise ValueError(f"CBU returned non-positive USD rate: {rate}")
            return rate
    raise ValueError(f"USD rate not found in CBU response for {day}")


@lru_cache(maxsize=8)
def usd_rate(day: date) -> Decimal:
    """Cached per day. Errors are not cached, so a failed fetch is retried on next call."""
    return fetch_usd_rate(day)
