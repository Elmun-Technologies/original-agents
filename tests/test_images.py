import io

import httpx
import pytest
from PIL import Image

from app import config
from app.agents.content import own_photos
from app.media import images
from tests.helpers import make_product


def png(color=(200, 10, 10), fmt="PNG"):
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), color).save(buf, fmt)
    return buf.getvalue()


@pytest.fixture
def setup(tmp_path, monkeypatch):
    s = config.settings()
    monkeypatch.setitem(s["content"], "photos_dir", str(tmp_path / "photos"))
    monkeypatch.setitem(s, "image_source_policy", "source_images")
    monkeypatch.setitem(s["images"], "pause_seconds", 0)
    monkeypatch.setitem(s["images"], "max_bytes", 5000)
    bodies = {"/a.png": png(), "/b.jpg": png(fmt="JPEG"), "/html": b"<html>", "/big": b"x" * 6000}
    seen = []

    def handler(r):
        seen.append(r.url.path)
        return httpx.Response(200, content=bodies[r.url.path]) if r.url.path in bodies else httpx.Response(404)
    return httpx.Client(transport=httpx.MockTransport(handler)), seen


def test_downloads_in_order_and_reports_bad(db, setup):
    client, seen = setup
    p = make_product(db, images=[f"https://cdn-img.poizon.com{x}" for x in ("/a.png", "/html", "/big", "/404", "/b.jpg")])
    problems = images.fetch_source_images(p, client)
    names = [x.name for x in own_photos(p)]
    assert len(names) == 2 and names[0].startswith("src_00") and names[1].startswith("src_04")
    assert names[1].endswith(".jpg") and len(problems) == 3
    assert any("404" in x for x in problems) and any("MB" in x for x in problems)
    seen.clear()
    images.fetch_source_images(p, client)  # already there -> only the failed ones are retried
    assert "/a.png" not in seen and "/b.jpg" not in seen


def test_limit_and_policy(db, setup, monkeypatch):
    client, seen = setup
    p = make_product(db, images=["https://x/a.png", "https://x/b.jpg"])
    monkeypatch.setitem(config.settings()["publishing"], "photos_max_per_sku", 1)
    images.fetch_source_images(p, client)
    assert len(own_photos(p)) == 1
    monkeypatch.setitem(config.settings(), "image_source_policy", "own_photos_only")
    seen.clear()
    assert images.fetch_source_images(make_product(db, sku="Z", images=["https://x/a.png"]), client) == []
    assert seen == []
