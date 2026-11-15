"""Content agent: choose today's products from the site catalog and build a ready-to-post package
(cards, story, Reels, uz/ru caption, hashtags, tracked link).

The LLM writes only the descriptive body from catalog facts; price, delivery, returns, originality,
call to action and hashtags are added by code so they are always exact (CLAUDE.md "Halol shartlar")."""
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode

import httpx

from yeppo_agents import llm, media, store
from yeppo_agents.demand import Demand
from yeppo_agents.settings import DATA, ROOT, TZ, cfg, site_url

log = logging.getLogger(__name__)
PROMPT = ROOT / "prompts" / "yeppo_caption.md"
SKIN = {"dry": ("quruq", "сухой"), "oily": ("yogʻli", "жирной"), "combo": ("aralash", "комбинированной"),
        "sens": ("sezgir", "чувствительной"), "normal": ("normal", "нормальной")}
CONCERN = {"acne": ("Toshma va qizarish", "Высыпания и покраснения"), "pores": ("Kengaygan poralar", "Расширенные поры"),
           "pigment": ("Pigment dogʻlar", "Пигментные пятна"), "dryness": ("Quruqlik, tortishish", "Сухость, стянутость"),
           "wrinkles": ("Birinchi ajinlar", "Первые морщины"), "dull": ("Xira rang", "Тусклый цвет")}
EXTRA = [re.compile(r"(?i)\bso\S?m\b|\bсум\b|\$|https?://|www\.|t\.me/|(?<!\w)#\w|\+?998\d")]


def fmt_uzs(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def stock(p: dict) -> int:
    return sum(int(v.get("stock") or 0) for v in p.get("variants") or [])


def cat_slug(p: dict) -> str:
    c = p.get("category")
    return c.get("slug", "") if isinstance(c, dict) else ""


def brand_name(p: dict) -> str:
    b = p.get("brand")
    return b.get("name", "") if isinstance(b, dict) else ""


def min_price(p: dict) -> int:
    return min(int(v["price"]) for v in p["variants"] if (v.get("stock") or 0) > 0)


def eligible(p: dict) -> bool:
    return cat_slug(p) not in ("", "sertifikatlar") and stock(p) > 0 and bool(p.get("images"))


def pick(products: list[dict], demand: Demand, n: int, now: datetime | None = None) -> list[dict]:
    """In stock, has photos, not posted in `repost_after_days`; demand score first, never-posted next."""
    c = cfg()["content"]
    now = now or datetime.now(TZ)
    last = store.last_posted()
    fresh = timedelta(days=c["repost_after_days"])
    ranked = []
    for p in products:
        if not eligible(p):
            continue
        at = last.get(p["slug"])
        if at and now - at < fresh:
            continue
        s, _ = demand.score(f"{brand_name(p)} {p['name']}", cat_slug(p))
        ranked.append((s + (3 if at is None else 0), p))
    ranked.sort(key=lambda x: -x[0])
    out, per_brand = [], {}
    for _, p in ranked:
        b = brand_name(p)
        if per_brand.get(b, 0) >= c["per_brand_daily_max"]:
            continue
        per_brand[b] = per_brand.get(b, 0) + 1
        out.append(p)
        if len(out) >= n:
            break
    return out


def facts(p: dict, ru: dict | None) -> dict:
    v = next((x for x in p["variants"] if (x.get("stock") or 0) > 0), p["variants"][0])
    return {
        "brand": brand_name(p), "name": p["name"], "volume": v.get("volume"),
        "type": {"uz": p.get("type"), "ru": (ru or {}).get("type")},
        "need": {"uz": p.get("need"), "ru": (ru or {}).get("need")},
        "summary": {"uz": p.get("summary"), "ru": (ru or {}).get("summary")},
        "skin_types": [SKIN[s][0] for s in p.get("skin") or [] if s in SKIN],
        "concerns": [CONCERN[c][0] for c in p.get("concerns") or [] if c in CONCERN],
    }


def problems(text: str) -> list[str]:
    pats = [re.compile(x) for x in cfg()["forbidden_claims"]] + EXTRA
    return [p.pattern[:40] for p in pats if p.search(text)]


def fallback_body(f: dict) -> dict:
    """No LLM: the catalog's own words."""
    def one(lang):
        parts = [f["need"][lang], f["summary"][lang]]
        return " ".join(x.strip() for x in parts if x) or f"{f['brand']} {f['name']}."
    return {"uz": one("uz"), "ru": one("ru")}


def write_body(f: dict) -> tuple[dict, str]:
    """-> ({uz, ru}, source) where source is 'llm' or 'catalog'."""
    system = PROMPT.read_text(encoding="utf-8")
    for attempt in range(2):
        try:
            raw = llm.complete("caption", system, json.dumps(f, ensure_ascii=False))
            m = re.search(r"\{.*\}", raw, re.S)
            body = json.loads(m.group(0)) if m else {}
            uz, ru = (body.get("uz") or "").strip(), (body.get("ru") or "").strip()
            bad = problems(uz + "\n" + ru)
            limit = cfg()["content"]["max_body_chars"]
            if uz and ru and not bad and len(uz) <= limit and len(ru) <= limit:
                return {"uz": uz, "ru": ru}, "llm"
            log.warning("caption rejected (attempt %s): %s", attempt + 1, bad or "empty/too long")
        except (llm.LlmError, json.JSONDecodeError) as e:
            log.warning("caption LLM failed: %s", e)
            break
    return fallback_body(f), "catalog"


def link(slug: str, lang: str = "uz") -> str:
    u = cfg()["content"]["utm"]
    q = urlencode({"utm_source": u["source"], "utm_medium": u["medium"], "utm_campaign": u["campaign"], "utm_content": slug})
    return f"{site_url()}/{lang}/mahsulot/{slug}?{q}"


def hashtags(p: dict) -> str:
    c = cfg()["content"]
    tags = list(c["hashtags_base"])
    b = re.sub(r"[^a-z0-9]", "", brand_name(p).lower())
    if b:
        tags.append(f"#{b}")
    if cat_slug(p) in c["category_hashtag"]:
        tags.append(c["category_hashtag"][cat_slug(p)])
    return " ".join(dict.fromkeys(tags))


def caption(p: dict, body: dict, st: dict) -> str:
    c = cfg()["content"]
    price = fmt_uzs(min_price(p))
    td, rd, ret = st.get("tashkentDays"), st.get("regionDays"), st.get("returnDays")
    uz = [body["uz"], "", f"{brand_name(p)} — {p['name']}", f"Narxi: {price} soʻm", c["originality"]["uz"]]
    ru = [body["ru"], "", f"Цена: {price} сум", c["originality"]["ru"]]
    if td and rd:
        uz.append(f"Yetkazish: Toshkent boʻylab {td} kunda, viloyatlarga {rd} kunda.")
        ru.append(f"Доставка: по Ташкенту {td} дн., в регионы {rd} дн.")
    if ret:
        uz.append(f"Ochilmagan mahsulotni {ret} kun ichida qaytarish mumkin.")
        ru.append(f"Невскрытый товар можно вернуть в течение {ret} дней.")
    uz.append(c["cta"]["uz"])
    ru.append(c["cta"]["ru"])
    return "\n".join(uz) + "\n\n— — —\n" + "\n".join(ru) + "\n\n" + hashtags(p)


@dataclass
class Package:
    slug: str
    title: str
    caption: str
    link: str
    files: list[Path] = field(default_factory=list)  # cards..., story, reel
    body_source: str = "llm"
    sample: bool = False


def download(base: str, p: dict, limit: int = 3, client: httpx.Client | None = None) -> list[bytes]:
    http = client or httpx.Client(timeout=60, follow_redirects=True)
    out = []
    for img in (p.get("images") or [])[:limit]:
        url = img.get("url") if isinstance(img, dict) else None
        if not url:
            continue
        r = http.get(url if url.startswith("http") else base + url)
        if r.status_code == 200:
            out.append(r.content)
    return out


def build(p: dict, ru: dict | None, st: dict, base: str, out_root: Path | None = None) -> Package:
    f = facts(p, ru)
    body, source = write_body(f)
    photos = download(base, p)
    if not photos:
        raise RuntimeError(f"{p['slug']}: rasm yuklab bo'lmadi")
    td = st.get("tashkentDays")
    item = media.Item(
        brand=f["brand"], name=p["name"], price=f"{fmt_uzs(min_price(p))} soʻm", photos=photos,
        type=f["type"]["uz"] or "", volume=f["volume"] or "", need=f["need"]["uz"] or "",
        points=[*f["concerns"][:2], *([f"Teri turi: {', '.join(f['skin_types'])}"] if f["skin_types"] else [])],
        site=site_url().split("//")[-1], delivery=f"Toshkent boʻylab {td} kunda" if td else "",
    )
    out = (out_root or DATA / "posts") / datetime.now(TZ).strftime("%Y-%m-%d") / p["slug"]
    out.mkdir(parents=True, exist_ok=True)
    files = []
    media.card_main(item).save(out / "1-card.jpg", quality=92)
    files.append(out / "1-card.jpg")
    facts_card = media.card_facts(item)
    if facts_card:
        facts_card.save(out / "2-facts.jpg", quality=92)
        files.append(out / "2-facts.jpg")
    for i, ph in enumerate(photos[1:], start=3):
        media.card_photo(item, ph).save(out / f"{i}-photo.jpg", quality=92)
        files.append(out / f"{i}-photo.jpg")
    media.story(item).save(out / "story.jpg", quality=92)
    files.append(out / "story.jpg")
    files.append(media.reels(item, out / "reels.mp4"))
    cap = caption(p, body, st)
    (out / "caption.txt").write_text(cap + "\n\n" + link(p["slug"]) + "\n", encoding="utf-8")
    return Package(p["slug"], f"{f['brand']} {p['name']}", cap, link(p["slug"]), files, source, bool(p.get("sample")))


def daily(cat, demand: Demand) -> tuple[list[Package], list[str]]:
    """-> (packages, problems for the admin summary)."""
    n = cfg()["content"]["daily_posts"]
    uz = cat.products("uz")
    ru = {p["id"]: p for p in cat.products("ru")}
    st = cat.store()
    chosen = pick(uz, demand, n)
    pkgs, errs = [], []
    if len(chosen) < n:
        errs.append(f"Post uchun tovar yetmadi: {len(chosen)}/{n} (omborda bor, rasmli, {cfg()['content']['repost_after_days']} kunda chiqmagan).")
    for p in chosen:
        try:
            pkgs.append(build(p, ru.get(p["id"]), st, cat.base))
        except Exception as e:  # one product must not stop the rest
            log.exception("package %s failed", p["slug"])
            errs.append(f"{p['name']}: {e}")
    return pkgs, errs
