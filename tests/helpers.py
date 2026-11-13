from datetime import datetime
from decimal import Decimal

from PIL import Image

from app.config import TZ
from app.db.models import Product, ProductSize
from app.pricing.rates import Rate

NOW = datetime(2026, 11, 14, 10, tzinfo=TZ)
FX = {"USD": Rate(Decimal("12000"), NOW), "CNY": Rate(Decimal("1800"), NOW)}
BODY = "New Balance 530 — retro yugurish uslubidagi model. Taglikdagi ABZORB yumshoq amortizatsiya beradi."


class FakeLlm:
    def __init__(self, text=BODY):
        self.text, self.calls = text, []

    def complete(self, purpose, system, user, **kw):
        self.calls.append((purpose, user))
        return self.text(user) if callable(self.text) else self.text


def make_product(db, sku="MR530SG", brand="New Balance", model="530", sizes=(("41", 489), ("42.5", 509)),
                 category="sneakers", currency="CNY", **kw) -> Product:
    p = Product(**{"source": "manual_sheet", "origin": "dewu", "brand": brand, "model_name": model,
                   "style_code": sku, "category": category, "gender": "unisex",
                   "description": "Retro running silhouette"} | kw,
                sizes=[ProductSize(size_eu=sz, source_price=pr, source_currency=currency) for sz, pr in sizes])
    db.add(p)
    db.flush()
    return p


def add_photos(photos_root, sku, n=2):
    d = photos_root / sku
    d.mkdir(parents=True, exist_ok=True)
    for i in range(n):
        Image.new("RGB", (600, 600), (40 * i, 80, 120)).save(d / f"{i}.jpg")
