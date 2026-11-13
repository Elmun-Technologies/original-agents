"""Replica filter (CLAUDE.md §2: "Faqat original").

Any hit in name, description, seller note or source URL rejects the product.
False positives are acceptable (admin sees the reason); false negatives are not.
"""
import re
import unicodedata

# (label shown in rejected_reason, regex on normalized text)
_STEM = r"(?<![\w])"          # word start only: catches Uzbek/Russian suffixes (kopiyasi, реплики)
_WORD = r"(?<![\w]){}(?![\w])"  # whole word: avoids "copyright", "fakel"

TERMS: list[tuple[str, str]] = [
    # Uzbek / Russian / translit
    ("replika", _STEM + r"(replik|replic|реплик)"),
    ("kopiya", _STEM + r"(kopi[yj]|kopya|копи[яюиейё])"),
    ("feyk", _STEM + r"(feyk|фейк)"),
    ("lyuks", _STEM + r"(lyuks|lux|люкс)\s*(kopi|copy|копи)"),
    ("a-kopiya", _STEM + r"(a|а)\s*-?\s*(kopi|copy|копи)"),
    ("один в один", r"(один\s*в\s*один|bir\s*ga\s*bir)"),
    ("1:1", r"(?<!\d)1\s*(:|в|v|to|ga|к)\s*1(?!\d)"),
    # English
    ("replica", _WORD.format(r"replicas?")),
    ("fake", _WORD.format(r"fakes?")),
    ("mirror quality", r"mirror\s*(quality|grade)"),
    ("aaa quality", _WORD.format(r"a{3,5}\+?") + r"\s*(quality|grade)?"),
    ("unauthorized authentic", r"unauthori[sz]ed\s*authentic"),
    ("top copy", r"(top|high|best|super)\s*(quality\s*)?copy"),
    ("batch", _WORD.format(r"(pk|ljr|og|god|h12|m|s2|dg|gx)\s*batch")),
    # Chinese replica trade terms
    ("公司级", r"公司级"), ("纯原", r"纯原"), ("原单", r"原单"), ("复刻", r"复刻"),
    ("高仿", r"高仿"), ("莆田", r"莆田"), ("一比一", r"(1|一)比(1|一)"), ("A货", r"a货"),
    ("超A", r"超a"), ("尾单", r"尾单"), ("共享货源", r"共享货源"), ("顶级版本", r"顶级版"),
]

BLOCKED_DOMAINS = ("gxhyapp.com",)

_COMPILED = [(label, re.compile(rx)) for label, rx in TERMS]


def normalize(text: str) -> str:
    # NFKC: fullwidth "ＲＥＰＬＩＣＡ" / "１：１" -> ascii; casefold for case-insensitivity
    return unicodedata.normalize("NFKC", text).casefold()


def find_terms(text: str | None) -> list[str]:
    if not text:
        return []
    t = normalize(text)
    hits = [label for label, rx in _COMPILED if rx.search(t)]
    hits += [d for d in BLOCKED_DOMAINS if d in t]
    return hits


def check(fields: dict[str, str | None]) -> str | None:
    """fields: {"name": ..., "description": ..., "seller_note": ..., "source_url": ...}.
    Returns a reason like "replika: name='kopiya'; description='纯原'" or None if clean."""
    found = [f"{field}='{', '.join(hits)}'"
             for field, text in fields.items() if (hits := find_terms(text))]
    return "replika: " + "; ".join(found) if found else None


def apply(product) -> bool:
    """Checks a Product and marks it rejected. Returns True if it is clean."""
    reason = check({
        "name": " ".join(filter(None, [product.brand, product.model_name, product.colorway])),
        "description": product.description,
        "seller_note": product.seller_note,
        "source_url": product.source_url,
    })
    if reason:
        product.rejected_reason = reason
        product.is_active = False
    return reason is None
