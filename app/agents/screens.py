"""Products from POIZON app screenshots. poizon.com gives an honestly identified bot no product
data (CLAUDE.md §6.2 "Texnik holat"), so the admin sends 1-3 screenshots from the app; Claude vision
reads them, the admin confirms (or corrects), and only then the product is saved through the same
validation + blocklist as the sheet import. The product photo is cropped from the screenshot
(cropping only, the product itself is not edited, CLAUDE.md §2)."""
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
from app.agents.content import photo_dir
from app.db.models import Product

PROMPT = config.ROOT / "prompts" / "screens.md"
SOURCE = "poizon_app"
MAX_SIDE = 1568            # long side sent to the model; larger only costs more tokens
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


def problems(d: dict) -> list[str]:
    """Validation errors before saving (same rules as the sheet)."""
    out = []
    if (d.get("size_system") or "EU").upper() not in ("EU", "LETTERS", "") and d.get("category") in (
            c for c, v in config.categories().items() if v["size_type"] == "shoe"):
        out.append(f"oʻlchamlar {d['size_system']} tizimida — EU kerak (✏️ Tuzatish: masalan 'US 9 = EU 42.5')")
    for row in to_rows(d):
        r = sourcing.parse_row(row, config.categories())
        if isinstance(r, str) and r not in out:
            out.append(r)
    return out


def preview_text(d: dict) -> str:
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
        lines.append("Aniq emas: " + "; ".join(map(str, d["unclear"])))
    errs = problems(d)
    if errs:
        lines += ["", "❌ Saqlab boʻlmaydi:"] + [f"  • {e}" for e in errs]
    lines.append("" if errs else "\nToʻgʻrimi?")
    return "\n".join(lines).rstrip()


def crop_photo(paths: list[Path], d: dict, dest: Path) -> Path | None:
    """Crops the product photo box from the screenshot; None if the box is missing or tiny."""
    ph = d.get("photo") or {}
    try:
        idx, box = int(ph.get("image", 0)), [float(v) for v in ph["box"]]
        with Image.open(paths[idx]) as im:
            w, h = im.size
            x0, y0, x1, y1 = (max(0.0, min(1000.0, v)) / 1000 for v in box)
            rect = (round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h))
            if rect[2] - rect[0] < 200 or rect[3] - rect[1] < 200:
                return None
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.convert("RGB").crop(rect).save(dest, "JPEG", quality=95)
            return dest
    except (KeyError, IndexError, TypeError, ValueError, OSError):
        return None


def save(session: Session, d: dict, paths: list[Path], source_url: str | None = None) -> tuple[Product | None, str]:
    """Saves after the admin's ✅. Returns (product or None, message). Flushes, does not commit."""
    rep = sourcing.import_rows(session, to_rows(d, source_url), SOURCE, first_row=1)
    sku = style_code(d)
    product = session.scalar(select(Product).where(Product.style_code == sku))
    if product is None:
        return None, "❌ Saqlanmadi: " + "; ".join(r for _, r in rep.row_errors)
    folder = photo_dir(product)
    for old in folder.glob("app_*") if folder.is_dir() else []:  # a re-send replaces the old crop
        old.unlink()
    cropped = crop_photo(paths, d, folder / f"app_{datetime.now():%Y%m%d%H%M%S}.jpg")
    if rep.rejected or rep.skipped:
        return product, f"⛔ {sku}: {product.rejected_reason}"
    prices = [s.source_price for s in product.sizes if s.available]
    sign = CURRENCY_SIGN.get(product.sizes[0].source_currency, "") if product.sizes else ""
    verb = "yangilandi" if sku in rep.updated else "qoʻshildi"
    return product, (f"✓ {verb}: {product.brand} {product.model_name} ({sku}), {sign}{min(prices):g} dan"
                     + ("" if cropped else "\nRasm qirqilmadi — SKU izohi bilan rasm yuboring.")
                     + (f"\nXato oʻlchamlar: " + "; ".join(r for _, r in rep.row_errors) if rep.row_errors else ""))


def has_link(text: str) -> bool:
    return bool(re.search(r"https?://", text or ""))
