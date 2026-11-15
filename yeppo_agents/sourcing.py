"""Sourcing agent: read Q-Depot listing pages, score products against this week's demand, open the best
product pages, price them, and store candidates for the admin ("buy / add to catalog" proposals).

Never writes to the site by itself. Stops on Blocked (403/429/captcha) and reports it."""
import logging
import re
from collections import Counter
from dataclasses import dataclass
from decimal import Decimal

from app.scraping.blocklist import find_terms
from yeppo_agents import demand as dm
from yeppo_agents import pricing, qdepot, store
from yeppo_agents.fetch import Blocked, Fetcher, NotAllowed
from yeppo_agents.settings import cfg

log = logging.getLogger(__name__)
TOKEN = re.compile(r"[a-z0-9]+")
STOP = {"ml", "g", "ea", "pcs", "the", "for", "and", "with", "of", "set", "new", "ver", "x"}


def tokens(name: str) -> set[str]:
    return {t for t in TOKEN.findall(name.lower()) if t not in STOP and not t.isdigit() and not re.fullmatch(r"\d+(ml|g|ea)", t)}


def same_product(a: str, b: str) -> bool:
    # ponytail: token Jaccard on names; switch to barcode/model match when the catalog stores them
    ta, tb = tokens(a), tokens(b)
    return bool(ta and tb) and len(ta & tb) / len(ta | tb) >= 0.7


def slug_key(url: str) -> str:
    return url.rstrip("/").rsplit("/", 1)[-1]


@dataclass
class Report:
    listed: int = 0
    opened: int = 0
    saved: int = 0
    skipped: Counter = None
    blocked: str | None = None
    demand: list[str] = None


def demand_from_catalog(cat) -> dm.Demand:
    """Signals from the site (searches, paid orders) + admin trends."""
    days = cfg()["demand"]["search_log_days"]
    products = cat.products()
    by_sku = {v["sku"]: p for p in products for v in p.get("variants") or []}
    sold = cat.sold_skus(days)
    by_cat, by_brand = Counter(), Counter()
    for sku, n in sold.items():
        p = by_sku.get(sku)
        if p:
            by_cat[(p.get("category") or {}).get("slug", "")] += n
            by_brand[(p.get("brand") or {}).get("name", "")] += n
    by_cat.pop("", None); by_brand.pop("", None); by_cat.pop("sertifikatlar", None); by_brand.pop("Yeppo", None)
    return dm.build(missed=cat.missed_searches(days), searches=cat.all_searches(days),
                    sold_by_cat=dict(by_cat), sold_brands=dict(by_brand),
                    trends=store.recent_trends(cfg()["demand"]["trend_days"]))


def run(cat, fetcher: Fetcher | None = None, rate: Decimal | None = None, demand: dm.Demand | None = None) -> Report:
    s = cfg()["source"]
    p = cfg()["pricing"]
    rep = Report(skipped=Counter())
    f = fetcher or Fetcher(s["base_url"])
    demand = demand or demand_from_catalog(cat)
    rep.demand = demand.summary()
    rate = rate or pricing.usd_rate()
    ours = [x["name"] for x in cat.products()]
    known = store.known_urls()

    found: dict[str, tuple[qdepot.Listed, bool]] = {}
    try:
        f.load_robots()
        for listing in s["listings"]:
            for n in range(1, s["pages_per_listing"] + 1):
                url = f"{s['base_url']}/{listing}" + (f"?page={n}" if n > 1 else "")
                try:
                    page = f.get(url)
                except NotAllowed:
                    rep.skipped["robots.txt"] += 1
                    break
                for it in qdepot.parse_listing(page):
                    key = slug_key(it.url)
                    if key not in found:
                        found[key] = (it, listing == "best-sellers")
                if n >= qdepot.page_count(page):
                    break
    except Blocked as e:
        rep.blocked = str(e)
    rep.listed = len(found)

    scored = []
    for key, (it, best) in found.items():
        why = None
        if dm.skipped(it.name):
            why = "kosmetika parvarishi emas (makiyaj/soch/...)"
        elif find_terms(f"{it.brand} {it.name}"):
            why = "replika so'zi"
        elif known.get(it.url) in ("added", "rejected"):
            why = "avval ko'rilgan"
        elif any(same_product(it.name, o) for o in ours):
            why = "katalogda bor"
        cat_slug = dm.category_of(it.name)
        if not why and not cat_slug:
            why = "kategoriya aniqlanmadi"
        q = pricing.quote(it.price_usd, cat_slug, rate) if not why else None
        if q and not (p["min_sell_price_uzs"] <= q.sell_uzs <= p["max_sell_price_uzs"]):
            why = "narx diapazondan tashqari"
        if why:
            rep.skipped[why] += 1
            continue
        score, reasons = demand.score(it.name, cat_slug)
        if best:
            score += 2
            reasons.append("Q-Depot best-seller")
        if it.old_usd and it.old_usd > it.price_usd:
            score += 1
            reasons.append("manbada chegirma")
        scored.append((score, it, cat_slug, reasons))

    scored.sort(key=lambda x: -x[0])
    if not rep.blocked:
        for score, it, cat_slug, reasons in scored[: s["detail_pages_per_run"]]:
            try:
                d = qdepot.parse_product(f.get(it.url), it.url)
            except Blocked as e:
                rep.blocked = str(e)
                break
            except NotAllowed:
                rep.skipped["robots.txt"] += 1
                continue
            rep.opened += 1
            if not d or not d.in_stock:
                rep.skipped["manbada yo'q (out of stock)"] += 1
                continue
            q = pricing.quote(d.price_usd, cat_slug, rate)
            store.upsert_candidate(
                url=it.url, name=d.name or it.name, brand=d.brand or it.brand, model=d.model, category=cat_slug,
                volume=qdepot.volume(d.name or it.name), img=(d.images or [it.img])[0], price_usd=d.price_usd,
                sell_uzs=q.sell_uzs, profit_uzs=q.profit_uzs, score=round(score, 2), reasons=reasons,
            )
            rep.saved += 1
    log.info("sourcing: listed=%s opened=%s saved=%s skipped=%s blocked=%s", rep.listed, rep.opened, rep.saved,
             dict(rep.skipped), rep.blocked)
    return rep
