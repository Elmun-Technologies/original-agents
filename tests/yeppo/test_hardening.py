"""Behaviour added while preparing the agents for live use. Offline: no real site, Telegram or Claude is called."""
import io
import json
import os
from datetime import datetime, timedelta
from decimal import Decimal

import anthropic
import httpx
import pytest
from PIL import Image

from yeppo_agents import bot, content, llm, media, pricing, qdepot, settings
from yeppo_agents.catalog import Catalog, CatalogError, product_slug, slugify
from yeppo_agents.fetch import Blocked, Fetcher, NotAllowed
from yeppo_agents.settings import TZ


def png(mode="RGB", color="white", size=(40, 40)) -> bytes:
    b = io.BytesIO()
    Image.new(mode, size, color).save(b, "PNG")
    return b.getvalue()


# --- fetch ------------------------------------------------------------------------------------
def fetcher(handler, tmp_path):
    return Fetcher("https://shop.test", sleep=lambda s: None, client=httpx.Client(transport=httpx.MockTransport(handler)),
                   cache_dir=tmp_path / "c")


def site(req, body=None, ctype="text/html"):
    if req.url.path == "/robots.txt":
        return httpx.Response(200, text="User-agent: *\nDisallow: /private\n")
    return httpx.Response(200, content=body or b"<html>ok</html>", headers={"content-type": ctype})


def test_look_alike_host_is_not_the_source(tmp_path):
    f = fetcher(site, tmp_path)
    for url in ("https://shop.test.evil.com/a", "https://shop.testing/a", "http://shop.test/a"):
        with pytest.raises(NotAllowed):
            f.get(url)
    assert f.get("https://shop.test/a")


def test_photo_download_follows_the_same_rules(tmp_path):
    hits = []
    img = png()

    def h(req):
        hits.append(req.url.path)
        return site(req, img, "image/png")
    f = fetcher(h, tmp_path)
    assert f.get_bytes("https://shop.test/image/a.png") == img
    assert f.get_bytes("https://shop.test/image/a.png") == img  # cached: no second request
    assert hits.count("/image/a.png") == 1
    with pytest.raises(NotAllowed):
        f.get_bytes("https://shop.test/private/a.png")  # robots.txt
    with pytest.raises(NotAllowed):
        f.get_bytes("https://cdn.other.test/a.png")  # another host


def test_photo_url_that_returns_a_page_is_rejected(tmp_path):
    f = fetcher(lambda r: site(r, b"<html>not found</html>"), tmp_path)
    with pytest.raises(httpx.HTTPError):
        f.get_bytes("https://shop.test/image/a.png")


def test_photo_block_stops_the_run(tmp_path):
    f = fetcher(lambda r: httpx.Response(200, text="") if r.url.path == "/robots.txt" else httpx.Response(429), tmp_path)
    with pytest.raises(Blocked):
        f.get_bytes("https://shop.test/image/a.png")


def test_candidate_photos_stop_after_a_block(monkeypatch):
    calls = []

    class F:
        def load_robots(self): pass

        def get_bytes(self, url):
            calls.append(url)
            raise Blocked("429")
    ph = bot.SourcePhotos()
    ph.fetcher = F()
    assert ph.get("https://x/a.jpg") is None and ph.get("https://x/b.jpg") is None
    assert calls == ["https://x/a.jpg"]  # the second photo is not even requested


def test_candidate_photo_not_allowed_is_skipped_quietly():
    class F:
        def load_robots(self): pass

        def get_bytes(self, url): raise NotAllowed(url)
    ph = bot.SourcePhotos()
    ph.fetcher = F()
    assert ph.get("https://x/a.jpg") is None and not ph.stopped


# --- site writes ------------------------------------------------------------------------------
def api(handler):
    c = Catalog("https://site.test", httpx.Client(transport=httpx.MockTransport(handler)))
    c.token = "t"
    return c


def test_dry_run_never_writes(monkeypatch):
    monkeypatch.setenv("DRY_RUN", "true")
    seen = []
    c = api(lambda r: seen.append(r) or httpx.Response(200, json={"doc": {"id": 1}, "docs": [], "hasNextPage": False}))
    reads = len(seen)
    for call in (lambda: c.post("products", {}), lambda: c.patch("products/1", {}), lambda: c.upload_image(png(), "a.png", "x"),
                 lambda: c.create_product(name="A", brand="B", category_id=1, type_uz=None, sku="S", volume=None, price_uzs=1, image_ids=[])):
        with pytest.raises(CatalogError):
            call()
    assert all(r.method == "GET" for r in seen)  # reads are fine; nothing was written


@pytest.mark.parametrize("value", ["true", "TRUE", "", " yes ", "0", "1"])
def test_only_exact_false_turns_dry_run_off(monkeypatch, value):
    monkeypatch.setenv("DRY_RUN", value)
    assert settings.dry_run()


def test_dry_run_off_needs_false(monkeypatch):
    monkeypatch.setenv("DRY_RUN", " False ")
    assert not settings.dry_run()


def test_site_refusal_becomes_a_short_message(monkeypatch):
    monkeypatch.setenv("DRY_RUN", "false")
    c = api(lambda r: httpx.Response(400, json={"errors": [{"message": "The following field is invalid: slug"}]}))
    with pytest.raises(CatalogError, match="slug"):
        c.post("products", {})


def test_expired_token_is_renewed_once(monkeypatch):
    monkeypatch.setenv("DRY_RUN", "false")
    monkeypatch.setenv("YEPPO_API_EMAIL", "a@b.c")
    monkeypatch.setenv("YEPPO_API_PASSWORD", "x")
    calls = []

    def h(r):
        calls.append(r.url.path)
        if r.url.path == "/api/users/login":
            return httpx.Response(200, json={"token": "fresh"})
        return httpx.Response(401) if r.headers["authorization"] == "JWT t" else httpx.Response(200, json={"doc": {"id": 7}})
    c = api(h)
    assert c.post("products", {})["id"] == 7
    assert calls == ["/api/products", "/api/users/login", "/api/products"]


def test_photo_upload_keeps_the_real_file_type(monkeypatch):
    monkeypatch.setenv("DRY_RUN", "false")
    got = {}

    def h(r):
        got["body"] = r.content
        return httpx.Response(200, json={"doc": {"id": 5}})
    assert api(h).upload_image(png(), "a.png?v=3", "Alt") == 5
    assert b'filename="a.png"' in got["body"] and b"image/png" in got["body"]


def test_blank_api_url_falls_back(monkeypatch):
    monkeypatch.setenv("YEPPO_API_URL", "")
    assert Catalog().base == "http://localhost:3000"


def test_slugs():
    assert slugify("  Ünïcode — Essence!! ") == "unicode-essence"
    assert product_slug("COSRX", "Snail Essence") == "cosrx-snail-essence"
    assert product_slug("COSRX", "COSRX Snail Essence") == "cosrx-snail-essence"  # brand not repeated


def test_demand_ignores_unpaid_and_cancelled_orders(monkeypatch):
    seen = {}
    c = api(lambda r: seen.update(dict(r.url.params)) or httpx.Response(200, json={"docs": [], "hasNextPage": False}))
    c.sold_skus(30)
    assert seen["where[paymentStatus][equals]"] == "paid" and seen["where[status][not_equals]"] == "cancelled"


# --- source parsing and prices ----------------------------------------------------------------
def product_page(offers, brand=None, name="Test Serum 30ml"):
    d = {"@type": "Product", "name": name, "model": "M1", "image": "https://x/i.jpg", "offers": offers}
    if brand is not None:
        d["brand"] = brand
    return f'<script type="application/ld+json">{json.dumps(d)}</script>'


def test_product_page_variants_of_the_schema():
    ok = {"price": "1,234.50", "availability": "https://schema.org/InStock"}
    assert qdepot.parse_product(product_page(ok, {"name": "COSRX"}), "u").price_usd == Decimal("1234.50")
    assert qdepot.parse_product(product_page([ok], "COSRX"), "u").brand == "COSRX"  # list of offers, brand as a string
    assert qdepot.parse_product(product_page({"price": "abc"}), "u") is None  # unreadable price
    assert qdepot.parse_product(product_page("nope"), "u") is None
    assert qdepot.parse_product(product_page(ok, None), "u").brand == ""


def test_zero_or_missing_cbu_rate_is_not_used(tmp_path, monkeypatch):
    monkeypatch.setattr(pricing, "DATA", tmp_path)
    for body in ([{"Rate": "0"}], [{"Rate": "nan"}], []):
        c = httpx.Client(transport=httpx.MockTransport(lambda r, b=body: httpx.Response(200, json=b)))
        try:
            rate = pricing.usd_rate(c)
        except Exception:
            continue  # nothing to fall back to: failing loudly is right
        assert rate > 0
    assert not (tmp_path / "cbu_usd.json").exists()


# --- content ----------------------------------------------------------------------------------
def prod(**kw):
    return {"id": 1, "slug": "a", "name": "A", "brand": {"name": "B"}, "category": {"slug": "serum"}, "images": [],
            "variants": [{"sku": "big", "price": 300000, "stock": 5, "volume": "100 ml"},
                         {"sku": "small", "price": 120000, "stock": 5, "volume": "30 ml"},
                         {"sku": "gone", "price": 50000, "stock": 0, "volume": "10 ml"}], **kw}


def test_price_and_volume_belong_to_the_same_variant():
    p = prod()
    assert content.min_price(p) == 120000
    f = content.facts(p, None)
    assert f["volume"] == "30 ml"  # before: the first in-stock variant (100 ml) was shown next to the cheapest price


def test_catalog_text_is_cut_like_the_ai_text():
    limit = settings.cfg()["content"]["max_body_chars"]
    long = " ".join(["gap"] * 500)
    f = {"brand": "B", "name": "A", "need": {"uz": long, "ru": long}, "summary": {"uz": long, "ru": ""}}
    out = content.fallback_body(f)
    assert len(out["uz"]) <= limit + 1 and out["uz"].endswith("…")


def test_old_packages_are_deleted_new_and_foreign_folders_kept(tmp_path):
    now = datetime(2026, 6, 30, tzinfo=TZ)
    keep_days = settings.cfg()["content"]["keep_days"]
    for name in ((now - timedelta(days=keep_days + 1)).date().isoformat(), (now - timedelta(days=2)).date().isoformat(), "notes"):
        (tmp_path / name).mkdir()
        (tmp_path / name / "x.jpg").write_bytes(b"x")
    assert content.prune(tmp_path, now) == 1
    assert sorted(p.name for p in tmp_path.iterdir()) == sorted(["notes", (now - timedelta(days=2)).date().isoformat()])
    assert content.prune(tmp_path / "missing", now) == 0


# --- media ------------------------------------------------------------------------------------
def test_transparent_photo_lies_on_white_not_black():
    im = media.load(png("RGBA", (0, 0, 0, 0)))
    assert im.mode == "RGB" and im.getpixel((5, 5)) == (255, 255, 255)
    assert media.is_packshot(png("RGBA", (0, 0, 0, 0)))


def test_unreadable_photo_is_detected():
    assert media.readable(png()) and not media.readable(b"<html>404</html>") and not media.readable(b"")


def test_reel_failure_keeps_cards_and_caption(tmp_path, monkeypatch):
    def boom(*a, **k): raise RuntimeError("ffmpeg xato (1): boom")
    monkeypatch.setattr(media, "reels", boom)
    st = {"deliveryDays": 1, "tashkentDays": 1, "returnDays": 14}
    jpg = io.BytesIO()
    Image.new("RGB", (900, 900), "pink").save(jpg, "JPEG")
    monkeypatch.setattr(content, "download", lambda *a, **k: [jpg.getvalue()])
    monkeypatch.setattr(content, "write_body", lambda f: ({"uz": "Matn", "ru": "Текст"}, "catalog"))
    pkg = content.build({**prod(), "images": [{"url": "/x.jpg"}]}, None, {**st}, "https://site.test", tmp_path)
    assert pkg.reel_error and "boom" in pkg.reel_error
    assert pkg.files and all(f.suffix == ".jpg" for f in pkg.files)
    assert (tmp_path / "a" / "caption.txt").exists() or any((d / "caption.txt").exists() for d in tmp_path.rglob("*") if d.is_dir())


# --- Claude calls -----------------------------------------------------------------------------
@pytest.mark.parametrize("exc", [
    anthropic.APIConnectionError(request=httpx.Request("POST", "https://api.anthropic.com")),
    anthropic.RateLimitError("slow down", response=httpx.Response(429, request=httpx.Request("POST", "https://api.anthropic.com")), body=None),
    RuntimeError("ANTHROPIC_API_KEY is not set"),
])
def test_any_claude_failure_is_an_llm_error(monkeypatch, exc):
    class C:
        class beta:
            class messages:
                @staticmethod
                def create(**k): raise exc
    monkeypatch.setattr(llm, "client", lambda: C)
    with pytest.raises(llm.LlmError):
        llm.complete("caption", "system", "user")


# --- settings ---------------------------------------------------------------------------------
def test_dotenv_reads_like_docker_compose(tmp_path, monkeypatch):
    f = tmp_path / ".env"
    f.write_text('A_PLAIN=value # comment\nA_QUOTED="has # hash" # trailing\nA_SINGLE=\'x y\'\n# skipped\nA_EMPTY=\n')
    for k in ("A_PLAIN", "A_QUOTED", "A_SINGLE", "A_EMPTY"):
        monkeypatch.delenv(k, raising=False)
    settings._load_dotenv(f)
    try:
        assert os.environ["A_PLAIN"] == "value" and os.environ["A_QUOTED"] == "has # hash"
        assert os.environ["A_SINGLE"] == "x y" and os.environ["A_EMPTY"] == ""
    finally:
        for k in ("A_PLAIN", "A_QUOTED", "A_SINGLE", "A_EMPTY"):
            os.environ.pop(k, None)
