"""The Yeppo site catalog (Payload CMS REST API) — the single source of truth for products.

Auth: an admin user of the site (YEPPO_API_EMAIL / YEPPO_API_PASSWORD), JWT from /api/users/login.
Reads: products, store settings, search log (missed queries), paid orders (item SKUs only — no customer data).
Writes (only after the admin presses "Katalogga qo'shish"): brand, media, product with stock 0.
"""
import logging
import re
import unicodedata
from datetime import datetime, timedelta, timezone

import httpx

from yeppo_agents.settings import env

log = logging.getLogger(__name__)


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:80]


class Catalog:
    def __init__(self, base: str | None = None, client: httpx.Client | None = None):
        self.base = (base or env("YEPPO_API_URL", "http://localhost:3000")).rstrip("/")
        self.http = client or httpx.Client(timeout=60)
        self.token: str | None = None

    # --- plumbing -----------------------------------------------------------
    def login(self) -> None:
        r = self.http.post(f"{self.base}/api/users/login", json={
            "email": env("YEPPO_API_EMAIL", required=True), "password": env("YEPPO_API_PASSWORD", required=True)})
        r.raise_for_status()
        self.token = r.json()["token"]

    def _h(self) -> dict:
        if not self.token:
            self.login()
        return {"Authorization": f"JWT {self.token}"}

    def get(self, path: str, **params) -> dict:
        r = self.http.get(f"{self.base}/api/{path}", params=params, headers=self._h())
        if r.status_code == 401:
            self.token = None
            r = self.http.get(f"{self.base}/api/{path}", params=params, headers=self._h())
        r.raise_for_status()
        return r.json()

    def post(self, path: str, json: dict, locale: str = "uz") -> dict:
        r = self.http.post(f"{self.base}/api/{path}", params={"locale": locale}, json=json, headers=self._h())
        if r.status_code >= 400:
            log.error("POST %s -> %s %s", path, r.status_code, r.text[:300])
        r.raise_for_status()
        return r.json()["doc"]

    def patch(self, path: str, json: dict, locale: str = "uz") -> dict:
        r = self.http.patch(f"{self.base}/api/{path}", params={"locale": locale}, json=json, headers=self._h())
        r.raise_for_status()
        return r.json()["doc"]

    def all(self, collection: str, **params) -> list[dict]:
        out, page = [], 1
        while True:
            d = self.get(collection, limit=100, page=page, **params)
            out += d["docs"]
            if not d.get("hasNextPage"):
                return out
            page += 1

    # --- reads -------------------------------------------------------------------
    def products(self, locale: str = "uz") -> list[dict]:
        return self.all("products", depth=1, locale=locale)

    def store(self) -> dict:
        return self.get("globals/store", depth=0)

    def categories(self) -> dict[str, int]:
        return {c["slug"]: c["id"] for c in self.all("categories", depth=0)}

    def missed_searches(self, days: int) -> list[tuple[str, int]]:
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        docs = self.all("search-log", depth=0, sort="-count", **{"where[updatedAt][greater_than]": since})
        return [(d["query"], d.get("count") or 1) for d in docs if d.get("missed")]

    def all_searches(self, days: int) -> list[tuple[str, int]]:
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        return [(d["query"], d.get("count") or 1) for d in self.all("search-log", depth=0, sort="-count", **{"where[updatedAt][greater_than]": since})]

    def sold_skus(self, days: int) -> dict[str, int]:
        """SKU -> units sold in paid orders. Only item lines are read; customer fields are ignored."""
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        out: dict[str, int] = {}
        for o in self.all("orders", depth=0, **{"where[paidAt][greater_than]": since}):
            for it in o.get("items") or []:
                out[it.get("sku", "")] = out.get(it.get("sku", ""), 0) + int(it.get("qty") or 1)
        return out

    # --- writes (admin-approved only) ---------------------------------------------
    def brand_id(self, name: str) -> int:
        slug = slugify(name)
        d = self.get("brands", depth=0, **{"where[slug][equals]": slug})
        if d["docs"]:
            return d["docs"][0]["id"]
        return self.post("brands", {"name": name, "slug": slug})["id"]

    def upload_image(self, data: bytes, filename: str, alt: str) -> int:
        import json as _json
        r = self.http.post(f"{self.base}/api/media", headers=self._h(),
                           files={"file": (filename, data, "image/jpeg")}, data={"_payload": _json.dumps({"alt": alt})})
        r.raise_for_status()
        return r.json()["doc"]["id"]

    def create_product(self, *, name: str, brand: str, category_id: int, type_uz: str | None, sku: str, volume: str | None,
                       price_uzs: int, image_ids: list[int]) -> dict:
        slug = slugify(f"{brand} {name}" if not name.lower().startswith(brand.lower()) else name)
        return self.post("products", {
            "name": name, "slug": slug, "brand": self.brand_id(brand), "category": category_id,
            "type": type_uz, "images": image_ids,
            "variants": [{"sku": sku, "volume": volume, "price": price_uzs, "stock": 0}],
        })
