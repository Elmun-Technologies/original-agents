"""Post images (CLAUDE.md §6.4): card 1080×1350 and story 1080×1920.

Product photos are only resized to fit (no AI edits, no recolor). Without a photo, a gray
"RASM KERAK" placeholder is drawn so the template can be reviewed.

Samples:  uv run python -m app.media.render   -> data/samples/renders/
"""
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from app.uz import OKINA, format_uzs, uz

FONTS = Path(__file__).parent / "templates" / "fonts"
CARD = (1080, 1350)
STORY = (1080, 1920)
M = 60  # outer margin

BG = (245, 245, 243)
PANEL = (255, 255, 255)
INK = (17, 17, 17)
MUTED = (107, 107, 107)
PLACEHOLDER = (217, 217, 217)
PLACEHOLDER_INK = (128, 128, 128)
WHITE = (255, 255, 255)

PLACEHOLDER_TEXT = "RASM KERAK"
PLACEHOLDER_SUB = "Admin surati yuklanishi kerak"


@dataclass
class CardData:
    brand: str
    model: str
    price_uzs: int
    sizes: list[str]
    badge: str
    delivery: str               # e.g. "Yetkazish: 20–30 kun"
    price_from: bool = False    # sizes have different prices -> show the lowest
    cta: str = ""               # story only
    extra: dict = field(default_factory=dict)


@lru_cache
def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"Inter-{weight}.ttf"), size)


def text_w(draw: ImageDraw.ImageDraw, text: str, f) -> int:
    l, _, r, _ = draw.textbbox((0, 0), text, font=f)
    return r - l


def fit_font(draw, text: str, weight: str, size: int, max_w: int, min_size: int):
    while size > min_size and text_w(draw, text, font(weight, size)) > max_w:
        size -= 2
    return font(weight, size)


def wrap(draw, text: str, f, max_w: int, max_lines: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        cand = f"{cur} {w}".strip()
        if text_w(draw, cand, f) <= max_w:
            cur = cand
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while lines[-1] and text_w(draw, lines[-1] + "…", f) > max_w:
            lines[-1] = lines[-1][:-1].rstrip()
        lines[-1] += "…"
    return lines


def draw_photo(canvas: Image.Image, box: tuple[int, int, int, int], photo: Path | None) -> None:
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(canvas)
    if photo is None:
        d.rounded_rectangle(box, radius=36, fill=PLACEHOLDER)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        d.text((cx, cy - 20), PLACEHOLDER_TEXT, font=font("ExtraBold", 84), fill=PLACEHOLDER_INK, anchor="mm")
        d.text((cx, cy + 50), PLACEHOLDER_SUB, font=font("Medium", 30), fill=PLACEHOLDER_INK, anchor="mm")
        return
    d.rounded_rectangle(box, radius=36, fill=PANEL)
    pad = 40
    with Image.open(photo) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im = ImageOps.contain(im, (x1 - x0 - 2 * pad, y1 - y0 - 2 * pad))  # resize only
    canvas.paste(im, (x0 + (x1 - x0 - im.width) // 2, y0 + (y1 - y0 - im.height) // 2))


def draw_badge(d: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, size: int = 28) -> None:
    f = font("SemiBold", size)
    w = text_w(d, text, f)
    x, y = xy
    d.rounded_rectangle((x, y, x + w + 40, y + size + 28), radius=(size + 28) // 2, fill=INK)
    d.text((x + 20, y + 14 + size // 2), text, font=f, fill=WHITE, anchor="lm")


def _text_block(d, data: CardData, x: int, y: int, max_w: int, s: dict) -> int:
    """Brand, model, price label, price, sizes, delivery. Returns y after the block."""
    d.text((x, y), uz(data.brand).upper(), font=font("SemiBold", s["brand"]), fill=MUTED)
    y += int(s["brand"] * 1.5)
    f = font("Bold", s["model"])
    for line in wrap(d, uz(data.model), f, max_w, 2):
        d.text((x, y), line, font=f, fill=INK)
        y += int(s["model"] * 1.2)
    y += s["gap"]
    label = "Narx — eng arzon oʻlcham" if data.price_from else "Narx"
    d.text((x, y), label, font=font("Medium", s["label"]), fill=MUTED)
    y += int(s["label"] * 1.35)
    price = format_uzs(data.price_uzs)
    pf = fit_font(d, price, "ExtraBold", s["price"], max_w, s["price_min"])
    d.text((x, y), price, font=pf, fill=INK)
    y += int(pf.size * 1.22)
    sf = font("Medium", s["sizes"])
    sizes = wrap(d, "Oʻlchamlar: " + " · ".join(data.sizes), sf, max_w, 1)[0]
    d.text((x, y), sizes, font=sf, fill=INK)
    y += int(s["sizes"] * 1.5)
    d.text((x, y), uz(data.delivery), font=font("Medium", s["delivery"]), fill=MUTED)
    return y + int(s["delivery"] * 1.4)


def render_card(data: CardData, photo: Path | None, out: Path) -> Path:
    im = Image.new("RGB", CARD, BG)
    d = ImageDraw.Draw(im)
    draw_photo(im, (M, M, CARD[0] - M, 820), photo)
    draw_badge(d, (M + 30, M + 30), data.badge)
    _text_block(d, data, M, 850, CARD[0] - 2 * M,
                dict(brand=30, model=50, gap=8, label=28, price=108, price_min=70, sizes=32, delivery=28))
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "PNG", optimize=True)
    return out


def render_story(data: CardData, photo: Path | None, out: Path) -> Path:
    im = Image.new("RGB", STORY, BG)
    d = ImageDraw.Draw(im)
    draw_photo(im, (M, 140, STORY[0] - M, 1140), photo)
    draw_badge(d, (M + 30, 170), data.badge, size=32)
    _text_block(d, data, M, 1190, STORY[0] - 2 * M,
                dict(brand=36, model=62, gap=12, label=32, price=128, price_min=84, sizes=36, delivery=32))
    if data.cta:
        y0 = STORY[1] - 190
        d.rounded_rectangle((M, y0, STORY[0] - M, y0 + 110), radius=55, fill=INK)
        f = fit_font(d, uz(data.cta), "SemiBold", 34, STORY[0] - 2 * M - 60, 24)
        d.text((STORY[0] // 2, y0 + 55), uz(data.cta), font=f, fill=WHITE, anchor="mm")
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "PNG", optimize=True)
    return out


UI_TEXT = PLACEHOLDER_TEXT + PLACEHOLDER_SUB + "Narx — eng arzon oʻlcham Oʻlchamlar: · …" + OKINA + "soʻm"


def render_samples(out_dir: Path) -> list[Path]:
    """Sample renders from data/samples/manual_sheet_sample.csv prices (live CBU rates)."""
    from datetime import datetime

    from app import config
    from app.pricing import rates
    from app.pricing.calculator import quote_from_source

    c = config.settings()["content"]
    now = datetime.now(config.TZ)
    fx = {"USD": rates.rate("USD", now), "CNY": rates.rate("CNY", now)}
    q = lambda price, cat: quote_from_source(price, "CNY", cat, fx, now=now)
    nb = [q(489, "sneakers"), q(509, "sneakers")]
    tnf = q(1599, "puffer")
    days = lambda quote: f"Yetkazish: {c['delivery_days'][quote.breakdown['shipping_mode']]} kun"
    sneaker = CardData(brand="New Balance", model="530 White Silver Navy",
                       price_uzs=min(x.sell_price_uzs for x in nb), price_from=True,
                       sizes=["41", "42.5"], badge=c["badge"], delivery=days(nb[0]), cta=c["cta"])
    puffer = CardData(brand="The North Face", model="1996 Retro Nuptse Jacket Black",
                      price_uzs=tnf.sell_price_uzs, sizes=["M"], badge=c["badge"], delivery=days(tnf))
    return [render_card(sneaker, None, out_dir / "1_sneakers_card.png"),
            render_card(puffer, None, out_dir / "2_puffer_card.png"),
            render_story(sneaker, None, out_dir / "3_sneakers_story.png")]


if __name__ == "__main__":
    from app import config
    for p in render_samples(config.ROOT / "data/samples/renders"):
        print(p)
