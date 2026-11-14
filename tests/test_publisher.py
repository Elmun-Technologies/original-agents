from datetime import timedelta
from decimal import Decimal
from pathlib import Path

import pytest
from PIL import Image

from app import config
from app.agents import publisher
from app.agents.content import create_draft, post_quotes
from app.db.models import Post, TrendNote
from app.pricing.rates import Rate
from tests.helpers import BODY, FX, NOW, FakeLlm, add_photos, make_product


@pytest.fixture
def photos(tmp_path, monkeypatch):
    root = tmp_path / "photos"
    monkeypatch.setitem(config.settings()["content"], "photos_dir", str(root))
    return root


def skus(picked):
    return [(p.style_code, stock) for p, stock in picked]


# --- selection ---

def test_pick_order_stock_trend_newest(db):
    old = make_product(db, sku="OLD", brand="Asics", model="Gel-1130")
    trend = make_product(db, sku="TREND", brand="Nike", model="Dunk Low")
    new = make_product(db, sku="NEW", brand="Adidas", model="Samba")
    stock = make_product(db, sku="STOCK", brand="Puma", model="Speedcat")
    stock.sizes[0].stock_qty, stock.sizes[0].stock_cost_uzs = 1, 900_000
    old.first_seen_at, trend.first_seen_at = NOW - timedelta(days=5), NOW - timedelta(days=4)
    new.first_seen_at, stock.first_seen_at = NOW - timedelta(days=1), NOW - timedelta(days=9)
    db.add(TrendNote(text="Nike Dunk koʻp soʻralyapti", created_at=NOW - timedelta(days=2)))
    db.add(TrendNote(text="Asics juda zoʻr", created_at=NOW - timedelta(days=60)))   # too old
    db.flush()
    assert skus(publisher.pick_products(db, NOW, 8)) == [
        ("STOCK", True), ("TREND", False), ("NEW", False), ("OLD", False)]
    assert skus(publisher.pick_products(db, NOW, 2)) == [("STOCK", True), ("TREND", False)]


def test_diversity_caps(db):
    for i, model in enumerate(["530", "530", "990", "2002R"]):
        make_product(db, sku=f"NB{i}", model=model)               # same brand New Balance
    make_product(db, sku="NK1", brand="Nike", model="Dunk Low")
    picked = skus(publisher.pick_products(db, NOW, 8))
    assert [s for s, _ in picked].count("NK1") == 1
    nb = [s for s, _ in picked if s.startswith("NB")]
    assert len(nb) == 2 and not {"NB0", "NB1"} <= set(nb)        # max 2 per brand, 1 per model


def test_caps_count_drafts_already_made_today(db, tmp_path):
    a = make_product(db, sku="NB-A", model="530")
    make_product(db, sku="NB-B", model="990")
    make_product(db, sku="NB-C", model="2002R")
    create_draft(db, a, FakeLlm(), FX, now=NOW, out_root=tmp_path)
    picked = publisher.pick_products(db, NOW, 8)
    assert len(picked) == 1 and picked[0][0].style_code in ("NB-B", "NB-C")   # one NB slot left today


def test_excluded_products(db, tmp_path):
    posted = make_product(db, sku="POSTED", brand="A")
    create_draft(db, posted, FakeLlm(), FX, now=NOW - timedelta(days=3), out_root=tmp_path)
    make_product(db, sku="REPLICA", brand="B", is_active=False, rejected_reason="replika: seller_note='1:1'")
    make_product(db, sku="INACTIVE", brand="C", is_active=False, rejected_reason="oʻlcham: …")
    assert publisher.pick_products(db, NOW, 8) == []


def test_stock_repost_after_14_days(db, tmp_path):
    p = make_product(db, sku="STK")
    p.sizes[0].stock_qty, p.sizes[0].stock_cost_uzs = 1, 900_000
    d = create_draft(db, p, FakeLlm(), FX, now=NOW - timedelta(days=20), out_root=tmp_path, stock=True)
    d.post.status, d.post.published_at = "published", NOW - timedelta(days=10)
    db.flush()
    assert publisher.pick_products(db, NOW, 8) == []
    d.post.published_at = NOW - timedelta(days=15)
    assert skus(publisher.pick_products(db, NOW, 8)) == [("STK", True)]


# --- daily drafts ---

@pytest.fixture
def manual(monkeypatch):
    monkeypatch.setitem(config.settings(), "auto_publish", False)


def test_daily_drafts_continue_after_one_failure(db, tmp_path, manual):
    make_product(db, sku="GOOD1", brand="A", model="m1", description="good")
    make_product(db, sku="BAD", brand="B", model="m2", description="bad")
    make_product(db, sku="GOOD2", brand="C", model="m3", description="good")
    db.commit()  # products come committed from the sheet import
    llm = FakeLlm(lambda user: "Faqat 2 ta qoldi!" if '"bad"' in user else BODY)
    res = publisher.make_daily_drafts(db, llm, FX, NOW, out_root=tmp_path)
    assert len(res.drafts) == 2 and len(res.errors) == 1 and "BAD" in res.errors[0]
    assert db.query(Post).count() == 2
    assert any("reja: 5–8" in n for n in res.notes) and any("Rasm kerak" in n for n in res.notes)


def test_paused_makes_nothing(db, tmp_path):
    make_product(db)
    publisher.set_paused(db, True)
    res = publisher.make_daily_drafts(db, FakeLlm(), FX, NOW, out_root=tmp_path)
    assert res.drafts == [] and "Pauza" in res.notes[0]
    publisher.set_paused(db, False)
    assert not publisher.is_paused(db)


# --- approval ---

def draft(db, tmp_path, **kw):
    p = make_product(db, **kw)
    return create_draft(db, p, FakeLlm(), FX, now=NOW, out_root=tmp_path).post, p


def test_approve_requires_photos_then_rerenders(db, tmp_path, photos):
    post, p = draft(db, tmp_path)
    out = publisher.approve(db, post.id, 42, FX, NOW, out_root=tmp_path)
    assert not out.ok and "surat yoʻq" in out.message and post.status == "draft"
    add_photos(photos, p.style_code, 3)
    out = publisher.approve(db, post.id, 42, FX, NOW, out_root=tmp_path)
    assert out.ok and post.status == "approved" and post.approved_by == 42
    assert [Path(x).name for x in post.image_paths] == ["card_1.png", "card_2.png", "card_3.png", "story.png"]
    assert Image.open(post.image_paths[0]).getpixel((540, 440)) != (217, 217, 217)   # real photo, not placeholder


def test_approve_blocks_on_rate_change(db, tmp_path, photos):
    post, p = draft(db, tmp_path)
    add_photos(photos, p.style_code)
    fx = {"USD": FX["USD"], "CNY": Rate(Decimal("1980"), NOW)}            # CNY +10%
    out = publisher.approve(db, post.id, 42, fx, NOW, out_root=tmp_path)
    assert not out.ok and post.status == "draft"
    assert "kurs +10.0%" in out.message and "manba narxi +0.0%" in out.message
    assert publisher.approve(db, post.id, 42, fx, NOW, out_root=tmp_path).ok   # admin saw it, approves again


def test_approve_blocks_on_source_change(db, tmp_path, photos):
    post, p = draft(db, tmp_path)
    add_photos(photos, p.style_code)
    p.sizes[0].source_price = Decimal("600")                              # 489 -> 600 CNY
    out = publisher.approve(db, post.id, 42, FX, NOW, out_root=tmp_path)
    assert not out.ok and "manba narxi +22.7%, kurs +0.0%" in out.message


def test_small_change_approves_with_info(db, tmp_path, photos):
    post, p = draft(db, tmp_path)
    add_photos(photos, p.style_code)
    fx = {"USD": FX["USD"], "CNY": Rate(Decimal("1820"), NOW)}            # +1.1%
    out = publisher.approve(db, post.id, 42, fx, NOW, out_root=tmp_path)
    assert out.ok and "→" in out.message


def test_edit_body_same_checks(db, tmp_path):
    post, _ = draft(db, tmp_path)
    before = post.caption_uz
    bad = publisher.edit_body(db, post.id, "Rasmiy diler narxi, oxirgisi!", FX, NOW, out_root=tmp_path)
    assert not bad.ok and "rasmiy" in bad.message and "kamyoblik" in bad.message
    assert db.get(Post, post.id).caption_uz == before
    ok = publisher.edit_body(db, post.id, "Yangi matn: qulay va yengil model o'lcham bo'yicha.", FX, NOW,
                             out_root=tmp_path)
    assert ok.ok and "Yangi matn: qulay va yengil model oʻlcham boʻyicha." in post.caption_uz
    assert post.body_uz.startswith("Yangi matn") and "soat amal qiladi" in post.caption_uz


def test_reject_and_wrong_state(db, tmp_path):
    post, _ = draft(db, tmp_path)
    assert publisher.reject(db, post.id).ok and post.status == "rejected"
    with pytest.raises(Exception, match="holati"):
        publisher.approve(db, post.id, 1, FX, NOW)


def test_refresh_price_reports_change(db, tmp_path):
    post, _ = draft(db, tmp_path)
    out = publisher.refresh_price(db, post.id, {"USD": FX["USD"], "CNY": Rate(Decimal("1900"), NOW)}, NOW,
                                  out_root=tmp_path)
    assert out.ok and "kurs +5.6%" in out.message
    assert len(post_quotes(db, post)) == 2


# --- publishing ---

def test_publish_queue_and_fresh_quotes(db, tmp_path, photos):
    p1, a = draft(db, tmp_path, sku="A1", brand="A")
    p2, b = draft(db, tmp_path, sku="B1", brand="B")
    for p in (a, b):
        add_photos(photos, p.style_code)
    publisher.approve(db, p2.id, 1, FX, NOW, out_root=tmp_path)
    publisher.approve(db, p1.id, 1, FX, NOW + timedelta(minutes=5), out_root=tmp_path)
    assert publisher.next_to_publish(db) is p2                     # first approved goes first
    publisher.set_paused(db, True)
    assert publisher.next_to_publish(db) is None
    publisher.set_paused(db, False)

    later = NOW + timedelta(hours=9)
    out = publisher.prepare_publish(db, p2, FX, later, out_root=tmp_path)
    assert out.ok and all(q.valid_until == later + timedelta(hours=24) for q in post_quotes(db, p2))
    publisher.mark_published(db, p2, 777, later)
    assert (p2.status, p2.telegram_message_id) == ("published", 777)
    assert publisher.next_to_publish(db) is p1


def test_publish_sends_back_on_big_change(db, tmp_path, photos):
    post, p = draft(db, tmp_path)
    add_photos(photos, p.style_code)
    publisher.approve(db, post.id, 1, FX, NOW, out_root=tmp_path)
    out = publisher.prepare_publish(db, post, {"USD": FX["USD"], "CNY": Rate(Decimal("2000"), NOW)}, NOW,
                                    out_root=tmp_path)
    assert not out.ok and post.status == "draft" and "kurs" in out.message


def test_admin_summary_shows_cost_and_profit(db, tmp_path):
    post, _ = draft(db, tmp_path)
    text = publisher.admin_summary(db, post)
    assert "manba 489 CNY" in text and "foyda" in text and "soʻm" in text


# --- ranking ("Solishtiruvchi") ---

def test_rank_sold_price_sizes_season(db):
    cheap_hit = make_product(db, sku="HIT", brand="A", model="m1", sold_count=9000)
    make_product(db, sku="NOSALES", brand="B", model="m2")
    make_product(db, sku="PRICEY", brand="C", model="m3", sold_count=9000, sizes=(("41", 9000),))
    make_product(db, sku="ODDSIZE", brand="D", model="m4", sold_count=9000, sizes=(("47", 489),), gender="men")
    winter = make_product(db, sku="PUFF", brand="E", model="m5", category="puffer", sizes=(("M", 489),))
    order = [p.style_code for p, _ in publisher.pick_products(db, NOW, 8, FX)]
    assert order[0] == "HIT" and order.index("PRICEY") > 0 and order.index("ODDSIZE") > 0
    terms = []
    summer = NOW.replace(month=7)
    assert publisher.rank_score(winter, terms, NOW, FX) > publisher.rank_score(winter, terms, summer, FX)
    assert publisher.rank_score(cheap_hit, terms, summer, FX) > publisher.rank_score(cheap_hit, terms, NOW, FX)


# --- auto mode ---

def test_auto_mode_approves_good_and_reports_bad(db, tmp_path, photos):
    make_product(db, sku="WITHPHOTO", brand="A", model="m1", images=["https://img/x.jpg"])
    make_product(db, sku="NOPHOTO", brand="B", model="m2")
    db.commit()
    calls = []

    def fake_fetch(product):
        calls.append(product.style_code)
        if product.images:
            add_photos(photos, product.style_code, 1)
        return []
    res = publisher.make_daily_drafts(db, FakeLlm(), FX, NOW, out_root=tmp_path, fetch_images=fake_fetch)
    status = {db.get(publisher.Product, p.product_id).style_code: p.status for p in db.query(Post)}
    assert status == {"WITHPHOTO": "approved", "NOPHOTO": "draft"}
    assert db.query(Post).filter_by(status="approved").one().approved_by is None
    summary = publisher.daily_summary(db, NOW)
    assert "NOPHOTO" in summary and "surat yoʻq" in summary and "Kanalga chiqdi: 0" in summary

    # next day: photo arrived -> the old draft is re-checked and approved
    add_photos(photos, "NOPHOTO", 1)
    publisher.make_daily_drafts(db, FakeLlm(), FX, NOW + timedelta(days=1), out_root=tmp_path, fetch_images=fake_fetch)
    assert db.query(Post).filter_by(status="draft").count() == 0


def test_price_jump_blocks_publish_and_is_in_summary(db, tmp_path, photos):
    post, p = draft(db, tmp_path)
    add_photos(photos, p.style_code)
    publisher.approve(db, post.id, None, FX, NOW, out_root=tmp_path)
    out = publisher.prepare_publish(db, post, {"USD": FX["USD"], "CNY": Rate(Decimal("2000"), NOW)}, NOW,
                                    out_root=tmp_path)
    assert not out.ok and post.status == "draft" and "Ertaga" in out.message
    assert "narx 5% dan koʻp" in publisher.daily_summary(db, NOW)


def test_summary_counts_published_and_waiting_orders(db, tmp_path):
    post, _ = draft(db, tmp_path)
    publisher.mark_published(db, post, 7, NOW)
    s = publisher.daily_summary(db, NOW)
    assert "Kanalga chiqdi: 1" in s and "New Balance 530" in s and "Muammo yoʻq" in s


# --- weekly rhythm: buffer on old prices, repost window, "add products" reminder ---

def test_old_price_gets_safety_buffer(db, tmp_path):
    from app.agents.content import make_quotes
    p = make_product(db, sizes=(("41", 489),))
    p.sizes[0].checked_at = NOW - timedelta(days=2)
    fresh, _ = make_quotes(p, FX, NOW, False)
    p.sizes[0].checked_at = NOW - timedelta(days=4)
    old, _ = make_quotes(p, FX, NOW, False)
    assert "stale_price_buffer_pct" not in fresh[0].breakdown
    assert old[0].breakdown["stale_price_buffer_pct"] == 0.03 and old[0].breakdown["listed_price"] == 489
    assert old[0].breakdown["source_price"] == pytest.approx(489 * 1.03)
    assert old[0].sell_price_uzs > fresh[0].sell_price_uzs


def test_no_repost_within_7_days_then_reminder(db, tmp_path):
    a = make_product(db, sku="A", brand="A", model="m1")
    d = create_draft(db, a, FakeLlm(), FX, now=NOW - timedelta(days=5), out_root=tmp_path)
    publisher.mark_published(db, d.post, 1, NOW - timedelta(days=5))
    b = make_product(db, sku="B", brand="B", model="m2")
    assert skus(publisher.pick_products(db, NOW, 8)) == [("B", False)]          # A posted 5 days ago
    assert "Yangi tovar qoʻshing: ertaga chiqarish uchun 2 ta" not in publisher.daily_summary(db, NOW)
    assert "Yangi tovar qoʻshing" in publisher.daily_summary(db, NOW)           # 1 < min 5
    later = NOW + timedelta(days=3)
    assert skus(publisher.pick_products(db, later, 8)) == [("B", False), ("A", False)]  # never-posted first
