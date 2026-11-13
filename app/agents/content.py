"""Content agent (CLAUDE.md §6.4): quotes + caption + images -> a draft Post.

The LLM writes only the descriptive body (facts from the source). Everything that must be
honest and exact — price, sizes, delivery time, 24h validity, no-return-for-size, originality,
call to action, hashtags — is added by code, so the model cannot get it wrong.
"""
import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app import config, llm
from app.config import TZ
from app.db.models import Post, Product, Quote
from app.media.render import CardData, render_card, render_story
from app.pricing.calculator import quote_from_source
from app.pricing.rates import Rate
from app.scraping import blocklist
from app.uz import format_uzs, uz

PROMPT = config.ROOT / "prompts" / "content_uz.md"
APPAREL_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL"]
PHOTO_EXT = (".jpg", ".jpeg", ".png", ".webp")

# (problem shown to admin, regex on the LLM body)
FORBIDDEN = [
    ("rasmiy doʻkon/diler daʼvosi", re.compile(r"(?i)rasmiy\s*(diler|do\S?kon|vakil|distribyutor)|official\s*(store|dealer|retailer)|официальн")),
    ("soxta kamyoblik", re.compile(r"(?i)\boxirgi(si|lari)\b|faqat\s*\d+\s*(ta|dona|juft)\s*qol|shoshiling|остал(ось|ась)|последн(ий|яя|ие)\s*(пар|штук)")),
    ("narx/valyuta", re.compile(r"(?i)\bso\S?m\b|\bсум\b|\$|\busd\b|\byuan\b|\bcny\b")),
    ("hashtag", re.compile(r"(?<!\w)#\w")),
    ("havola", re.compile(r"(?i)https?://|www\.|t\.me/")),
]


class ContentError(Exception):
    pass


@dataclass
class Draft:
    post: Post
    quotes: list[Quote]
    notes: list[str] = field(default_factory=list)  # for the admin: photos needed, stale rates...


def size_key(size: str):
    if size.upper() in APPAREL_ORDER:
        return (1, APPAREL_ORDER.index(size.upper()), size)
    try:
        return (0, float(size.split()[0]), size)
    except ValueError:
        return (2, 0, size)


def check_body(text: str, max_chars: int, allowlist=()) -> list[str]:
    problems = [f"replika soʻzi: {', '.join(t)}" for t in [blocklist.find_terms(text)] if t]
    problems += [name for name, rx in FORBIDDEN if rx.search(text)]
    problems += [f"shaxsiy maʼlumot: {', '.join(k)}" for k in [llm.find_pii(text, allowlist=allowlist)] if k]
    if len(text) > max_chars:
        problems.append(f"juda uzun: {len(text)} > {max_chars} belgi")
    if not text.strip():
        problems.append("boʻsh matn")
    return problems


def hashtags(product: Product, cat: dict, base: list[str]) -> list[str]:
    brand = "#" + re.sub(r"\W", "", product.brand.casefold())
    tags = list(dict.fromkeys([brand, cat["hashtag"], *base]))
    return tags[:8]


def build_caption(product: Product, cat: dict, body: str, price_uzs: int, price_from: bool,
                  sizes: list[str], delivery_days: str, s: dict) -> str:
    c = s["content"]
    title = f"{product.brand} {product.model_name}" + (f" — {product.colorway}" if product.colorway else "")
    price = format_uzs(price_uzs) + (" dan (eng arzon oʻlcham)" if price_from else "")
    lines = [
        uz(title),
        "",
        uz(body.strip()),
        "",
        f"💰 Narx: {price} · {s['pricing']['quote_valid_hours']} soat amal qiladi",
        f"📏 Oʻlchamlar: {', '.join(sizes)}",
        f"🚚 Yetkazish: {delivery_days} kun",
        "⚠️ Buyurtma qilingan tovar oʻlcham sababli qaytarilmaydi — oʻlchamingizni yozing, tanlashda yordam beramiz.",
        "✅ Original: Poizon orqali haqiqiyligi tekshirilgan.",
        f"👉 {uz(c['cta'])}",
        "",
        " ".join(hashtags(product, cat, c["hashtags"])),
    ]
    return "\n".join(lines)


def product_facts(product: Product, cat: dict) -> str:
    """The only data the LLM sees: source facts. No prices, no customer data."""
    return json.dumps({
        "brand": product.brand, "model": product.model_name, "colorway": product.colorway,
        "category": cat["label_uz"], "gender": product.gender,
        "source_description": product.description,
    }, ensure_ascii=False, indent=1)


def own_photos(product: Product, photos_dir: Path, limit: int) -> list[Path]:
    d = photos_dir / re.sub(r"[^\w.-]", "_", product.style_code)
    return sorted(p for p in d.glob("*") if p.suffix.lower() in PHOTO_EXT)[:limit] if d.is_dir() else []


def create_draft(session: Session, product: Product, llm_client, fx: dict[str, Rate], *,
                 now: datetime | None = None, out_root: Path | None = None) -> Draft:
    """Builds quotes for available sizes, the caption and the images; adds a draft Post.
    Flushes, does not commit. Raises ContentError if anything is not publishable."""
    s, cats = config.settings(), config.categories()
    c = s["content"]
    now = now or datetime.now(TZ)
    if not product.is_active:
        raise ContentError(f"{product.style_code}: mahsulot faol emas ({product.rejected_reason})")
    cat = cats[product.category]
    sizes = sorted((ps for ps in product.sizes if ps.available), key=lambda ps: size_key(ps.size_eu))
    if not sizes:
        raise ContentError(f"{product.style_code}: mavjud oʻlcham yoʻq")

    notes: list[str] = []
    quotes = []
    for ps in sizes:
        q = quote_from_source(ps.source_price, ps.source_currency, product.category, fx, now=now)
        notes += [w for w in q.warnings if w not in notes]
        quotes.append(Quote(product_id=product.id, size=ps.size_eu, landed_cost_usd=q.landed_cost_usd,
                            sell_price_uzs=q.sell_price_uzs, usd_rate=q.usd_rate,
                            valid_until=q.valid_until, breakdown=q.breakdown))
    prices = {q.sell_price_uzs for q in quotes}
    price, price_from = min(prices), len(prices) > 1
    delivery = c["delivery_days"][quotes[0].breakdown["shipping_mode"]]
    size_labels = [q.size for q in quotes]

    body = uz(llm_client.complete("content", PROMPT.read_text(encoding="utf-8"), product_facts(product, cat), now=now))
    problems = check_body(body, c["max_body_chars"], s["llm"]["pii_allowlist"])
    if problems:
        raise ContentError(f"{product.style_code}: LLM matni rad etildi: {'; '.join(problems)}")
    caption = build_caption(product, cat, body, price, price_from, size_labels, delivery, s)
    if len(caption) > c["caption_max_chars"]:
        raise ContentError(f"{product.style_code}: post matni {len(caption)} belgi > {c['caption_max_chars']}")

    session.add_all(quotes)
    post = Post(product_id=product.id, status="draft", caption_uz=caption)
    session.add(post)
    session.flush()

    # TODO(admin): image_source_policy=source_images (download Poizon images) is not built yet;
    # both policies use admin photos from photos_dir until the rights question is settled.
    photos = own_photos(product, config.ROOT / c["photos_dir"], c["cards_max"])
    if not photos:
        notes.append(f"Rasm kerak: {product.brand} {product.model_name} ({product.style_code}) — "
                     f"{c['photos_dir']}/{product.style_code}/ ga surat yuklang.")
    card = CardData(brand=product.brand, model=" ".join(filter(None, [product.model_name, product.colorway])),
                    price_uzs=price, price_from=price_from, sizes=size_labels, badge=c["badge"],
                    delivery=f"Yetkazish: {delivery} kun", cta=c["cta"])
    out = (out_root or config.DATA_DIR / "posts") / str(post.id)
    paths = [render_card(card, ph, out / f"card_{i + 1}.png") for i, ph in enumerate(photos or [None])]
    paths.append(render_story(card, photos[0] if photos else None, out / "story.png"))
    post.image_paths = [str(p) for p in paths]
    session.flush()
    return Draft(post=post, quotes=quotes, notes=notes)
