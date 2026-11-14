import csv
import io
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import select

from app import config
from app.agents import sourcing
from app.agents.sourcing import SheetError, import_sheet
from app.db.models import Product

SAMPLE = str(config.ROOT / "data/samples/manual_sheet_sample.csv")
HEADER = ",".join(sourcing.COLUMNS + ("origin",))


def run(db, source, **kw):
    return import_sheet(db, source, **kw)


def csv_file(tmp_path, *rows, header=HEADER):
    f = tmp_path / "sheet.csv"
    f.write_text("\n".join([header, *rows]) + "\n", encoding="utf-8")
    return str(f)


def row(style="MR530SG", size="42", price="489", currency="CNY", category="sneakers",
        gender="unisex", available="ha", brand="New Balance", model="530", note="", desc="",
        origin="dewu"):
    buf = io.StringIO()
    csv.writer(buf, lineterminator="").writerow(
        [brand, model, style, category, gender, "White", size, price, currency, available, "", "",
         desc, note, origin])
    return buf.getvalue()


def product(db, style):
    return db.scalar(select(Product).where(Product.style_code == style))


def test_sample_csv(db):
    rep = run(db, SAMPLE)
    assert sorted(rep.created) == ["DZ5485-612", "MR530SG", "NF0A3C8D"]
    assert [sc for sc, _ in rep.rejected] == ["DD1391-100", "HQ4540"]
    assert dict(rep.rejected)["DD1391-100"] == "replika: seller_note='1:1'"
    assert dict(rep.rejected)["HQ4540"] == "replika: description='纯原'"
    assert rep.row_errors == [] and rep.skipped == []

    nb = product(db, "MR530SG")
    # stored as listed at the source; USD is computed at quote time
    assert {s.size_eu: (s.source_price, s.source_currency) for s in nb.sizes} == {
        "41": (Decimal("489.00"), "CNY"), "42.5": (Decimal("509.00"), "CNY")}
    assert nb.images == ["https://example.com/mr530sg-1.jpg", "https://example.com/mr530sg-2.jpg"]
    assert nb.is_active and nb.source == "manual_sheet" and nb.origin == "dewu"

    aj = product(db, "DZ5485-612")  # official (dewu) 复刻 in name/description: kept
    assert aj.is_active and aj.rejected_reason is None
    assert product(db, "NF0A3C8D").origin == "poizon_com"

    dunk = product(db, "DD1391-100")  # rejected products are stored, inactive, with reason
    assert not dunk.is_active and dunk.sizes[0].source_currency == "USD"
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
    (row(origin="taobao"), "origin noto'g'ri"),
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
    rep = run(db, csv_file(tmp_path, row(size="42"), row(size="42"), row(size="43", model="550"),
                           row(size="44", origin="other")))
    assert [n for n, _ in rep.row_errors] == [3, 4, 5]
    assert "takrorlangan" in rep.row_errors[0][1]
    assert all("farq qiladi" in r for _, r in rep.row_errors[1:])


def test_missing_columns(tmp_path):
    with pytest.raises(SheetError, match="currency"):
        sourcing.read_rows(csv_file(tmp_path, header=HEADER.replace(",currency", "")))


def test_origin_column_is_optional(db, tmp_path):
    header = ",".join(sourcing.COLUMNS)
    rep = run(db, csv_file(tmp_path, row().rsplit(",", 1)[0], header=header))
    assert rep.created == ["MR530SG"] and product(db, "MR530SG").origin == "other"


@pytest.mark.parametrize("origin,model,kept", [
    ("dewu", "Air Jordan 1 复刻版", True),
    ("poizon_com", "Air Jordan 1 复刻版", True),
    ("other", "Air Jordan 1 复刻版", False),       # not official text
    ("", "Air Jordan 1 复刻版", False),            # default other
    ("dewu", "Air Jordan 1 复刻 1:1", False),     # 复刻 + replica term
])
def test_origin_decides_official_text(db, tmp_path, origin, model, kept):
    rep = run(db, csv_file(tmp_path, row(brand="Jordan", model=model, origin=origin)))
    assert bool(rep.created) == kept and bool(rep.rejected) != kept


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
    assert (sizes["41"].source_price, sizes["41"].source_currency) == (Decimal("520.00"), "USD")
    assert sizes["42"].available is False  # dropped from sheet


def test_reimport_clean_after_reject(db, tmp_path):
    run(db, csv_file(tmp_path, row(note="replika")))
    assert not product(db, "MR530SG").is_active
    run(db, csv_file(tmp_path, row()))
    p = product(db, "MR530SG")
    assert p.is_active and p.rejected_reason is None


def test_google_sheet_url(db):
    body = "﻿" + "\n".join([HEADER, row()])  # BOM like Google export
    client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=body.encode())))
    rep = run(db, "https://docs.google.com/spreadsheets/d/x/export?format=csv", client=client)
    assert rep.created == ["MR530SG"]
    bad = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(403)))
    with pytest.raises(SheetError, match="403"):
        run(db, "https://docs.google.com/x", client=bad)


def test_poizon_mode_refused_client_not_built(db, monkeypatch):
    monkeypatch.setitem(config.settings(), "sourcing_mode", "poizon_com")
    with pytest.raises(SheetError, match="chetlab"):
        run(db, SAMPLE)


def test_sold_count_column(db, tmp_path):
    header = HEADER + ",sold_count"
    rep = run(db, csv_file(tmp_path, row() + ",\"12,400+\"", row(style="X", size="41") + ",abc", header=header))
    assert rep.created == ["MR530SG"] and "sold_count" in rep.row_errors[0][1]
    assert product(db, "MR530SG").sold_count == 12400


def test_import_daily_uses_sheet_url(db, monkeypatch):
    monkeypatch.setitem(config.settings(), "sheet_url", "")
    assert sourcing.import_daily(db) is None
    monkeypatch.setitem(config.settings(), "sheet_url", "https://docs.google.com/x/export?format=csv")
    client = httpx.Client(transport=httpx.MockTransport(
        lambda r: httpx.Response(200, content="\n".join([HEADER, row()]).encode())))
    assert sourcing.import_daily(db, client).created == ["MR530SG"]


@pytest.mark.parametrize("brand,model,ok", [
    ("Nike", "Air Force 1 Low", True),
    ("", "Air Force 1 Low", False),            # brand missing (row error before the check)
    ("Noname", "AF1 Air Force 1 style", False),
    ("Adidas", "Samba OG", True),
    ("Li-Ning", "Samba classic", False),
    ("Jordan", "Air Jordan 4", True),
    ("Anta", "Dunk Low", False),
    ("NB", "530", True),
    ("Skechers", "530 retro", False),
    ("Puma", "Suede Classic", True),            # not a listed model
])
def test_knockoff(db, tmp_path, brand, model, ok):
    rep = run(db, csv_file(tmp_path, row(brand=brand, model=model)))
    assert bool(rep.created) == ok
    if not ok and brand:
        assert "brendsiz oʻxshatma" in rep.rejected[0][1]
        assert not product(db, "MR530SG").is_active


def test_min_price_by_category(db, tmp_path):
    rep = run(db, csv_file(tmp_path, row(style="CHEAP", price="150"), row(style="OK", price="200"),
                           row(style="CHEAP-USD", price="20", currency="USD"),
                           row(style="T", category="tshirt", size="M", price="70")))
    assert sorted(rep.created) == ["OK", "T"]
    reasons = dict(rep.rejected)
    assert reasons["CHEAP"].startswith("narx juda past: ¥150 < ¥200 (Krossovka)")
    assert "$20 < $28" in reasons["CHEAP-USD"]
    assert not product(db, "CHEAP").is_active
