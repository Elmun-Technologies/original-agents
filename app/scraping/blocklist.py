"""Replica filter (CLAUDE.md §2: "Faqat original"). Word lists: config/blocklist.yaml.
Also the "oʻxshatma" check: a famous model name under a missing or foreign brand."""
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache

from app import config

OFFICIAL_FIELDS = ("name", "description")  # Poizon/Dewu's own text for official sources


def normalize(text: str) -> str:
    # NFKC: fullwidth "ＲＥＰＬＩＣＡ" / "１：１" -> ascii; casefold for case-insensitivity
    return unicodedata.normalize("NFKC", text).casefold()


def term_regex(term: str) -> re.Pattern:
    t = normalize(term).strip()
    body = r"[\s\-]*".join(re.escape(part) for part in re.split(r"[\s\-]+", t))
    if any("一" <= ch <= "鿿" for ch in t):
        return re.compile(body)                       # Chinese: anywhere
    head = r"(?<!\d)" if t[0].isdigit() else r"(?<!\w)"  # letters: word start (stem match)
    tail = r"(?!\d)" if t[-1].isdigit() else ""
    return re.compile(head + body + tail)


@dataclass(frozen=True)
class Rules:
    common: list[tuple[str, re.Pattern]]
    external_only: list[tuple[str, re.Pattern]]
    domains: list[str]
    exceptions: list[str]
    official_sources: frozenset[str]
    famous_models: tuple[tuple[str, re.Pattern, tuple[re.Pattern, ...]], ...] = ()  # (model, rx, allowed brands)


def build_rules(cfg: dict) -> Rules:
    for key in ("common", "external_only", "domains", "exceptions", "official_sources"):
        if not isinstance(cfg.get(key), list):
            raise config.ConfigError(f"blocklist.yaml: '{key}' must be a list")
    terms = lambda key: [(normalize(t).strip(), term_regex(t)) for t in cfg[key]]
    return Rules(
        common=terms("common"),
        external_only=terms("external_only"),
        domains=[normalize(d).strip() for d in cfg["domains"]],
        exceptions=sorted((normalize(e).strip() for e in cfg["exceptions"]), key=len, reverse=True),
        official_sources=frozenset(cfg["official_sources"]),
        famous_models=tuple((normalize(str(m)).strip(), term_regex(str(m)), tuple(term_regex(b) for b in brands))
                            for m, brands in (cfg.get("famous_models") or {}).items()),
    )


@lru_cache
def rules() -> Rules:
    return build_rules(config.load_yaml("blocklist.yaml"))


def _clean(text: str, r: Rules) -> str:
    t = normalize(text)
    for e in r.exceptions:
        t = t.replace(e, " ")
    return t


def find_terms(text: str | None, r: Rules | None = None, *, external: bool = True) -> list[str]:
    """Matched terms. external=False skips external_only terms (official Poizon text)."""
    if not text:
        return []
    r = r or rules()
    t = _clean(text, r)
    pats = r.common + (r.external_only if external else [])
    return [label for label, rx in pats if rx.search(t)] + [d for d in r.domains if d in t]


def check(fields: dict[str, str | None], *, official: bool = False, r: Rules | None = None) -> str | None:
    """fields: {"name", "description", "seller_note", "source_url"} -> reason or None.
    official=True: external_only terms are ignored in name/description unless a common
    term is found somewhere in the product."""
    r = r or rules()
    hits = {f: find_terms(v, r, external=not (official and f in OFFICIAL_FIELDS)) for f, v in fields.items()}
    if official and any(hits.values()):  # replica already -> report official-text terms too
        hits = {f: find_terms(v, r) for f, v in fields.items()}
    found = [f"{f}='{', '.join(h)}'" for f, h in hits.items() if h]
    return "replika: " + "; ".join(found) if found else None


def knockoff(brand: str | None, name: str | None, r: Rules | None = None) -> str | None:
    """Famous model in the name, brand missing or not allowed for it -> reason."""
    r = r or rules()
    b, text = normalize(brand or "").strip(), normalize(name or "")
    for model, rx, allowed in r.famous_models:
        if rx.search(text) and not any(a.search(b) for a in allowed):
            who = f"brend '{brand}'" if b else "brend yoʻq"
            return f"brendsiz oʻxshatma — qoʻshilmadi ('{model}', {who})"
    return None


def apply(product) -> bool:
    """Checks a Product, sets rejected_reason/is_active. Returns True if clean."""
    reason = check({
        "name": " ".join(filter(None, [product.brand, product.model_name, product.colorway])),
        "description": product.description,
        "seller_note": product.seller_note,
        "source_url": product.source_url,
    }, official=product.origin in rules().official_sources)
    reason = reason or knockoff(product.brand, " ".join(filter(None, [product.model_name, product.colorway])))
    product.rejected_reason = reason
    product.is_active = reason is None
    return reason is None
