"""Demand agent: what to look for this week. Rule-based on real signals only (no invented statistics):
season + holidays (config), site searches (especially "nothing found"), paid orders, admin /trend notes.
Every weight carries its reason so the admin sees why a product was proposed."""
import re
from dataclasses import dataclass, field
from datetime import date, datetime

from yeppo_agents.settings import TZ, cfg

STOPWORDS = {"uchun", "bor", "yoq", "kerak", "juda", "kop", "ham", "bilan", "qanday", "qaysi", "eng", "yaxshi", "narxi",
             "arzon", "yangi", "soralyapti", "sorashyapti", "mijozlar", "bormi", "the", "and", "for"}
APOS = re.compile(r"[ʻʼ’‘`´]")


def norm(s: str) -> str:
    return APOS.sub("'", s.lower()).strip()


def word_re(w: str) -> re.Pattern:
    return re.compile(rf"(?<![a-z]){re.escape(w.lower())}(?![a-z])")


def category_of(name: str) -> str | None:
    low = name.lower()
    for cat, words in cfg()["category_words"].items():
        if any(word_re(w).search(low) for w in words):
            return cat
    return None


def skipped(name: str) -> bool:
    low = name.lower()
    return any(word_re(w).search(low) for w in cfg()["skip_words"])


def translate(query: str) -> list[str]:
    """Customer words (uz/ru) -> source words. Unknown words are kept (brand names: 'anua', 'cosrx')."""
    q = norm(query)
    out: list[str] = []
    for key, words in cfg()["query_words"].items():
        if norm(key) in q:
            out += words
    for tok in re.findall(r"[a-z][a-z0-9&']{2,}", q):
        if tok in STOPWORDS or "'" in tok:
            continue  # Uzbek words with ʻ are not brand names
        if not any(norm(k).startswith(tok[:4]) for k in cfg()["query_words"]):
            out.append(tok)
    return list(dict.fromkeys(out))


@dataclass
class Demand:
    cats: dict[str, float] = field(default_factory=dict)
    words: dict[str, float] = field(default_factory=dict)
    why: dict[str, list[str]] = field(default_factory=dict)  # key ("cat:spf" / "word:cica") -> reasons

    def add(self, kind: str, key: str, w: float, reason: str) -> None:
        bucket = self.cats if kind == "cat" else self.words
        bucket[key] = bucket.get(key, 0) + w
        self.why.setdefault(f"{kind}:{key}", []).append(reason)

    def score(self, name: str, cat: str | None) -> tuple[float, list[str]]:
        low = name.lower()
        s, reasons = 0.0, []
        if cat and cat in self.cats:
            s += self.cats[cat]
            reasons += self.why.get(f"cat:{cat}", [])
        for w, v in self.words.items():
            if word_re(w).search(low):
                s += v
                reasons += self.why.get(f"word:{w}", [])
        return s, list(dict.fromkeys(reasons))

    def summary(self) -> list[str]:
        def weight(k: str) -> float:
            kind, key = k.split(":", 1)
            return (self.cats if kind == "cat" else self.words).get(key, 0)
        top = sorted(self.why.items(), key=lambda kv: -weight(kv[0]))
        return [f"{k.split(':', 1)[1]}: {'; '.join(dict.fromkeys(v))}" for k, v in top[:12]]


def _holiday_active(today: date, mmdd: str, before: int) -> bool:
    m, d = map(int, mmdd.split("-"))
    for y in (today.year, today.year + 1):
        delta = (date(y, m, d) - today).days
        if 0 <= delta <= before:
            return True
    return False


def build(*, today: date | None = None, missed: list[tuple[str, int]] = (), searches: list[tuple[str, int]] = (),
          sold_by_cat: dict[str, int] | None = None, sold_brands: dict[str, int] | None = None,
          trends: list[str] = ()) -> Demand:
    today = today or datetime.now(TZ).date()
    c = cfg()["demand"]
    d = Demand()
    for name, s in c["seasons"].items():
        if today.month in s["months"]:
            for cat, w in s["boost"].items():
                d.add("cat", cat, w, f"mavsum ({name})")
    for h in c["holidays"]:
        if _holiday_active(today, h["date"], h["before"]):
            for cat, w in h["boost"].items():
                d.add("cat", cat, w, f"bayram oldidan ({h['date']})")
    for q, n in missed:
        for w in translate(q):
            d.add("word", w, 2 + min(n, 10) * 0.5, f"saytda qidirildi, topilmadi: «{q}» ×{n}")
    for q, n in searches:
        for w in translate(q):
            d.add("word", w, min(n, 10) * 0.2, f"saytda qidirildi: «{q}» ×{n}")
    for cat, n in (sold_by_cat or {}).items():
        d.add("cat", cat, min(n, 20) * 0.3, f"sotuv: {n} dona (30 kun)")
    for brand, n in (sold_brands or {}).items():
        d.add("word", brand.lower(), min(n, 20) * 0.3, f"brend sotilmoqda: {n} dona (30 kun)")
    for t in trends:
        for w in translate(t):
            d.add("word", w, 3, f"admin trendi: «{t}»")
    return d
