"""The Yeppo site catalog (Payload CMS REST API) — the single source of truth for products.

Auth: an admin user of the site (YEPPO_API_EMAIL / YEPPO_API_PASSWORD), JWT from /api/users/login.
Reads: products, store settings, search log (missed queries), paid orders (item SKUs only — no customer data).
Writes (only after the admin presses "Katalogga qo'shish"): brand, media, product with stock 0.
"""
import logging
import mimetypes
import re
import unicodedata
from datetime import datetime, timedelta, timezone

import httpx

from yeppo_agents.settings import dry_run, env

log = logging.getLogger(__name__)


class CatalogError(Exception):
    """The site refused a write; the message is short enough to show to the admin."""


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:80].strip("-")


def product_slug(brand: str, name: str) -> str:
    return slugify(f"{brand} {name}" if not name.lower().startswith(brand.lower()) else name)


class Catalog:
    def __init__(self, base: str | None = None, client: httpx.Client | None = None):
        self.base = (base or env("YEPPO_API_URL") or "http://localhost:3000").rstrip("/")  # "" (compose) = unset
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

    def _write(self, method: str, path: str, **kw) -> dict:
        """The only way to change the site. Refuses in DRY_RUN whatever the caller forgot to check."""
        if dry_run():
            raise CatalogError("DRY_RUN=true — saytga yozilmaydi")
        r = self.http.request(method, f"{self.base}/api/{path}", headers=self._h(), **kw)
        if r.status_code == 401:  # token expired
            self.token = None
            r = self.http.request(method, f"{self.base}/api/{path}", headers=self._h(), **kw)
        if r.status_code >= 400:
            log.error("%s %s -> %s %s", method, path, r.status_code, r.text[:300])
            try:
                errs = r.json().get("errors") or []
                detail = "; ".join(str(x.get("message", "")) for x in errs if isinstance(x, dict))
            except Exception:
                detail = ""
            raise CatalogError(f"sayt {path}: {r.status_code} {detail}"[:300])
        return r.json()["doc"]

    def post(self, path: str, json: dict, locale: str = "uz") -> dict:
        return self._write("POST", path, params={"locale": locale}, json=json)

    def patch(self, path: str, json: dict, locale: str = "uz") -> dict:
        return self._write("PATCH", path, params={"locale": locale}, json=json)

    def all(self, collection: str, **params) -> list[dict]:
        out, page = [], 1
        while True:
            d = self.get(collection, limit=100, page=page, **params)
            out += d["docs"]
            if not d.get("hasNextPage"):
                return out
            page += 1

    # --- reads -------------------------------------------------------------------
    def products(self, locale: str = "uz", fallback: bool = True) -> list[dict]:
        """fallback=False: localized fields missing in `locale` come back empty instead of in Uzbek."""
        extra = {} if fallback else {"fallback-locale": "none"}
        return self.all("products", depth=1, locale=locale, **extra)

    def product_by_slug(self, slug: str) -> dict | None:
        docs = self.get("products", depth=0, limit=1, **{"where[slug][equals]": slug})["docs"]
        return docs[0] if docs else None

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
        """SKU -> units sold in paid orders. Only item lines are read; customer fields are ignored.
        Same filter as the site's own best-sellers: refunded and cancelled orders are not demand."""
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        out: dict[str, int] = {}
        for o in self.all("orders", depth=0, **{"where[paidAt][greater_than]": since, "where[paymentStatus][equals]": "paid",
                                                "where[status][not_equals]": "cancelled"}):
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
        filename = filename.split("?", 1)[0] or "photo.jpg"
        mime = mimetypes.guess_type(filename)[0] or "image/jpeg"
        return self._write("POST", "media", files={"file": (filename, data, mime)},
                           data={"_payload": _json.dumps({"alt": alt})})["id"]

    def create_product(self, *, name: str, brand: str, category_id: int, type_uz: str | None, sku: str, volume: str | None,
                       price_uzs: int, image_ids: list[int]) -> dict:
        return self.post("products", {
            "name": name, "slug": product_slug(brand, name), "brand": self.brand_id(brand), "category": category_id,
            "type": type_uz, "images": image_ids,
            "variants": [{"sku": sku, "volume": volume, "price": price_uzs, "stock": 0}],
        })
