"""Design page -> starting React component (scripts/html2jsx.py --i18n), product cards -> {C(n)}.
    python3 scripts/gen-page.py <DesignName>   ->  src/components/pages/<DesignName>.tsx
The result is edited by hand afterwards (state, data). Re-running overwrites the file."""
import re
import sys

sys.path.insert(0, 'scripts')
from html2jsx import body_blocks, to_jsx

name = sys.argv[1]
html = open(f'../design/yeppo-handoff/design/preview/{name}.html', encoding='utf-8').read()
blocks = body_blocks(html)
main = next((b for b in blocks if b.lstrip().startswith('<main')), blocks[0])
n = 0
def card(_):
    global n
    n += 1
    return f'<x-card data-n="{n - 1}"></x-card>'
main = re.sub(r'<div class="pc">.*?<button class="addbtn".*?</button>\s*</div>', card, main, flags=re.S)
jsx = to_jsx(main, True)
jsx = re.sub(r'<x-card data-n="(\d+)"></x-card>', r'{C(\1)}', jsx)
jsx = re.sub(r'^<main', '<div', jsx.strip()).rstrip()
jsx = re.sub(r'</main>$', '</div>', jsx)
out = f"""// Generated from design/preview/{name}.html by scripts/gen-page.py, then edited by hand.
import Link from 'next/link'

export type PageProps = {{ tr: (s: string) => string; L: (p: string) => string; C: (i: number) => React.ReactNode }}

export function {name}Page({{ tr, L, C }}: PageProps) {{
  return (
{jsx}
  )
}}
"""
open(f'src/components/pages/{name}.tsx', 'w', encoding='utf-8').write(out)
print(name, len(out), 'cards:', n)
