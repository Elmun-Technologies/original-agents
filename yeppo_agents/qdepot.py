"""Q-Depot (q-depot.com, Korean cosmetics wholesale/retail) parsers. Pure functions — no network here.

Listing pages: <div class="product-thumb"> blocks (url, brand, name, retail USD price).
Product pages: schema.org Product JSON-LD (name, brand, model code, price, availability, 1000px image).
Wholesale prices are behind a login — the agent never logs in; the admin can send the wholesale price list.
"""
import html
import json
import re
from dataclasses import dataclass, field
from decimal import Decimal

THUMB = re.compile(r'<div class="product-thumb">(.*?)(?=<div class="product-thumb">|<div class="product-layout|</section>|$)', re.S)
LDJSON = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
PRICE = re.compile(r'\$\s*([\d,]+(?:\.\d+)?)')
VOLUME = re.compile(r'(?i)(\d+(?:[.,]\d+)?)\s*(ml|g|gr|ea|pcs|sheets?)\b(?:\s*[x*×]\s*(\d+))?')


@dataclass
class Listed:
    url: str
    name: str
    brand: str
    price_usd: Decimal
    old_usd: Decimal | None = None
    img: str | None = None
    product_id: str | None = None


@dataclass
class Detail:
    url: str
    name: str
    brand: str
    model: str
    price_usd: Decimal
    in_stock: bool
    images: list[str] = field(default_factory=list)


def _text(s: str) -> str:
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def _usd(s: str) -> Decimal | None:
    m = PRICE.search(s)
    return Decimal(m.group(1).replace(",", "")) if m else None


def parse_listing(page: str) -> list[Listed]:
    out: list[Listed] = []
    for m in THUMB.finditer(page):
        b = m.group(1)
        name = re.search(r'<div class="name"><a href="([^"]+)"[^>]*>(.*?)</a>', b, re.S)
        if not name:
            continue
        brand = re.search(r'<span class="stats-label">Brand:</span>\s*<span><a [^>]*>(.*?)</a>', b, re.S)
        new = re.search(r'class="price-new">([^<]+)', b)
        old = re.search(r'class="price-old">([^<]+)', b)
        normal = re.search(r'class="price-normal">([^<]+)', b)
        price = _usd(new.group(1)) if new else _usd(normal.group(1)) if normal else None
        if price is None:
            continue
        img = re.search(r'data-srcset="[^"]*?(https://[^" ]+-500x500\.\w+)', b) or re.search(r'data-src="([^"]+)"', b)
        pid = re.search(r'name="product_id" value="(\d+)"', b)
        out.append(Listed(
            url=name.group(1), name=_text(name.group(2)), brand=_text(brand.group(1)) if brand else "",
            price_usd=price, old_usd=_usd(old.group(1)) if old else None,
            img=img.group(1) if img else None, product_id=pid.group(1) if pid else None,
        ))
    return out


def page_count(page: str) -> int:
    m = re.search(r"Showing \d+ to \d+ of \d+ \((\d+) Pages\)", page)
    return int(m.group(1)) if m else 1


def parse_product(page: str, url: str) -> Detail | None:
    best = None
    for m in LDJSON.finditer(page):
        try:
            d = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
        if isinstance(d, dict) and d.get("@type") == "Product" and d.get("offers"):
            # the page has two Product blocks; the later one carries the 1000px image
            best = d
    if not best:
        return None
    offer = best["offers"]
    brand = best.get("brand") or {}
    img = best.get("image")
    stock_li = re.search(r'class="product-stock ([a-z-]+)"', page)
    in_stock = "InStock" in str(offer.get("availability", "")) and (not stock_li or stock_li.group(1) == "in-stock")
    return Detail(
        url=url, name=html.unescape(best.get("name", "")).strip(), brand=html.unescape(brand.get("name", "")).strip(),
        model=(best.get("model") or "").strip(), price_usd=Decimal(str(offer.get("price") or "0")),
        in_stock=in_stock, images=[img] if isinstance(img, str) else list(img or []),
    )


def volume(name: str) -> str | None:
    """'... Cream 50ml' -> '50 ml', 'Mask 25ml*10' -> '25 ml × 10'."""
    m = None
    for m in VOLUME.finditer(name):
        pass
    if not m:
        return None
    unit = {"gr": "g", "pcs": "dona", "ea": "dona", "sheet": "dona", "sheets": "dona"}.get(m.group(2).lower(), m.group(2).lower())
    v = f"{m.group(1).replace(',', '.')} {unit}"
    return f"{v} × {m.group(3)}" if m.group(3) else v
