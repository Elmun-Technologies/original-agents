"""Products from POIZON app screenshots (+ images saved from the app). poizon.com gives an honestly identified bot no product
data (CLAUDE.md §6.2 "Texnik holat"), so the admin sends 1-3 screenshots from the app; Claude vision
reads them, the admin confirms (or corrects), and only then the product is saved through the same
validation + blocklist as the sheet import.

Card photos: saved images ("Save image") are preferred over screenshots; from each image only the
product photo area is cut out (no QR code / ad strip). Cropping only: the picture itself, including
any 得物 watermark, is used as is (CLAUDE.md §2)."""
import hashlib
import io
import json
import re
from datetime import datetime
from pathlib import Path

from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import config
from app.agents import sourcing
from app.agents.content import language_problems, photo_dir
from app.db.models import Product
from app.scraping import blocklist

PROMPT = config.ROOT / "prompts" / "screens.md"
SOURCE = "poizon_app"
MAX_SIDE = 1568            # long side sent to the model; larger only costs more tokens
MAX_IMAGES = 6             # per product message (screenshots + saved images)
ASK_SIZES = "Oʻlchamlar oʻqilmadi — oʻlcham tanlash oynasining skrinshotini yuboring."
LOW_QUALITY = "rasm sifati past ({w}×{h}) — ilovadan «Save image» qilib yuboring"
UNCLEAR_FALLBACK = "baʼzi maʼlumotlar aniq oʻqilmadi"
CURRENCY_SIGN = {"CNY": "¥", "USD": "$"}


class ScreenError(Exception):
    pass


def model_image(path: Path) -> tuple[bytes, str]:
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((MAX_SIDE, MAX_SIDE))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=90)
    return buf.getvalue(), "image/jpeg"


def parse_json(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    try:
        data = json.loads(text[start:end + 1])
    except ValueError:
        raise ScreenError("Skrinshotdan maʼlumot oʻqilmadi (javob JSON emas). Aniqroq skrinshot yuboring.")
    if not isinstance(data, dict):
        raise ScreenError("Skrinshotdan maʼlumot oʻqilmadi.")
    # notes are shown to the admin: Uzbek only; an English/Chinese slip becomes a generic note
    unclear = [str(u) for u in data.get("unclear") or []]
    data["unclear"] = list(dict.fromkeys(u if not language_problems(u, set()) else UNCLEAR_FALLBACK
                                         for u in unclear))
    return data


def read_screens(llm, paths: list[Path], now: datetime, previous: dict | None = None,
                 correction: str | None = None) -> dict:
    user = f"Category keys: {', '.join(config.categories())}."
    if previous is not None:
        user += (f"\n\nPrevious JSON:\n{json.dumps(previous, ensure_ascii=False)}"
                 f"\n\nAdmin correction (apply it): {correction}")
    text = llm.complete("screens", PROMPT.read_text(encoding="utf-8"), user, now=now,
                        images=[model_image(p) for p in paths])
    return parse_json(text)


def style_code(d: dict) -> str:
    """The SKU as shown, or a stable PZ-code from name + colour (same product -> same code)."""
    if (d.get("style_code") or "").strip():
        return d["style_code"].strip()
    key = "|".join(str(d.get(k) or "").casefold() for k in ("brand", "model_name", "colorway"))
    return "PZ-" + hashlib.sha1(key.encode()).hexdigest()[:8].upper()


def to_rows(d: dict, source_url: str | None = None) -> list[dict]:
    """Sheet-format rows (one per size) for sourcing.import_rows."""
    base = {"brand": d.get("brand") or "", "model_name": d.get("model_name") or "", "style_code": style_code(d),
            "category": d.get("category") or "", "gender": d.get("gender") or "", "colorway": d.get("colorway") or "",
            "currency": d.get("currency") or "CNY", "available": "ha", "source_url": source_url or "",
            "image_urls": "", "description": d.get("description") or "", "seller_note": "",
            "origin": "poizon_com",  # the app's own name/description: official text for the blocklist
            "sold_count": "" if d.get("sold_count") is None else str(d["sold_count"])}
    sizes = d.get("sizes") or [{"size": "", "price": ""}]
    return [base | {"size_eu": str(s.get("size") or ""), "price": str(s.get("price") or "")} for s in sizes]


def needs_sizes(d: dict) -> bool:
    return not [s for s in d.get("sizes") or [] if str(s.get("size") or "").strip()]


def problems(d: dict) -> list[str]:
    """Reasons it cannot be saved yet (same rules as the sheet + knock-off + min price)."""
    if needs_sizes(d):
        return [ASK_SIZES]
    cats = config.categories()
    out = []
    fake = blocklist.knockoff(d.get("brand"), " ".join(filter(None, [d.get("model_name"), d.get("colorway")])))
    if fake:
        return [fake]
    if (d.get("size_system") or "EU").upper() not in ("EU", "LETTERS", "") and \
            cats.get(d.get("category"), {}).get("size_type") == "shoe":
        out.append(f"oʻlchamlar {d['size_system']} tizimida — EU kerak (✏️ Tuzatish: masalan 'US 9 = EU 42.5')")
    for row in to_rows(d):
        r = sourcing.parse_row(row, cats)
        if isinstance(r, str) and r not in out:
            out.append(r)
    cat = cats.get(d.get("category"))
    prices = [s.get("price") for s in d.get("sizes") or []]
    if cat and not out and prices:
        try:
            low = min(float(x) for x in prices)
        except (TypeError, ValueError):
            low = None
        floor = sourcing.min_price(cat, d.get("brand"), d.get("currency") or "CNY")
        if low is not None and floor is not None and low < floor:
            sign = CURRENCY_SIGN.get(d.get("currency") or "CNY", "")
            out.append(f"{sourcing.TOO_CHEAP}: {sign}{low:g} < {sign}{floor} ({d.get('brand')}, {cat['label_uz']}) — "
                       "original boʻlmasligi mumkin. Chegara xato boʻlsa: ➕ Baribir qoʻshish")
    return out


def only_too_cheap(errs: list[str]) -> bool:
    """The admin may override a low-price rejection, never a knock-off or replica one."""
    return bool(errs) and all(e.startswith(sourcing.TOO_CHEAP) for e in errs)


def preview_text(d: dict, warnings: list[str] = ()) -> str:
    sign = CURRENCY_SIGN.get(d.get("currency") or "CNY", "")
    sizes = ", ".join(f"{s.get('size')}: {sign}{s.get('price')}" for s in d.get("sizes") or []) or "—"
    sku = d.get("style_code") or f"— (koʻrinmadi, {style_code(d)} beriladi)"
    lines = ["🔎 Skrinshotdan oʻqildi:",
             f"{d.get('brand') or '?'} {d.get('model_name') or '?'}" + (f" · {d['colorway']}" if d.get("colorway") else ""),
             f"SKU: {sku}",
             f"Kategoriya: {d.get('category') or '?'} · {d.get('gender') or 'unisex'}",
             f"Oʻlcham ({d.get('size_system') or '?'}) va narx: {sizes}",
             f"Sotilgan: {d['sold_count']}" if d.get("sold_count") is not None else "Sotilgan: —"]
    if d.get("unclear"):
        lines.append("Aniq emas: " + "; ".join(d["unclear"]))
    lines += [f"⚠️ {w}" for w in warnings]
    errs = problems(d)
    if errs == [ASK_SIZES]:
        lines += ["", "📏 " + ASK_SIZES]
    elif errs:
        lines += ["", "❌ Saqlab boʻlmaydi:"] + [f"  • {e}" for e in errs]
    else:
        lines += ["", "Toʻgʻrimi?"]
    return "\n".join(lines)


def card_sources(paths: list[Path], d: dict) -> list[tuple[Path, list | None]]:
    """(image, photo box) for the card: saved images first; screenshots only if there are none."""
    info = d.get("images") or []
    entries = [(p, (info[i] if i < len(info) and isinstance(info[i], dict) else {})) for i, p in enumerate(paths)]
    saved = [(p, e.get("photo_box")) for p, e in entries if e.get("kind") == "saved_image"]
    if saved:
        return saved
    shots = [(p, e.get("photo_box")) for p, e in entries if e.get("photo_box")]
    return shots[:1]


def crop_box(path: Path, box: list | None, dest: Path) -> Path | None:
    """Cuts the product photo area (box in 0..1000) out of the image; no box = whole image.
    Cropping only. None if the box is missing/tiny or the file is unreadable."""
    try:
        with Image.open(path) as im:
            w, h = im.size
            if box is None:
                rect = (0, 0, w, h)
            else:
                x0, y0, x1, y1 = (max(0.0, min(1000.0, float(v))) / 1000 for v in box)
                rect = (round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h))
            if rect[2] - rect[0] < 200 or rect[3] - rect[1] < 200:
                return None
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.convert("RGB").crop(rect).save(dest, "JPEG", quality=95)
            return dest
    except (TypeError, ValueError, OSError):
        return None


def card_photos(paths: list[Path], d: dict, folder: Path, prefix: str) -> tuple[list[Path], list[str]]:
    """Crops for the card into folder/<prefix>_NN.jpg + low-quality warnings."""
    out, warns = [], []
    for i, (src, box) in enumerate(card_sources(paths, d)):
        dest = crop_box(src, box, folder / f"{prefix}_{i:02d}.jpg")
        if dest is None:
            continue
        out.append(dest)
        with Image.open(dest) as im:
            if max(im.size) < config.settings()["images"]["min_side_px"]:
                warns.append(LOW_QUALITY.format(w=im.width, h=im.height))
    return out, list(dict.fromkeys(warns))


def save(session: Session, d: dict, paths: list[Path], source_url: str | None = None,
         force_cheap: bool = False) -> tuple[Product | None, str]:
    """Saves after the admin's ✅ (or ➕: force_cheap skips only the min_price check).
    Returns (product or None, message). Flushes, does not commit."""
    sku = style_code(d)
    rep = sourcing.import_rows(session, to_rows(d, source_url), SOURCE, first_row=1,
                               allow_cheap_skus=frozenset({sku}) if force_cheap else frozenset())
    product = session.scalar(select(Product).where(Product.style_code == sku))
    if product is None:
        return None, "❌ Saqlanmadi: " + "; ".join(r for _, r in rep.row_errors)
    if rep.rejected or rep.skipped:
        return product, f"⛔ {sku}: {product.rejected_reason}"
    folder = photo_dir(product)
    for old in folder.glob("app_*") if folder.is_dir() else []:  # a re-send replaces the old crops
        old.unlink()
    photos, warns = card_photos(paths, d, folder, f"app_{datetime.now():%Y%m%d%H%M%S}")
    prices = [s.source_price for s in product.sizes if s.available]
    sign = CURRENCY_SIGN.get(product.sizes[0].source_currency, "") if product.sizes else ""
    verb = "yangilandi" if sku in rep.updated else "qoʻshildi"
    return product, (f"✓ {verb}: {product.brand} {product.model_name} ({sku}), {sign}{min(prices):g} dan"
                     + (f", kartochka uchun {len(photos)} ta rasm" if photos else
                        "\nRasm qirqilmadi — SKU izohi bilan rasm yuboring.")
                     + "".join(f"\n⚠️ {w}" for w in warns)
                     + (f"\nXato oʻlchamlar: " + "; ".join(r for _, r in rep.row_errors) if rep.row_errors else ""))


def has_link(text: str) -> bool:
    return bool(re.search(r"https?://", text or ""))
