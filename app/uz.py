"""Uzbek Latin text helpers. oʻ / gʻ always use U+02BB (ʻ, official orthography)."""
import re

OKINA = "ʻ"  # ʻ
_APOS = "'’‘`ʼ´"
_OG_IN_WORD = re.compile(rf"([oOgG])[{_APOS}](?=\w)")       # o'lcham, g'alaba
_G_END = re.compile(rf"(?<=\w)([gG])[{_APOS}](?!\w)")         # bog', tog'


def uz(text: str) -> str:
    """Normalizes oʻ/gʻ to U+02BB. Other apostrophes (quotes, ma'lumot) are left alone."""
    return _G_END.sub(rf"\1{OKINA}", _OG_IN_WORD.sub(rf"\1{OKINA}", text))


def format_uzs(amount: int) -> str:
    """1690000 -> "1 690 000 soʻm" (plain spaces between thousands)."""
    return f"{int(amount):,}".replace(",", " ") + f" so{OKINA}m"
