import csv
import io
from datetime import datetime
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import select

from app import config
from app.agents import sourcing
from app.agents.sourcing import SheetError, import_sheet
from app.db.models import Product
from app.pricing import rates
from app.pricing.calculator import TZ

NOW = datetime(2026, 11, 14, 10, tzinfo=TZ)
CNY, USD = Decimal("1795.58"), Decimal("11973.44")
SAMPLE = str(config.ROOT / "data/samples/manual_sheet_sample.csv")
HEADER = ",".join(sourcing.COLUMNS)


def fresh(ccy, now):
    return rates.Rate({"CNY": CNY, "USD": USD}[ccy], now)


def cny_usd(cny):
    return round(Decimal(cny) * CNY / USD, 2)


def run(db, source, get_rate=fresh, **kw):
    return import_sheet(db, source, now=NOW, get_rate=get_rate, **kw)


def csv_file(tmp_path, *rows, header=HEADER):
    f = tmp_path / "sheet.csv"
    f.write_text("\n".join([header, *rows]) + "\n", encoding="utf-8")
    return str(f)


def row(style="MR530SG", size="42", price="489", currency="CNY", category="sneakers",
        gender="unisex", available="ha", brand="New Balance", model="530", note="", desc=""):
    buf = io.StringIO()
    csv.writer(buf, lineterminator="").writerow(
        [brand, model, style, category, gender, "White", size, price, currency, available, "", "", desc, note])
    return buf.getvalue()


def product(db, style):
    return db.scalar(select(Product).where(Product.style_code == style))


def test_sample_csv(db):
    rep = run(db, SAMPLE)
    assert sorted(rep.created) == ["DZ5485-612", "MR530SG", "NF0A3C8D"]
    assert [sc for sc, _ in rep.rejected] == ["DD1391-100", "HQ4540"]
    assert dict(rep.rejected)["DD1391-100"] == "replika: seller_note='1:1'"
    assert dict(rep.rejected)["HQ4540"] == "replika: description='纯原'"
    assert rep.row_errors == [] and rep.skipped == [] and rep.warnings == []

    nb = product(db, "MR530SG")
    assert {s.size_eu: s.price_usd for s in nb.sizes} == {"41": cny_usd(489), "42.5": cny_usd(509)}
    assert nb.images == ["https://example.com/mr530sg-1.jpg", "https://example.com/mr530sg-2.jpg"]
    assert nb.is_active and nb.source == "manual_sheet"

    aj = product(db, "DZ5485-612")  # official 复刻 in name/description: kept
    assert aj.is_active and aj.rejected_reason is None
    assert product(db, "NF0A3C8D").sizes[0].size_eu == "M"

    dunk = product(db, "DD1391-100")  # rejected products are stored, inactive, with reason
    assert not dunk.is_active and dunk.sizes[0].price_usd == Decimal("95.00")
    assert "Rad etildi" in rep.text() and "DD1391-100" in rep.text()


@pytest.mark.parametrize("bad_row,msg", [
    (row(price=""), "narx yo'q"),
    (row(price="abc"), "narx noto'g'ri"),
    (row(price="-5"), "narx noto'g'ri"),
    (row(size="39.7"), "o'lcham noto'g'ri"),
    (row(size="60"), "o'lcham noto'g'ri"),
    (row(size=""), "o'lcham yo'q"),
    (row(category="spaceship"), "categories.yaml'da yo'q"),
    (row(category="hoodie", size="42.5"), "o'lcham noto'g'ri"),
    (row(currency="EUR"), "valyuta noto'g'ri"),
    (row(available="maybe"), "available noto'g'ri"),
    (row(gender="kids"), "gender noto'g'ri"),
    (row(style=""), "style_code bo'sh"),
])
def test_bad_rows_reported_not_imported(db, tmp_path, bad_row, msg):
    rep = run(db, csv_file(tmp_path, row(style="OK-1", size="41"), bad_row))
    assert rep.created == ["OK-1"]
    assert len(rep.row_errors) == 1
    n, reason = rep.row_errors[0]
    assert n == 3 and msg in reason            # sheet row 3 (header is row 1)
    assert f"3-qator: {reason}" in rep.text()


@pytest.mark.parametrize("size,ok", [("42", True), ("42.5", True), ("42,5", True), ("40 2/3", True),
                                     ("40  1/3", True), ("29", False), ("51", False), ("42.3", False)])
def test_shoe_sizes(db, tmp_path, size, ok):
    rep = run(db, csv_file(tmp_path, row(size=size)))
    assert bool(rep.created) == ok


@pytest.mark.parametrize("size,ok", [("M", True), ("xl", True), ("3XL", True), ("32", True),
                                     ("XXXXL", False), ("70", False)])
def test_apparel_sizes(db, tmp_path, size, ok):
    rep = run(db, csv_file(tmp_path, row(category="hoodie", size=size)))
    assert bool(rep.created) == ok


def test_duplicate_size_and_conflicting_rows(db, tmp_path):
    rep = run(db, csv_file(tmp_path, row(size="42"), row(size="42"), row(size="43", model="550")))
    assert [n for n, _ in rep.row_errors] == [3, 4]
    assert "takrorlangan" in rep.row_errors[0][1] and "farq qiladi" in rep.row_errors[1][1]


def test_missing_columns(tmp_path):
    with pytest.raises(SheetError, match="currency"):
        sourcing.read_rows(csv_file(tmp_path, header=HEADER.replace(",currency", "")))


def test_missing_file():
    with pytest.raises(SheetError):
        sourcing.read_rows("/nonexistent/sheet.csv")


def test_popular_sizes_filter(db, tmp_path):
    rep = run(db, csv_file(tmp_path,
                           row(style="BIG", gender="men", size="47"),
                           row(style="BIG-UNAVAIL", gender="men", size="47"),
                           row(style="BIG-UNAVAIL", gender="men", size="42", available="yo'q"),
                           row(style="W-OK", gender="women", size="38"),
                           row(style="W-BAD", gender="women", size="42"),
                           row(style="HOODIE", category="hoodie", gender="men", size="XXL")))
    assert sorted(sc for sc, _ in rep.skipped) == ["BIG", "BIG-UNAVAIL", "W-BAD"]
    assert sorted(rep.created) == ["HOODIE", "W-OK"]  # apparel is not size-filtered
    p = product(db, "BIG")
    assert not p.is_active and p.rejected_reason.startswith("o'lcham: EU 40-45")


def test_reimport_updates(db, tmp_path):
    run(db, csv_file(tmp_path, row(size="41", price="489"), row(size="42", price="499")))
    rep = run(db, csv_file(tmp_path, row(size="41", price="520", currency="USD")))
    assert rep.updated == ["MR530SG"] and rep.created == []
    sizes = {s.size_eu: s for s in product(db, "MR530SG").sizes}
    assert sizes["41"].price_usd == Decimal("520.00")
    assert sizes["42"].available is False  # dropped from sheet


def test_reimport_clean_after_reject(db, tmp_path):
    run(db, csv_file(tmp_path, row(note="replika")))
    assert not product(db, "MR530SG").is_active
    run(db, csv_file(tmp_path, row()))
    p = product(db, "MR530SG")
    assert p.is_active and p.rejected_reason is None


def test_cny_rate_unavailable_usd_rows_still_import(db, tmp_path):
    def down(ccy, now):
        raise rates.RateUnavailable("CBU CNY kursi olinmadi va oxirgi kurs yo'q. Narx hisoblanmaydi.")
    rep = run(db, csv_file(tmp_path, row(style="CNY-1"), row(style="USD-1", currency="USD", price="100")),
              get_rate=down)
    assert rep.created == ["USD-1"]
    assert rep.row_errors == [(2, "CNY kursi yo'q, narx USD'ga o'tkazilmadi")]
    assert any("CNY kursi olinmadi" in w for w in rep.warnings)


def test_stale_cny_rate_adds_buffer_and_warning(db, tmp_path):
    def stale(ccy, now):
        if ccy == "CNY":
            return rates.Rate(CNY, now, Decimal("0.01"), "CBU CNY kursi olinmadi. 30 soat oldingi kurs")
        return fresh(ccy, now)
    rep = run(db, csv_file(tmp_path, row(price="1000")), get_rate=stale)
    expected = round(Decimal(1000) * CNY * Decimal("1.01") / USD, 2)
    assert product(db, "MR530SG").sizes[0].price_usd == expected
    assert rep.warnings == ["CBU CNY kursi olinmadi. 30 soat oldingi kurs"]


def test_usd_only_sheet_does_not_fetch_rates(db, tmp_path):
    def boom(ccy, now):
        raise AssertionError("rates must not be fetched")
    assert run(db, csv_file(tmp_path, row(currency="USD", price="100")), get_rate=boom).created


def test_google_sheet_url(db):
    body = "﻿" + "\n".join([HEADER, row()])  # BOM like Google export
    client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=body.encode())))
    rep = run(db, "https://docs.google.com/spreadsheets/d/x/export?format=csv", client=client)
    assert rep.created == ["MR530SG"]
    bad = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(403)))
    with pytest.raises(SheetError, match="403"):
        run(db, "https://docs.google.com/x", client=bad)
