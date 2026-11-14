"""Design preview HTML -> JSX (keeps the design's exact inline styles and classes).

    python3 scripts/html2jsx.py <preview.html> [--section N] [--list]

--list        prints the top-level blocks of <body> with their index and first text
--section N   prints block N as JSX (default: whole body)
--i18n        texts -> {tr("…")} (keys = data/ru.json), design links -> <Link href={L("/route")}>, images -> /img/
Used once per page to start a component from the design; the result is then wired to real data by hand.
"""
import json
import re
import sys
from html.parser import HTMLParser

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
ATTR = {"class": "className", "for": "htmlFor", "tabindex": "tabIndex", "readonly": "readOnly",
        "maxlength": "maxLength", "colspan": "colSpan", "rowspan": "rowSpan", "autocomplete": "autoComplete",
        "inputmode": "inputMode", "viewbox": "viewBox", "srcset": "srcSet", "crossorigin": "crossOrigin"}
DROP = {"onclick", "onchange", "oninput", "onsubmit"}
I18N_ATTRS = {"alt", "placeholder", "aria-label", "title"}
ROUTES = {"Main": "/", "Catalog": "/katalog/serum", "CategoryHub": "/yuz-parvarishi", "Product": "/mahsulot",
          "Cart": "/savat", "Checkout": "/rasmiylashtirish", "Order": "/buyurtma", "Search": "/qidiruv",
          "Rating": "/aksiyalar", "Segment": "/kim-uchun/18-25", "Brand": "/brend/skin1004", "Brands": "/brendlar",
          "Favorites": "/sevimlilar", "Account": "/kabinet", "Login": "/kirish", "Consultant": "/maslahatchi",
          "Routine": "/rutina", "Gifts": "/sovgalar", "Journal": "/jurnal", "Article": "/jurnal/teri-turi",
          "Loyalty": "/bonus", "Help": "/yordam/yetkazish", "NotFound": "/"}
LAT = re.compile(r"[A-Za-zʻА-Яа-я]")


def camel(s: str) -> str:
    return re.sub(r"-([a-z])", lambda m: m.group(1).upper(), s)


def style_obj(css: str) -> str:
    out = []
    for decl in css.split(";"):
        if ":" not in decl:
            continue
        k, v = decl.split(":", 1)
        k, v = k.strip(), v.strip()
        if not k:
            continue
        key = camel(k) if not k.startswith("--") else repr(k)
        if k.startswith("-webkit-"):
            key = "Webkit" + camel(k[8:])[0].upper() + camel(k[8:])[1:]
        out.append(f"{key}: {repr(v)}")
    return "{{" + ", ".join(out) + "}}"


class Conv(HTMLParser):
    def __init__(self, i18n=False):
        super().__init__(convert_charrefs=i18n)
        self.out, self.depth, self.svg, self.i18n, self.stack = [], 0, 0, i18n, []

    def attrs(self, tag, attrs):
        parts = []
        for k, v in attrs:
            if k in DROP:
                continue
            if k == "style":
                parts.append(f"style={style_obj(v or '')}")
                continue
            name = ATTR.get(k, k)
            if self.i18n and v is not None:
                if k == "href" and (m := re.match(r"(\w+?)(?:\.ru)?\.dc\.html(#.*)?$", v)) and m.group(1) in ROUTES:
                    parts.append(f'href={{L({json.dumps(ROUTES[m.group(1)] + (m.group(2) or ""))})}}')
                    continue
                if k == "src" and "assets/images/" in v:
                    v = "/img/" + v.rsplit("/", 1)[1]
                if k in I18N_ATTRS and LAT.search(v):
                    parts.append(f"{name}={{tr({json.dumps(v.strip(), ensure_ascii=False)})}}")
                    continue
            if self.svg and "-" in k and not k.startswith(("aria-", "data-")):
                name = camel(k)
            if v is None:
                parts.append(name)
            else:
                parts.append(f'{name}="{v}"' if '"' not in v else f"{name}={{{v!r}}}")
        return (" " + " ".join(parts)) if parts else ""

    def handle_starttag(self, tag, attrs):
        if tag == "svg":
            self.svg += 1
        name = tag
        if self.i18n and tag == "a" and re.match(r"\w+(\.ru)?\.dc\.html", dict(attrs).get("href") or ""):
            name = "Link"
        if tag not in VOID:
            self.stack.append(name)
        self.out.append(f"<{name}{self.attrs(tag, attrs)}{' /' if tag in VOID else ''}>")

    def handle_startendtag(self, tag, attrs):
        self.out.append(f"<{tag}{self.attrs(tag, attrs)} />")

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag == "svg":
            self.svg -= 1
        self.out.append(f"</{self.stack.pop() if self.stack else tag}>")

    def handle_data(self, data):
        core = data.strip()
        if self.i18n and core and LAT.search(core) and not self.svg:
            lead, trail = data[: len(data) - len(data.lstrip())], data[len(data.rstrip()):]
            self.out.append(f"{lead}{{tr({json.dumps(core, ensure_ascii=False)})}}{trail}")
            return
        if self.i18n:
            data = data.replace("<", "&lt;")
        self.out.append(data.replace("{", "{'{'}").replace("}", "{'}'}"))

    def handle_entityref(self, name):
        self.out.append(f"&{name};")

    def handle_charref(self, name):
        self.out.append(f"&#{name};")


def body_blocks(html: str) -> list[str]:
    body = html[html.index("<body"):]
    body = body[body.index(">") + 1: body.rindex("</body>")]
    body = re.sub(r"<script.*?</script>", "", body, flags=re.S)
    blocks, depth, start = [], 0, None
    for m in re.finditer(r"<(/?)([a-zA-Z][\w-]*)[^>]*?(/?)>", body):
        closing, tag, selfclose = m.group(1), m.group(2).lower(), m.group(3)
        if tag in VOID or selfclose:
            if depth == 0:
                blocks.append(m.group(0))
            continue
        if not closing:
            if depth == 0:
                start = m.start()
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                blocks.append(body[start:m.end()])
    return blocks


def to_jsx(html: str, i18n: bool = False) -> str:
    c = Conv(i18n)
    c.feed(html)
    return "".join(c.out)


if __name__ == "__main__":
    html = open(sys.argv[1], encoding="utf-8").read()
    blocks = body_blocks(html)
    if "--list" in sys.argv:
        for i, b in enumerate(blocks):
            text = re.sub(r"<[^>]+>", " ", b)
            print(i, b[:40].replace("\n", " "), "|", " ".join(text.split())[:90])
    elif "--section" in sys.argv:
        print(to_jsx(blocks[int(sys.argv[sys.argv.index("--section") + 1])], "--i18n" in sys.argv))
    else:
        print(to_jsx("".join(blocks), "--i18n" in sys.argv))
