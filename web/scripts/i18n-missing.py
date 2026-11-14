"""Lists Uzbek UI strings used in src/ (tr("…"), t(lang, "…")) that have no Russian in src/i18n/ru*.json."""
import glob, json, re

ru = {}
for f in glob.glob("src/i18n/ru*.json"):
    ru.update(json.load(open(f, encoding="utf-8")))
pat = re.compile(r"""\b(?:tr|tn|t\(lang,|tn\(lang,)\s*\(?\s*(['"])((?:(?!\1).)+)\1""")
missing = {}
for f in glob.glob("src/**/*.tsx", recursive=True) + glob.glob("src/**/*.ts", recursive=True):
    for m in pat.finditer(open(f, encoding="utf-8").read()):
        s = m.group(2)
        if s not in ru and re.search(r"[a-zʻ]{2,}", s):
            missing.setdefault(s, f)
for s, f in sorted(missing.items()):
    print(f"{f}: {s}")
print(len(missing), "missing")
