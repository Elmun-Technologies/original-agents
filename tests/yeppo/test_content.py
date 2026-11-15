from datetime import datetime, timedelta

from yeppo_agents import content, store
from yeppo_agents.demand import build
from yeppo_agents.settings import TZ


def prod(slug, brand="COSRX", cat="serum", stock=5, price=219000, **kw):
    return {"id": hash(slug) % 1000, "slug": slug, "name": f"{slug} Serum", "brand": {"name": brand},
            "category": {"slug": cat}, "images": [{"url": "/x.jpg"}],
            "variants": [{"sku": slug, "price": price, "stock": stock, "volume": "30 ml"}], **kw}


def test_pick_rules():
    ps = [prod("a"), prod("b"), prod("c", brand="Anua"), prod("d", stock=0), prod("e", cat="sertifikatlar"),
          {**prod("f", brand="Torriden"), "images": []}]
    got = [p["slug"] for p in content.pick(ps, build(), 5)]
    assert "d" not in got and "e" not in got and "f" not in got
    assert len([s for s in got if s in ("a", "b")]) == 1  # one per brand per day


def test_recently_posted_is_skipped():
    store.record_post("a", "x", [])
    got = [p["slug"] for p in content.pick([prod("a"), prod("b", brand="Anua")], build(), 5)]
    assert got == ["b"]
    later = datetime.now(TZ) + timedelta(days=30)
    assert "a" in [p["slug"] for p in content.pick([prod("a")], build(), 5, now=later)]


def test_problems_catch_dishonest_text():
    assert content.problems("Rasmiy distribyutor sifatida taklif qilamiz")
    assert content.problems("Faqat 2 ta qoldi, shoshiling!")
    assert content.problems("Akneni davolaydi")
    assert content.problems("Narxi 200 000 soʻm")
    assert content.problems("#kbeauty")
    assert not content.problems("Teringizni namlaydi va yorqinlik beradi.")


def test_caption_has_exact_terms():
    p = prod("a")
    cap = content.caption(p, {"uz": "Namlaydi.", "ru": "Увлажняет."}, {"tashkentDays": "1–2", "regionDays": "3–5", "returnDays": 14})
    assert "Narxi: 219 000 soʻm" in cap and "Цена: 219 000 сум" in cap
    assert "1–2 kunda" in cap and "14 kun ichida qaytarish" in cap
    assert "#yeppo" in cap and "#cosrx" in cap and "#serum" in cap


def test_caption_without_store_terms_omits_them():
    cap = content.caption(prod("a"), {"uz": "x", "ru": "y"}, {})
    assert "Yetkazish" not in cap and "qaytarish" not in cap


def test_llm_failure_falls_back_to_catalog_text(monkeypatch):
    from yeppo_agents import llm

    def boom(*a, **k):
        raise llm.LlmError("down")
    monkeypatch.setattr(llm, "complete", boom)
    f = content.facts(prod("a", need="Namlaydi", summary="Yengil serum"), {"need": "Увлажняет", "summary": None})
    body, src = content.write_body(f)
    assert src == "catalog" and body["uz"] == "Namlaydi Yengil serum" and body["ru"] == "Увлажняет"


def test_llm_text_with_price_is_rejected(monkeypatch):
    from yeppo_agents import llm
    monkeypatch.setattr(llm, "complete", lambda *a, **k: '{"uz": "Atigi 99 000 soʻm!", "ru": "Всего 99 000 сум"}')
    body, src = content.write_body(content.facts(prod("a", need="Namlaydi"), None))
    assert src == "catalog"


def test_link_has_utm():
    assert "utm_source=instagram" in content.link("abc") and "/uz/mahsulot/abc?" in content.link("abc")
