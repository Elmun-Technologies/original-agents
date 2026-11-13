"""Central Bank of Uzbekistan (cbu.uz) rates in UZS per 1 unit (USD, CNY, ...).

Fetched at most once per day per currency; last good rate is persisted to a file so it
survives restarts. If CBU is down, the last good rate is reused for up to
`stale_rate_max_hours` with an extra buffer and a warning for the admin. Older than that
-> RateUnavailable (no quoting / no conversion).
"""
import json
import logging
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import httpx

from app import config
from app.config import TZ

CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/{ccy}/{day}/"
log = logging.getLogger(__name__)


class RateUnavailable(Exception):
    pass


@dataclass(frozen=True)
class Rate:
    value: Decimal  # UZS per 1 unit
    fetched_at: datetime
    extra_buffer_pct: Decimal = Decimal(0)
    warning: str | None = None  # caller forwards to admin


def cache_path(ccy: str) -> Path:
    return config.DATA_DIR / f"cbu_{ccy.lower()}.json"


def fetch_rate(ccy: str, day: date, client: httpx.Client | None = None) -> Decimal:
    url = CBU_URL.format(ccy=ccy, day=day.isoformat())
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
        if row.get("Ccy") == ccy:
            rate = Decimal(row["Rate"]) / Decimal(row.get("Nominal") or 1)
            if rate <= 0:
                raise ValueError(f"CBU returned non-positive {ccy} rate: {rate}")
            return rate
    raise ValueError(f"{ccy} rate not found in CBU response for {day}")


def _read_cache(path: Path) -> Rate | None:
    try:
        d = json.loads(path.read_text())
        return Rate(Decimal(d["value"]), datetime.fromisoformat(d["fetched_at"]))
    except (OSError, ValueError, KeyError):
        return None


def _write_cache(path: Path, rate: Rate) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps({"value": str(rate.value), "fetched_at": rate.fetched_at.isoformat()}))
    tmp.replace(path)


def rate(
    ccy: str,
    now: datetime | None = None,
    *,
    client: httpx.Client | None = None,
    cache_file: Path | None = None,
    settings: dict | None = None,
) -> Rate:
    p = (settings or config.settings())["pricing"]
    now = now or datetime.now(TZ)
    cache_file = cache_file or cache_path(ccy)
    cached = _read_cache(cache_file)
    if cached and cached.fetched_at.astimezone(TZ).date() == now.astimezone(TZ).date():
        return cached
    try:
        fresh = Rate(fetch_rate(ccy, now.astimezone(TZ).date(), client), now)
    except (httpx.HTTPError, ValueError, KeyError) as e:
        log.warning("CBU %s rate fetch failed: %r", ccy, e)
        age = now - cached.fetched_at if cached else None
        if age is None or age > timedelta(hours=p["stale_rate_max_hours"]):
            raise RateUnavailable(
                f"CBU {ccy} kursi olinmadi va oxirgi kurs "
                + ("yo'q" if age is None else f"{age.total_seconds() / 3600:.0f} soat eski")
                + ". Narx hisoblanmaydi."
            ) from e
        extra = Decimal(str(p["stale_rate_extra_buffer_pct"]))
        return Rate(cached.value, cached.fetched_at, extra,
                    f"CBU {ccy} kursi olinmadi. {age.total_seconds() / 3600:.0f} soat oldingi kurs "
                    f"({cached.value}) ishlatilmoqda, bufer +{extra * 100:.0f}%.")
    _write_cache(cache_file, fresh)
    return fresh


def usd_rate(now: datetime | None = None, **kw) -> Rate:
    return rate("USD", now, **kw)
