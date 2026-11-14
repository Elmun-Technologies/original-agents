import json
from datetime import timedelta

from PIL import Image
from sqlalchemy import select

from app import config
from app.agents import publisher, screens
from app.agents.content import own_photos
from app.db.models import Product
from tests.helpers import FX, NOW, FakeLlm, make_product

DATA = {"brand": "New Balance", "model_name": "530", "style_code": "MR530SG", "category": "sneakers",
        "gender": "unisex", "colorway": "White Silver", "currency": "CNY", "size_system": "EU",
        "sizes": [{"size": "41", "price": 489}, {"size": "42.5", "price": 509}], "sold_count": 12000,
        "description": "Retro running", "photo": {"image": 0, "box": [100, 100, 900, 700]}, "unclear": []}


def shot(tmp_path, name="s.jpg"):
    p = tmp_path / name
    Image.new("RGB", (1000, 2000), (230, 230, 230)).save(p)
    return p


def test_read_parses_json_and_sends_images(tmp_path):
    llm = FakeLlm("Here:\n" + json.dumps(DATA))
    calls = []
    orig = llm.complete
    llm.complete = lambda *a, **kw: calls.append(kw) or orig(*a, **kw)
    d = screens.read_screens(llm, [shot(tmp_path)], NOW)
    assert d["style_code"] == "MR530SG" and calls[0]["images"][0][1] == "image/jpeg"
    screens.read_screens(llm, [shot(tmp_path)], NOW, previous=d, correction="narx 42.5 = 520")
    assert "narx 42.5 = 520" in llm.calls[-1][1] and "MR530SG" in llm.calls[-1][1]


def test_preview_and_problems():
    assert screens.problems(DATA) == []
    text = screens.preview_text(DATA)
    assert "MR530SG" in text and "42.5: ¥509" in text and "12000" in text and "Toʻgʻrimi" in text
    us = DATA | {"size_system": "US", "sizes": [{"size": "9", "price": 489}]}
    assert any("US" in e for e in screens.problems(us)) and "Saqlab boʻlmaydi" in screens.preview_text(us)
    no_sku = DATA | {"style_code": None}
    assert screens.style_code(no_sku) == screens.style_code(dict(no_sku)) and screens.style_code(no_sku).startswith("PZ-")


def test_save_creates_crops_and_updates(db, tmp_path, monkeypatch):
    monkeypatch.setitem(config.settings()["content"], "photos_dir", str(tmp_path / "photos"))
    p, msg = screens.save(db, DATA, [shot(tmp_path)], "https://www.poizon.com/product/x-1")
    assert msg.startswith("✓ qoʻshildi") and "¥489 dan" in msg
    assert p.origin == "poizon_com" and p.sold_count == 12000 and p.source_url.endswith("x-1")
    photos = own_photos(p)
    assert len(photos) == 1 and photos[0].name.startswith("app_") and Image.open(photos[0]).size == (800, 1200)
    _, msg = screens.save(db, DATA | {"sizes": [{"size": "41", "price": 470}]}, [shot(tmp_path)])
    assert msg.startswith("✓ yangilandi") and len(own_photos(p)) == 1
    assert {s.size_eu: s.available for s in p.sizes} == {"41": True, "42.5": False}


def test_save_replica_rejected(db, tmp_path, monkeypatch):
    monkeypatch.setitem(config.settings()["content"], "photos_dir", str(tmp_path / "photos"))
    p, msg = screens.save(db, DATA | {"description": "1:1 纯原"}, [shot(tmp_path)])
    assert msg.startswith("⛔") and not p.is_active


def test_stale_price_blocks_and_is_listed(db, tmp_path, monkeypatch):
    monkeypatch.setitem(config.settings()["content"], "photos_dir", str(tmp_path / "photos"))
    p = make_product(db, sku="OLD")
    for s in p.sizes:
        s.checked_at = NOW - timedelta(days=4)
    db.flush()
    assert publisher.stale_price(p, NOW) and publisher.pick_products(db, NOW, 8, FX) == []
    assert "Narxni yangilang" in publisher.daily_summary(db, NOW) and "OLD" in publisher.daily_summary(db, NOW)
    for s in p.sizes:
        s.checked_at = NOW - timedelta(days=2)
    assert not publisher.stale_price(p, NOW)
