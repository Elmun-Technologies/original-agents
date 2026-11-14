from datetime import timedelta
from pathlib import Path

import pytest
from PIL import Image
from sqlalchemy.orm import sessionmaker

from app import config
from app.agents.content import create_draft
from app.agents.orders import parse_neworder, preview_order, create_order
from app.bot import admin_bot
from tests.helpers import FX, NOW, FakeLlm, add_photos, make_product


@pytest.fixture
def photos(tmp_path, monkeypatch):
    root = tmp_path / "photos"
    monkeypatch.setitem(config.settings()["content"], "photos_dir", str(root))
    return root


def test_resolve_sku_album():
    albums = {}
    assert admin_bot.resolve_sku("MR530SG", None, albums) == "MR530SG"
    assert admin_bot.resolve_sku(" DZ5485-612 old photo", "g1", albums) == "DZ5485-612"
    assert admin_bot.resolve_sku(None, "g1", albums) == "DZ5485-612"     # rest of the album
    assert admin_bot.resolve_sku(None, "g2", albums) is None
    assert admin_bot.resolve_sku("   ", None, albums) is None


def test_photo_target_checks_sku_and_limit(db, photos):
    make_product(db)
    path, err = admin_bot.photo_target(db, "NOPE", ".jpg", "u1")
    assert path is None and "bazada yoʻq" in err
    path, err = admin_bot.photo_target(db, "MR530SG", ".png", "u1")
    assert err == "" and path.parent == photos / "MR530SG" and path.suffix == ".png"
    add_photos(photos, "MR530SG", 10)
    path, err = admin_bot.photo_target(db, "MR530SG", ".jpg", "u2")
    assert path is None and "10 ta surat limiti" in err


def test_check_image(tmp_path):
    good, bad = tmp_path / "a.jpg", tmp_path / "b.jpg"
    Image.new("RGB", (10, 10)).save(good)
    bad.write_bytes(b"not an image")
    assert admin_bot.check_image(good) == good and admin_bot.check_image(bad) is None and not bad.exists()


def test_heic_converted_to_jpeg(tmp_path):
    import pillow_heif
    heic = tmp_path / "iphone.heic"
    pillow_heif.from_pillow(Image.new("RGB", (40, 30), (200, 10, 10))).save(heic)
    out = admin_bot.check_image(heic)
    assert out == tmp_path / "iphone.jpg" and not heic.exists()
    with Image.open(out) as im:
        assert im.format == "JPEG" and im.size == (40, 30)


def test_today_text(db, tmp_path):
    p = make_product(db)
    create_draft(db, p, FakeLlm(), FX, now=NOW, out_root=tmp_path)
    text = admin_bot.today_text(db, NOW)
    assert "Draftlar (bugun): 1" in text and "Tasdiqlash kutilmoqda: 1" in text and "LLM xarajati" in text


def test_keyboards(db, tmp_path):
    p = make_product(db)
    post = create_draft(db, p, FakeLlm(), FX, now=NOW, out_root=tmp_path).post
    assert [b.callback_data for row in admin_bot.post_kb(post.id).inline_keyboard for b in row] == [
        f"post:approve:{post.id}", f"post:edit:{post.id}", f"post:reject:{post.id}", f"post:refresh:{post.id}"]
    post.status = "published"
    o = create_order(db, preview_order(db, parse_neworder(f"{post.id} 41 Ali 901234567"), FX, NOW), NOW)
    data = [b.callback_data for row in admin_bot.order_kb(o).inline_keyboard for b in row]
    assert data == [f"ord:paid:{o.id}", f"ord:cancel:{o.id}"]
    assert all(len(d.encode()) <= 64 for d in data)   # Telegram callback_data limit


def test_router_builds(db):
    ctx = admin_bot.Ctx(factory=sessionmaker(bind=db.get_bind()), admin_ids={1}, channel_id=None)
    router = admin_bot.create_router(ctx, tg=None)
    assert len(router.message.handlers) >= 15 and len(router.callback_query.handlers) == 3
