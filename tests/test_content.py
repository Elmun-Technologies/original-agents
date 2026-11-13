import re
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import pytest
from PIL import Image
from sqlalchemy import select

from app import config
from app.agents import content
from app.agents.content import ContentError, check_body, create_draft
from app.config import TZ
from app.db.models import Post, Product, ProductSize, Quote
from app.media import render
from app.media.render import CardData, render_card, render_story
from app.pricing.rates import Rate
from app.uz import OKINA, format_uzs, uz

NOW = datetime(2026, 11, 14, 10, tzinfo=TZ)
FX = {"USD": Rate(Decimal("12000"), NOW), "CNY": Rate(Decimal("1800"), NOW)}
BODY = "New Balance 530 — 2000-yillar yugurish uslubidagi model. Taglikdagi ABZORB yumshoq amortizatsiya beradi."


# --- Uzbek text ---

@pytest.mark.parametrize("raw,expected", [
    ("o'lcham", "oʻlcham"), ("O'zbekiston", "Oʻzbekiston"), ("g‘alaba", "gʻalaba"),
    ("to`g`ri", "toʻgʻri"), ("so’m", "soʻm"), ("oʼlcham", "oʻlcham"), ("bog'", "bogʻ"),
    ("ma'lumot", "ma'lumot"),                 # tutuq belgisi untouched
    ("Air Jordan 1 'Chicago'", "Air Jordan 1 'Chicago'"),  # quotes untouched
])
def test_uz_normalize(raw, expected):
    assert uz(raw) == expected


def test_one_character_for_o_and_g():
    text = uz("o'lcham g‘alaba so`m to’g’ri")
    assert text == "oʻlcham gʻalaba soʻm toʻgʻri" and text.count(OKINA) == 5
    assert not re.search(r"[oOgG]['’‘`ʼ´]", text)


@pytest.mark.parametrize("n,s", [(1690000, "1 690 000 soʻm"), (990000, "990 000 soʻm"),
                                 (12340000, "12 340 000 soʻm")])
def test_format_uzs(n, s):
    assert format_uzs(n) == s


def glyph(f, ch):
    m = f.getmask(ch)
    return m.size, bytes(m)


@pytest.mark.parametrize("weight", ["Medium", "SemiBold", "Bold", "ExtraBold"])
def test_inter_has_every_glyph_we_render(weight):
    f = render.font(weight, 60)
    notdef = glyph(f, "")  # private-use char -> .notdef box
    s = config.settings()["content"]
    text = (render.UI_TEXT + s["badge"] + s["cta"] + format_uzs(1234567) + "Oʻ Gʻ oʻ gʻ ʼ"
            + "Yetkazish: 20–30 kun" + "Кроссовки ЖЁ" + "–—·…")
    missing = {ch for ch in set(text) if not ch.isspace() and glyph(f, ch) == notdef}
    assert not missing, f"Inter-{weight} lacks {missing}"


# --- rendering ---

def card(**kw):
    return CardData(**{"brand": "New Balance", "model": "530 White Silver Navy", "price_uzs": 1690000,
                       "sizes": ["41", "42.5"], "badge": "Original · Poizon tekshiruvi",
                       "delivery": "Yetkazish: 20–30 kun", "cta": "Buyurtma uchun yozing."} | kw)


def test_card_placeholder(tmp_path):
    p = render_card(card(), None, tmp_path / "c.png")
    im = Image.open(p)
    assert im.size == (1080, 1350) and im.mode == "RGB"
    assert im.getpixel((200, 700)) == render.PLACEHOLDER          # gray "RASM KERAK" area


def test_card_with_photo_is_only_resized(tmp_path):
    photo = tmp_path / "p.jpg"
    Image.new("RGB", (1600, 1200), (200, 30, 30)).save(photo, quality=100)
    im = Image.open(render_card(card(), photo, tmp_path / "c.png"))
    r, g, b = im.getpixel((540, 440))
    assert abs(r - 200) < 6 and g < 40 and b < 40                  # colors unchanged


def test_story_size(tmp_path):
    assert Image.open(render_story(card(), None, tmp_path / "s.png")).size == (1080, 1920)


def test_long_price_and_name_fit(tmp_path):
    from PIL import ImageDraw
    d = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    price = format_uzs(123_456_790)
    f = render.fit_font(d, price, "ExtraBold", 108, 960, 70)
    assert render.text_w(d, price, f) <= 960
    lines = render.wrap(d, "Very Long Model Name " * 10, render.font("Bold", 50), 960, 2)
    assert len(lines) == 2 and lines[-1].endswith("…")
    render_card(card(model="Very Long Model Name " * 10, price_uzs=123_456_790), None, tmp_path / "c.png")


# --- LLM body checks ---

@pytest.mark.parametrize("text,problem", [
    ("Bu lyuks kopiya emas", "replika"),
    ("Nike rasmiy do'koni mahsuloti", "rasmiy"),
    ("Official store sifati", "rasmiy"),
    ("Faqat 2 ta qoldi!", "kamyoblik"),
    ("Oxirgisi, shoshiling", "kamyoblik"),
    ("Narxi atigi 1 690 000 so'm", "narx"),
    ("Qulay #krossovka", "hashtag"),
    ("Batafsil: https://t.me/x", "havola"),
    ("Aloqa: +998 90 123 45 67", "shaxsiy"),
    ("x" * 500, "juda uzun"),
    ("   ", "boʻsh"),
])
def test_body_rejected(text, problem):
    assert any(problem in p for p in check_body(text, 450))


def test_good_body_passes():
    assert check_body(uz(BODY), 450) == []


# --- draft ---

class FakeLlm:
    def __init__(self, text=BODY):
        self.text, self.calls = text, []

    def complete(self, purpose, system, user, **kw):
        self.calls.append((purpose, system, user))
        return self.text


def product(db, sizes=(("41", 489), ("42.5", 509)), **kw):
    p = Product(**{"source": "manual_sheet", "origin": "dewu", "brand": "New Balance", "model_name": "530",
                   "style_code": "MR530SG", "category": "sneakers", "gender": "unisex",
                   "colorway": "White Silver Navy", "description": "Retro running silhouette with ABZORB midsole"} | kw,
                sizes=[ProductSize(size_eu=sz, source_price=pr, source_currency="CNY") for sz, pr in sizes])
    db.add(p)
    db.flush()
    return p


def test_create_draft(db, tmp_path):
    fake = FakeLlm()
    d = create_draft(db, product(db), fake, FX, now=NOW, out_root=tmp_path)
    post = db.scalar(select(Post))
    assert post is d.post and post.status == "draft"
    assert db.query(Quote).count() == 2
    q41 = db.scalar(select(Quote).where(Quote.size == "41"))
    assert q41.breakdown["source_currency"] == "CNY" and q41.valid_until > NOW

    cap = post.caption_uz
    for must in ["soat amal qiladi", "oʻlcham sababli qaytarilmaydi", "Yetkazish: 20–30 kun",
                 "Original: Poizon orqali", "Oʻlchamlar: 41, 42.5", format_uzs(q41.sell_price_uzs) + " dan"]:
        assert must in cap
    assert len(cap) <= 1024
    tags = re.findall(r"#\w+", cap)
    assert 5 <= len(tags) <= 8 and "#newbalance" in tags and "#krossovka" in tags
    assert not re.search(r"[oOgG]['’‘`ʼ´]", cap)          # oʻ/gʻ only with U+02BB
    assert "oʻ" in cap

    assert [Path(p).name for p in post.image_paths] == ["card_1.png", "story.png"]
    assert all(Path(p).exists() for p in post.image_paths)
    assert any("Rasm kerak" in n for n in d.notes)

    purpose, system, user = fake.calls[0]
    assert purpose == "content" and system == content.PROMPT.read_text(encoding="utf-8")
    assert "ABZORB" in user and "price" not in user and "489" not in user   # facts only, no prices


def test_own_photos_used(db, tmp_path, monkeypatch):
    photos = tmp_path / "photos"
    (photos / "MR530SG").mkdir(parents=True)
    for i in range(7):
        Image.new("RGB", (800, 800), (10 * i, 50, 50)).save(photos / "MR530SG" / f"{i}.jpg")
    s = config.settings()
    monkeypatch.setitem(s["content"], "photos_dir", str(photos))
    d = create_draft(db, product(db), FakeLlm(), FX, now=NOW, out_root=tmp_path / "out")
    assert len(d.post.image_paths) == 5 + 1          # cards_max + story
    assert not any("Rasm kerak" in n for n in d.notes)


def test_single_price_no_from_label(db, tmp_path):
    d = create_draft(db, product(db, sizes=(("42", 500),)), FakeLlm(), FX, now=NOW, out_root=tmp_path)
    assert " dan " not in d.post.caption_uz


def test_bad_llm_text_creates_nothing(db, tmp_path):
    with pytest.raises(ContentError, match="kamyoblik"):
        create_draft(db, product(db), FakeLlm("Faqat 2 ta qoldi, shoshiling!"), FX, now=NOW, out_root=tmp_path)
    assert db.query(Post).count() == 0 and db.query(Quote).count() == 0


def test_inactive_or_sizeless_product(db, tmp_path):
    with pytest.raises(ContentError, match="faol emas"):
        create_draft(db, product(db, is_active=False, rejected_reason="replika: x"), FakeLlm(), FX, now=NOW)
    p = product(db, style_code="NOSIZE", sizes=(("42", 500),))
    p.sizes[0].available = False
    with pytest.raises(ContentError, match="oʻlcham yoʻq"):
        create_draft(db, p, FakeLlm(), FX, now=NOW)


def test_stale_rate_warning_reaches_admin_notes(db, tmp_path):
    fx = {"USD": FX["USD"], "CNY": Rate(Decimal("1800"), NOW, Decimal("0.01"), "CBU CNY kursi olinmadi.")}
    d = create_draft(db, product(db), FakeLlm(), fx, now=NOW, out_root=tmp_path)
    assert d.notes.count("CBU CNY kursi olinmadi.") == 1
