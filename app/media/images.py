"""image_source_policy=source_images: downloads products.images into the product's photo dir
(owner's decision, CLAUDE.md §6.4). The picture is never edited (CLAUDE.md §2): bytes are saved
as served; Pillow only checks they are an image (other formats are re-encoded losslessly to PNG).
Files are named src_NN_<hash> so the source order is kept and the admin's own photos sort first."""
import hashlib
import io
import logging
import os
import time
from pathlib import Path

import httpx
from PIL import Image

from app import config
from app.agents.content import own_photos, photo_dir
from app.db.models import Product

log = logging.getLogger(__name__)
KEEP_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}


def user_agent() -> str:
    contact = os.environ.get("SCRAPER_CONTACT_EMAIL")
    return "poizon-uz-catalog-bot/0.1" + (f" (+{contact})" if contact else "")


def download(client: httpx.Client, url: str, max_bytes: int) -> bytes:
    t0 = time.monotonic()
    with client.stream("GET", url) as r:
        log.info("GET %s -> %s in %.2fs", url, r.status_code, time.monotonic() - t0)
        if r.status_code != 200:
            raise ValueError(f"HTTP {r.status_code}")
        buf = bytearray()
        for chunk in r.iter_bytes():
            buf += chunk
            if len(buf) > max_bytes:
                raise ValueError(f"{max_bytes // 1_000_000} MB dan katta")
    return bytes(buf)


def save_image(data: bytes, stem: Path) -> Path:
    with Image.open(io.BytesIO(data)) as im:
        im.verify()
    with Image.open(io.BytesIO(data)) as im:
        ext = KEEP_FORMATS.get(im.format)
        if ext:
            path = stem.with_suffix(ext)
            path.write_bytes(data)
        else:  # e.g. AVIF: lossless re-encode so the renderer and Telegram can use it
            path = stem.with_suffix(".png")
            im.save(path, "PNG")
    return path


def fetch_source_images(product: Product, client: httpx.Client | None = None) -> list[str]:
    """Downloads missing source images (up to photos_max_per_sku). Returns problems (Uzbek)."""
    s = config.settings()
    if s["image_source_policy"] != "source_images" or not product.images:
        return []
    cfg, limit = s["images"], s["publishing"]["photos_max_per_sku"]
    have = own_photos(product)
    names = {p.stem for p in have}
    own = client is None
    c = client or httpx.Client(timeout=cfg["timeout_seconds"], follow_redirects=True,
                               headers={"User-Agent": user_agent()})
    problems, count, first = [], len(have), True
    try:
        for i, url in enumerate(product.images):
            stem = f"src_{i:02d}_{hashlib.sha1(url.encode()).hexdigest()[:10]}"
            if count >= limit:
                break
            if stem in names:
                continue
            if not first:
                time.sleep(cfg["pause_seconds"])
            first = False
            try:
                d = photo_dir(product)
                d.mkdir(parents=True, exist_ok=True)
                save_image(download(c, url, cfg["max_bytes"]), d / stem)
                count += 1
            except Exception as e:  # one bad image must not stop the rest
                log.warning("image failed %s %s: %s", product.style_code, url, e)
                problems.append(f"{product.style_code}: rasm yuklanmadi ({e})")
    finally:
        if own:
            c.close()
    return problems
