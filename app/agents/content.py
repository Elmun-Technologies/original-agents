"""Content agent (CLAUDE.md §6.4): quotes + caption + images -> a draft Post.

The LLM writes only the descriptive body (facts from the source). Everything that must be
honest and exact — price, sizes, delivery time, 24h validity, no-return-for-size, originality,
call to action, hashtags — is added by code, so the model cannot get it wrong.
"""
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import config, llm
from app.config import TZ
from app.db.models import Post, Product, Quote
from app.media.render import CardData, render_card, render_story
from app.pricing.calculator import quote_from_source, stock_quote
from app.pricing.rates import Rate
from app.scraping import blocklist
from app.uz import format_uzs, uz

PROMPT = config.ROOT / "prompts" / "content_uz.md"
log = logging.getLogger(__name__)
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


CJK = re.compile(r"[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]+")


def display_model(product: Product) -> str:
    """Model name for customers: no Chinese (Dewu titles mix it in), no repeated brand."""
    name = " ".join(CJK.sub(" ", product.model_name).split())
    if name.casefold().startswith(product.brand.casefold() + " "):
        name = name[len(product.brand):].strip()
    return name or product.model_name


# Uzbek Latin only: English function words are a reliable signal (brand/model names rarely
# contain them; words from the product's own name are excluded before counting).
ENGLISH = {"the", "and", "with", "from", "for", "this", "that", "these", "is", "are", "was", "were", "of",
           "to", "in", "on", "it", "its", "by", "as", "be", "or", "your", "you", "which", "here", "text",
           "corrected", "wait", "note", "sorry", "version", "translation", "made", "has", "have"}
META = re.compile(r"(?i)\b(wait|corrected|correction|here is|here's|translation|tuzatilgan matn)\b|\b(note|izoh)\s*:")


def language_problems(text: str, own_words: set[str]) -> list[str]:
    problems = []
    if re.search(r"[\u0400-\u04ff]", text):
        problems.append("kirill harflari (faqat oʻzbek lotin)")
    if CJK.search(text):
        problems.append("xitoycha belgilar")
    words = [w for w in re.findall(r"[a-z']+", text.casefold()) if w not in own_words]
    if sum(w in ENGLISH for w in words) >= 2:
        problems.append("inglizcha matn")
    if META.search(text):
        problems.append("izoh/tuzatish matni")
    if re.search(r"\n\s*\n", text.strip()):
        problems.append("bir nechta xatboshi/variant")
    return problems


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


def check_body(text: str, max_chars: int, allowlist=(), own_words: set[str] = frozenset()) -> list[str]:
    problems = [f"replika soʻzi: {', '.join(t)}" for t in [blocklist.find_terms(text)] if t]
    problems += language_problems(text, own_words)
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
                  sizes: list[str], delivery: str, s: dict) -> str:
    """delivery: e.g. "Yetkazish: 20–30 kun" or "Mavjud · 1 kunda yetkazamiz"."""
    c = s["content"]
    title = f"{product.brand} {display_model(product)}" + (f" — {product.colorway}" if product.colorway else "")
    price = format_uzs(price_uzs) + (" dan (eng arzon oʻlcham)" if price_from else "")
    lines = [
        uz(title),
        "",
        uz(body.strip()),
        "",
        f"💰 Narx: {price} · {s['pricing']['quote_valid_hours']} soat amal qiladi",
        f"📏 Oʻlchamlar: {', '.join(sizes)}",
        f"🚚 {delivery}",
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


def photo_dir(product: Product) -> Path:
    return config.ROOT / config.settings()["content"]["photos_dir"] / re.sub(r"[^\w.-]", "_", product.style_code)


def own_photos(product: Product, limit: int | None = None) -> list[Path]:
    """Photos for the cards: the admin's own (sent to the bot) first, then downloaded source images
    (src_*, image_source_policy=source_images)."""
    d = photo_dir(product)
    photos = sorted(p for p in d.glob("*") if p.suffix.lower() in PHOTO_EXT) if d.is_dir() else []
    return photos[:limit] if limit else photos


def priced_source(ps, now: datetime) -> tuple[Decimal, float]:
    """(price to quote from, buffer) for a source size. A price older than
    stale_price_buffer_after_days gets +stale_price_buffer_pct, so a price rise since the
    screenshot does not eat the profit. Used for posts and for orders alike."""
    p = config.settings()["publishing"]
    if now - ps.checked_at > timedelta(days=p["stale_price_buffer_after_days"]):
        pct = p["stale_price_buffer_pct"]
        return ps.source_price * (1 + Decimal(str(pct))), pct
    return ps.source_price, 0.0


def make_quotes(product: Product, fx: dict[str, Rate], now: datetime, stock: bool) -> tuple[list[Quote], list[str]]:
    """Fresh quotes (not yet added to the session). stock=True: only sizes in our stock."""
    notes: list[str] = []
    quotes: list[Quote] = []
    sizes = sorted(product.sizes, key=lambda ps: size_key(ps.size_eu))
    for ps in sizes:
        if stock:
            if ps.stock_qty <= 0:
                continue
            if not ps.stock_cost_uzs:
                notes.append(f"{product.style_code} {ps.size_eu}: tannarx yoʻq — /stockcost {product.style_code} <summa> {ps.size_eu}")
                continue
            q = stock_quote(ps.stock_cost_uzs, fx["USD"].value, now=now)
        else:
            if not ps.available:
                continue
            price, buffer = priced_source(ps, now)
            q = quote_from_source(price, ps.source_currency, product.category, fx, now=now)
            if buffer:
                q.breakdown.update(listed_price=float(ps.source_price), stale_price_buffer_pct=buffer)
            notes += [w for w in q.warnings if w not in notes]
        quotes.append(Quote(product_id=product.id, size=ps.size_eu, landed_cost_usd=q.landed_cost_usd,
                            sell_price_uzs=q.sell_price_uzs, usd_rate=q.usd_rate,
                            valid_until=q.valid_until, breakdown=q.breakdown, created_at=now))
    if not quotes:
        raise ContentError(f"{product.style_code}: {'omborda narxlanadigan' if stock else 'mavjud'} oʻlcham yoʻq"
                           + (f" ({'; '.join(notes)})" if notes else ""))
    return quotes, notes


def delivery_text(quotes: list[Quote], s: dict) -> str:
    if quotes[0].breakdown.get("stock"):
        return s["stock"]["delivery_text"]
    return f"Yetkazish: {s['content']['delivery_days'][quotes[0].breakdown['shipping_mode']]} kun"


def assemble(session: Session, post: Post, product: Product, quotes: list[Quote], body: str,
             out_root: Path | None = None) -> list[str]:
    """Caption + images for post from quotes and body; links the quotes to the post.
    Raises ContentError (nothing changed) if the caption is too long."""
    s, cat = config.settings(), config.categories()[product.category]
    c = s["content"]
    prices = {q.sell_price_uzs for q in quotes}
    price, price_from = min(prices), len(prices) > 1
    sizes = [q.size for q in quotes]
    delivery = delivery_text(quotes, s)
    caption = build_caption(product, cat, body, price, price_from, sizes, delivery, s)
    if len(caption) > c["caption_max_chars"]:
        raise ContentError(f"{product.style_code}: post matni {len(caption)} belgi > {c['caption_max_chars']}")
    if post.id is None:
        session.add(post)
        session.flush()
    for q in quotes:
        q.post_id = post.id
    session.add_all(quotes)
    post.caption_uz, post.body_uz = caption, body

    notes = []
    photos = own_photos(product, c["cards_max"])
    if not photos:
        notes.append(f"Rasm kerak: {product.brand} {display_model(product)} — SKU {product.style_code}. "
                     f"Botga surat (yaxshisi fayl sifatida) yuboring, izohga SKU yozing.")
    card = CardData(brand=product.brand, model=" ".join(filter(None, [display_model(product), product.colorway])),
                    price_uzs=price, price_from=price_from, sizes=sizes, badge=c["badge"],
                    delivery=delivery, cta=c["cta"])
    out = (out_root or config.DATA_DIR / "posts") / str(post.id)
    for old in out.glob("*.png") if out.is_dir() else []:
        old.unlink()
    paths = [render_card(card, ph, out / f"card_{i + 1}.png") for i, ph in enumerate(photos or [None])]
    paths.append(render_story(card, photos[0] if photos else None, out / "story.png"))
    post.image_paths = [str(p) for p in paths]
    session.flush()
    return notes


def own_words(product: Product) -> set[str]:
    text = " ".join(filter(None, [product.brand, product.model_name, product.colorway]))
    return set(re.findall(r"[a-z']+", text.casefold()))


def validate_body(body: str, s: dict, product: Product) -> str:
    body = uz(body.strip())
    problems = check_body(body, s["content"]["max_body_chars"], s["llm"]["pii_allowlist"], own_words(product))
    if problems:
        raise ContentError(f"{product.style_code}: matn rad etildi: {'; '.join(problems)}")
    return body


def write_body(llm_client, product: Product, cat: dict, s: dict, now: datetime) -> str:
    """LLM body; on a rejected answer asks again with the reasons (content.llm_retries times)."""
    facts = product_facts(product, cat)
    prompt = PROMPT.read_text(encoding="utf-8")
    error = None
    for _ in range(1 + s["content"]["llm_retries"]):
        user = facts if error is None else (
            f"{facts}\n\nYour previous answer was rejected: {error}. Write it again: one paragraph, "
            "Uzbek Latin only, no notes or corrections.")
        try:
            return validate_body(llm_client.complete("content", prompt, user, now=now), s, product)
        except ContentError as e:
            error = str(e).split("matn rad etildi: ", 1)[-1]
            log.info("content retry for %s: %s", product.style_code, error)
    raise ContentError(f"{product.style_code}: LLM matni rad etildi: {error}")


def create_draft(session: Session, product: Product, llm_client, fx: dict[str, Rate], *,
                 now: datetime | None = None, out_root: Path | None = None, stock: bool = False) -> Draft:
    """Quotes + LLM body + caption + images -> a draft Post. Flushes, does not commit.
    Raises ContentError (nothing written) if anything is not publishable."""
    s = config.settings()
    now = now or datetime.now(TZ)
    if not product.is_active and not stock:
        raise ContentError(f"{product.style_code}: mahsulot faol emas ({product.rejected_reason})")
    if product.rejected_reason and product.rejected_reason.startswith("replika"):
        raise ContentError(f"{product.style_code}: {product.rejected_reason}")
    cat = config.categories()[product.category]
    quotes, notes = make_quotes(product, fx, now, stock)
    body = write_body(llm_client, product, cat, s, now)
    post = Post(product_id=product.id, status="draft", is_stock=stock, created_at=now)
    notes += assemble(session, post, product, quotes, body, out_root)
    return Draft(post=post, quotes=quotes, notes=notes)


def post_quotes(session: Session, post: Post) -> list[Quote]:
    """Latest quote per size for this post."""
    latest: dict[str, Quote] = {}
    for q in session.scalars(select(Quote).where(Quote.post_id == post.id).order_by(Quote.id)):
        latest[q.size] = q
    return sorted(latest.values(), key=lambda q: size_key(q.size))


def refresh_post(session: Session, post: Post, fx: dict[str, Rate], *, now: datetime | None = None,
                 body: str | None = None, out_root: Path | None = None) -> tuple[list[Quote], list[Quote], list[str]]:
    """New quotes (current rates), caption and images; optionally a new body (admin edit).
    Returns (old_quotes, new_quotes, notes)."""
    now = now or datetime.now(TZ)
    product = session.get(Product, post.product_id)
    old = post_quotes(session, post)
    new, notes = make_quotes(product, fx, now, post.is_stock)
    body = validate_body(body, config.settings(), product) if body is not None else post.body_uz
    notes += assemble(session, post, product, new, body, out_root)
    return old, new, notes
