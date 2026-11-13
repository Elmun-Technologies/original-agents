"""Sourcing, manual_sheet mode (CLAUDE.md §6.2 "Muqobil rejim").

Admin / intermediary fills a CSV or Google Sheet (one row = one size). This imports it into
products + product_sizes, keeping the price as listed (CNY or USD; converted to USD at quote
time with the current CBU rate), applying the replica blocklist and the popular-sizes filter. Bad rows are not imported; the report says which row and why.

CLI:  uv run --env-file .env python -m app.agents.sourcing <file.csv | https://...csv-export>
Template: data/samples/manual_sheet_sample.csv
"""
import csv
import io
import logging
import re
import sys
import time
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import config
from app.db.models import CURRENCIES, ORIGINS, Product, ProductSize, utcnow
from app.scraping import blocklist

SOURCE = "manual_sheet"
COLUMNS = ("brand", "model_name", "style_code", "category", "gender", "colorway", "size_eu",
           "price", "currency", "available", "source_url", "image_urls", "description", "seller_note")
OPTIONAL_COLUMNS = ("origin",)  # dewu | poizon_com | other (default). Only dewu/poizon_com
                                # name+description count as official text for the blocklist.
SHOE_SIZE = re.compile(r"^(\d{2})(\.5| 1/3| 2/3)?$")
APPAREL_SIZES = {"XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL"}
YES = {"", "1", "true", "yes", "ha", "bor", "+"}
NO = {"0", "false", "no", "yo'q", "yoq", "yo‘q", "yo`q", "-"}
GENDERS = {"": "unisex", "unisex": "unisex", "u": "unisex",
           "men": "men", "male": "men", "m": "men", "erkak": "men",
           "women": "women", "female": "women", "w": "women", "ayol": "women"}
PRODUCT_FIELDS = ("brand", "model_name", "category", "gender", "colorway", "source_url",
                  "description", "seller_note", "origin")

log = logging.getLogger(__name__)


class SheetError(Exception):
    """The whole sheet is unusable (unreadable, missing columns)."""


@dataclass
class ImportReport:
    created: list[str] = field(default_factory=list)
    updated: list[str] = field(default_factory=list)
    rejected: list[tuple[str, str]] = field(default_factory=list)  # (style_code, reason)
    skipped: list[tuple[str, str]] = field(default_factory=list)   # (style_code, reason)
    row_errors: list[tuple[int, str]] = field(default_factory=list)  # (sheet row no, reason)

    def text(self) -> str:
        lines = [f"Yuklash natijasi: {len(self.created)} yangi, {len(self.updated)} yangilandi, "
                 f"{len(self.rejected)} rad etildi, {len(self.skipped)} o'tkazib yuborildi, "
                 f"{len(self.row_errors)} xato qator."]
        sections = [
            ("Rad etildi (replika):", [f"{sc}: {r}" for sc, r in self.rejected]),
            ("O'tkazib yuborildi:", [f"{sc}: {r}" for sc, r in self.skipped]),
            ("Xato qatorlar (yuklanmadi):", [f"{n}-qator: {r}" for n, r in self.row_errors]),
        ]
        for title, items in sections:
            if items:
                lines += ["", title] + [f" - {i}" for i in items]
        return "\n".join(lines)


def read_rows(source: str, client: httpx.Client | None = None) -> list[dict]:
    """source: local path or http(s) URL (e.g. Google Sheet 'export?format=csv' link)."""
    if source.startswith(("http://", "https://")):
        own = client is None
        c = client or httpx.Client(timeout=30, follow_redirects=True)
        try:
            t0 = time.monotonic()
            r = c.get(source)
            log.info("GET %s -> %s in %.2fs", source, r.status_code, time.monotonic() - t0)
            if r.status_code != 200:
                raise SheetError(f"Sheet yuklanmadi: HTTP {r.status_code}")
            text = r.content.decode("utf-8-sig")
        finally:
            if own:
                c.close()
    else:
        try:
            text = Path(source).read_text(encoding="utf-8-sig")
        except OSError as e:
            raise SheetError(f"Fayl o'qilmadi: {e}") from e
    reader = csv.DictReader(io.StringIO(text))
    missing = [c for c in COLUMNS if c not in (reader.fieldnames or [])]
    if missing:
        raise SheetError(f"Ustunlar yetishmaydi: {', '.join(missing)}")
    return list(reader)


def valid_size(size: str, size_type: str) -> bool:
    if size_type == "shoe":
        m = SHOE_SIZE.match(size)
        return bool(m) and 30 <= int(m.group(1)) <= 50
    return size.upper() in APPAREL_SIZES or (size.isdigit() and 24 <= int(size) <= 60)


def parse_row(row: dict, cats: dict) -> dict | str:
    """Returns a clean row dict, or an error message (Uzbek, for the admin)."""
    r = {k: (row.get(k) or "").strip() for k in COLUMNS + OPTIONAL_COLUMNS}
    for k in ("brand", "model_name", "style_code"):
        if not r[k]:
            return f"{k} bo'sh"
    if r["category"] not in cats:
        return f"kategoriya '{r['category']}' categories.yaml'da yo'q"
    size = re.sub(r"\s+", " ", r["size_eu"].replace(",", "."))
    if not size:
        return "o'lcham yo'q"
    size_type = cats[r["category"]]["size_type"]
    if not valid_size(size, size_type):
        return f"o'lcham noto'g'ri: '{r['size_eu']}' ({size_type})"
    r["size_eu"] = size.upper() if size_type == "apparel" else size
    if not r["price"]:
        return "narx yo'q"
    try:
        price = Decimal(r["price"].replace(",", ".").replace(" ", ""))
    except InvalidOperation:
        return f"narx noto'g'ri: '{r['price']}'"
    if price <= 0:
        return f"narx noto'g'ri: '{r['price']}'"
    r["price"] = price
    r["currency"] = r["currency"].upper()
    if r["currency"] not in CURRENCIES:
        return f"valyuta noto'g'ri: '{r['currency']}' (CNY yoki USD)"
    r["origin"] = r["origin"].casefold() or "other"
    if r["origin"] not in ORIGINS:
        return f"origin noto'g'ri: '{r['origin']}' ({' / '.join(ORIGINS)})"
    avail = r["available"].casefold()
    if avail not in YES | NO:
        return f"available noto'g'ri: '{r['available']}' (ha/yo'q)"
    r["available"] = avail in YES
    gender = GENDERS.get(r["gender"].casefold())
    if gender is None:
        return f"gender noto'g'ri: '{r['gender']}' (men/women/unisex)"
    r["gender"] = gender
    r["images"] = [u for u in re.split(r"[|\s]+", r.pop("image_urls")) if u.startswith("http")]
    for k in ("colorway", "source_url", "description", "seller_note"):
        r[k] = r[k] or None
    return r


def has_popular_size(sizes: dict[str, dict], gender: str, ranges: dict) -> bool:
    lo, hi = ranges[gender]
    return any(s["available"] and lo <= int(SHOE_SIZE.match(size).group(1)) <= hi
               for size, s in sizes.items())


def import_sheet(session: Session, source: str, *, client: httpx.Client | None = None) -> ImportReport:
    """Imports into the session (flushes, does not commit)."""
    cats = config.categories()
    ranges = config.settings()["sourcing"]["popular_sizes_eu"]
    report = ImportReport()

    # 1. Parse rows; group by style_code.
    groups: dict[str, dict] = {}
    for n, raw in enumerate(read_rows(source, client), start=2):  # row 1 is the header
        r = parse_row(raw, cats)
        if isinstance(r, str):
            report.row_errors.append((n, r))
            continue
        g = groups.setdefault(r["style_code"], {"fields": {k: r[k] for k in PRODUCT_FIELDS},
                                                "images": r["images"], "sizes": {}})
        if any(g["fields"][k] != r[k] for k in ("brand", "model_name", "category", "origin")):
            report.row_errors.append((n, f"{r['style_code']}: brand/model/kategoriya/origin oldingi qatordan farq qiladi"))
            continue
        if r["size_eu"] in g["sizes"]:
            report.row_errors.append((n, f"{r['style_code']}: o'lcham {r['size_eu']} takrorlangan"))
            continue
        g["sizes"][r["size_eu"]] = {"price": r["price"], "currency": r["currency"],
                                    "available": r["available"], "row": n}
        for img in r["images"]:
            if img not in g["images"]:
                g["images"].append(img)

    # 2. Upsert products.
    for sc, g in groups.items():
        sizes = g["sizes"]
        p = session.scalar(select(Product).where(Product.source == SOURCE, Product.style_code == sc))
        is_new = p is None
        if is_new:
            p = Product(source=SOURCE, style_code=sc, first_seen_at=utcnow())
            session.add(p)
        for k, v in g["fields"].items():
            setattr(p, k, v)
        p.images = g["images"]
        p.last_checked_at = utcnow()

        existing = {s.size_eu: s for s in p.sizes}
        for size, s in sizes.items():
            ps = existing.get(size) or ProductSize(size_eu=size)
            ps.source_price, ps.source_currency = s["price"], s["currency"]
            ps.available, ps.checked_at = s["available"], utcnow()
            if size not in existing:
                p.sizes.append(ps)
        for size, ps in existing.items():  # not in this sheet -> no longer offered
            if size not in sizes:
                ps.available = False

        if not blocklist.apply(p):
            report.rejected.append((sc, p.rejected_reason))
        elif (cats[p.category]["size_type"] == "shoe"
              and not has_popular_size({s.size_eu: {"available": s.available} for s in p.sizes},
                                       p.gender, ranges)):
            lo, hi = ranges[p.gender]
            p.is_active = False
            p.rejected_reason = f"o'lcham: EU {lo}-{hi} oralig'ida mavjud o'lcham yo'q ({p.gender})"
            report.skipped.append((sc, p.rejected_reason))
        else:
            (report.created if is_new else report.updated).append(sc)
    session.flush()
    return report


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)  # we log URL/status/time ourselves
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    from app.db import make_engine
    with Session(make_engine()) as s:
        try:
            report = import_sheet(s, sys.argv[1])
        except SheetError as e:
            sys.exit(f"Xato: {e}")
        s.commit()
    print(report.text())


if __name__ == "__main__":
    main()
