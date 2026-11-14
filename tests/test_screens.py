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
        "description": "Retro running", "images": [{"kind": "screenshot", "photo_box": [100, 100, 900, 700]}],
        "unclear": []}


def shot(tmp_path, name="s.jpg", size=(1000, 2000)):
    p = tmp_path / name
    Image.new("RGB", size, (230, 230, 230)).save(p)
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
    assert "rasm sifati past (800×1200)" not in msg                     # longest side 1200 >= 1080
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


def test_unclear_notes_are_uzbek_only():
    d = screens.parse_json(json.dumps(DATA | {"unclear": ["Brand is not clearly shown in the image",
                                                           "brend koʻrinmaydi", "SKU 不清楚"]}))
    assert d["unclear"] == [screens.UNCLEAR_FALLBACK, "brend koʻrinmaydi"]


def test_missing_sizes_asks_for_size_picker():
    d = DATA | {"sizes": []}
    assert screens.problems(d) == [screens.ASK_SIZES]
    assert "oʻlcham tanlash oynasining skrinshotini yuboring" in screens.preview_text(d)


def test_knockoff_and_min_price_in_preview():
    fake = DATA | {"brand": None, "model_name": "Air Force 1 Low"}
    assert screens.problems(fake) == ["brendsiz oʻxshatma — qoʻshilmadi ('air force', brend yoʻq)"]
    cheap = DATA | {"sizes": [{"size": "41", "price": 150}]}
    errs = screens.problems(cheap)
    assert errs[0].startswith("narx juda past: ¥150 < ¥300 (New Balance, Krossovka)")
    assert screens.only_too_cheap(errs) and not screens.only_too_cheap(screens.problems(fake))
    assert "Toʻgʻrimi" not in screens.preview_text(cheap)


def test_force_cheap_save_and_prices_report(db, tmp_path, monkeypatch):
    from app.reports import prices
    monkeypatch.setitem(config.settings()["content"], "photos_dir", str(tmp_path / "photos"))
    cheap = DATA | {"sizes": [{"size": "41", "price": 150}]}
    p, msg = screens.save(db, cheap, [shot(tmp_path)])
    assert msg.startswith("⛔") and not p.is_active
    p, msg = screens.save(db, cheap, [shot(tmp_path)], force_cheap=True)
    assert msg.startswith("✓") and p.is_active and p.min_price_override
    screens.save(db, DATA | {"style_code": "MR530X", "sizes": [{"size": "42", "price": 450}]}, [shot(tmp_path)])
    text = prices.text(db, NOW + timedelta(days=1))
    assert "New Balance · Krossovka: 2 ta tovar, eng arzon ¥150, oʻrtacha ¥300, chegara ¥300" in text
    assert "1 tasi chegaradan past" in text
    assert "boʻsh" in prices.text(db, NOW + timedelta(days=60), days=7)


def test_saved_image_preferred_and_poster_cropped(tmp_path):
    screenshot, poster = shot(tmp_path, "s.jpg"), shot(tmp_path, "p.jpg", (1500, 2200))
    d = DATA | {"images": [{"kind": "screenshot", "photo_box": [0, 0, 1000, 400]},
                           {"kind": "saved_image", "photo_box": [0, 0, 1000, 700]}]}   # QR/ads below 700
    assert screens.card_sources([screenshot, poster], d) == [(poster, [0, 0, 1000, 700])]
    photos, warns = screens.card_photos([screenshot, poster], d, tmp_path / "out", "app_x")
    assert [Image.open(x).size for x in photos] == [(1500, 1540)] and warns == []
    small = shot(tmp_path, "small.jpg", (700, 900))
    d2 = DATA | {"images": [{"kind": "saved_image", "photo_box": None}]}
    photos, warns = screens.card_photos([small], d2, tmp_path / "out2", "app_y")
    assert Image.open(photos[0]).size == (700, 900)                       # no box: whole image, as is
    assert warns == ["rasm sifati past (700×900) — ilovadan «Save image» qilib yuboring"]


def test_crop_keeps_pixels_unchanged(tmp_path):
    src = tmp_path / "w.png"
    im = Image.new("RGB", (1000, 1000), (255, 255, 255))
    for x in range(600, 700):              # a "得物" watermark-like mark inside the photo box
        for y in range(600, 650):
            im.putpixel((x, y), (10, 200, 30))
    im.save(src)
    out = screens.crop_box(src, [0, 0, 800, 800], tmp_path / "c.jpg")
    px = Image.open(out).convert("RGB").getpixel((650, 625))
    assert abs(px[0] - 10) < 12 and abs(px[1] - 200) < 12                # watermark still there
