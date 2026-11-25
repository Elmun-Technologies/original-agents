import asyncio

import httpx

from yeppo_agents import bot as yb
from yeppo_agents import store


class FakeBot:
    def __init__(self, fail=False):
        self.sent, self.fail = [], fail

    async def send_photo(self, uid, photo, **kw):
        if self.fail:
            raise RuntimeError("network")
        self.sent.append(("photo", uid, kw["caption"]))

    async def send_message(self, uid, text, **kw):
        if self.fail:
            raise RuntimeError("network")
        self.sent.append(("msg", uid, text))


def cand(url="https://www.q-depot.com/a", img=None):
    return store.upsert_candidate(url=url, name="Anua Heartleaf 77 Toner", brand="Anua", model="AN1", category="toner",
                                  volume="250 ml", img=img, price_usd=25, sell_uzs=464000, profit_uzs=120000,
                                  score=6, reasons=["admin trendi"])


class NoPhotos:
    """Candidate photos would come from the source site: no network in tests."""
    def __init__(self, data=None): self.data, self.asked = data, []
    def get(self, url): self.asked.append(url); return self.data


def test_candidates_marked_sent_only_when_delivered(monkeypatch):
    monkeypatch.setenv("TELEGRAM_ADMIN_IDS", "1")
    monkeypatch.setattr(yb, "SourcePhotos", NoPhotos)
    cid = cand()
    assert asyncio.run(yb.send_candidates(FakeBot(fail=True))) == 0
    assert store.candidate(cid)["status"] == "new"
    b = FakeBot()
    assert asyncio.run(yb.send_candidates(b)) == 1
    assert store.candidate(cid)["status"] == "sent"
    assert "464 000 soʻm" in b.sent[0][2] and "Anua" in b.sent[0][2]


def test_add_candidate_respects_dry_run(monkeypatch):
    monkeypatch.setenv("DRY_RUN", "true")
    cid = cand()
    assert "DRY_RUN" in asyncio.run(yb.add_candidate(cid))
    assert store.candidate(cid)["status"] == "new"


def test_add_candidate_creates_product_with_zero_stock(monkeypatch):
    monkeypatch.setenv("DRY_RUN", "false")
    monkeypatch.setenv("YEPPO_API_EMAIL", "a@b.c")
    monkeypatch.setenv("YEPPO_API_PASSWORD", "x")
    created = {}

    def handler(req):
        p = req.url.path
        if p == "/api/users/login":
            return httpx.Response(200, json={"token": "t"})
        if p == "/api/categories":
            return httpx.Response(200, json={"docs": [{"slug": "toner", "id": 7}], "hasNextPage": False})
        if p == "/api/brands" and req.method == "GET":
            return httpx.Response(200, json={"docs": []})
        if p == "/api/brands":
            return httpx.Response(201, json={"doc": {"id": 3}})
        if p == "/api/products":
            import json
            created.update(json.loads(req.content))
            return httpx.Response(201, json={"doc": {"id": 42, "slug": "anua-heartleaf-77-toner"}})
        return httpx.Response(404)

    real = yb.Catalog.__init__
    monkeypatch.setattr(yb.Catalog, "__init__", lambda self, *a, **k: real(self, "http://site", httpx.Client(transport=httpx.MockTransport(handler))))
    cid = cand()
    msg = asyncio.run(yb.add_candidate(cid))
    assert "/admin/collections/products/42" in msg
    assert created["category"] == 7 and created["brand"] == 3
    assert created["variants"] == [{"sku": "QD-AN1", "volume": "250 ml", "price": 464000, "stock": 0}]
    assert store.candidate(cid)["status"] == "added"


def test_dispatcher_builds(monkeypatch):
    monkeypatch.setenv("TELEGRAM_ADMIN_IDS", "1")
    from aiogram import Bot
    yb.build_dispatcher(Bot("123:abc"))


def test_candidate_with_a_photo_goes_out_as_a_photo(monkeypatch):
    monkeypatch.setenv("TELEGRAM_ADMIN_IDS", "1")
    photos = NoPhotos(b"\xff\xd8img")
    monkeypatch.setattr(yb, "SourcePhotos", lambda: photos)
    cand(img="https://www.q-depot.com/image/a.jpg")
    b = FakeBot()
    assert asyncio.run(yb.send_candidates(b)) == 1
    assert b.sent[0][0] == "photo" and photos.asked == ["https://www.q-depot.com/image/a.jpg"]
