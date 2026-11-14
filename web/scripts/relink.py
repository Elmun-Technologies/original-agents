"""Re-target generated design links by their visible label:  relink.py <file> '<label>=<route>' …
Each <Link …>…{tr("label")}…</Link> whose FIRST translated label matches gets href={L("route")}."""
import re
import sys

path, pairs = sys.argv[1], dict(a.split('=', 1) for a in sys.argv[2:])
s = open(path, encoding='utf-8').read()
def fix(m):
    block = m.group(0)
    lab = re.search(r'tr\("([^"]+)"\)', block)
    if lab and lab.group(1) in pairs:
        block = re.sub(r'href=\{L\("[^"]*"\)\}', f'href={{L("{pairs[lab.group(1)]}")}}', block, count=1)
    return block
s = re.sub(r'<Link href=\{L\("[^"]*"\)\}.*?</Link>', fix, s, flags=re.S)
open(path, 'w', encoding='utf-8').write(s)
