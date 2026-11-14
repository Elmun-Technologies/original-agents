// Side-by-side: design screenshot (design/screens/<Name>.jpg, rendered with the real fonts) vs our page.
//   node scripts/compare.mjs <Name> <our url> <out dir>      e.g.  Main http://localhost:3000/uz /tmp/cmp
// Our page is captured at the design image's width; if the design image is one screen (mobile), so is ours.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { chromium } from '@playwright/test'

const [, , name, url, out] = process.argv
const jpg = path.resolve('..', 'design', 'yeppo-handoff', 'design', 'screens', `${name}.jpg`)
const py = path.resolve('..', '.venv', 'bin', 'python')
const [w, h] = execFileSync(py, ['-c', `from PIL import Image; print(*Image.open(${JSON.stringify(jpg)}).size)`]).toString().trim().split(' ').map(Number)

// desktop canvases are 1440 px wide, exported as 1200 px images: render at 1440, then scale down to compare
const vw = w === 1200 ? 1440 : w
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: vw, height: Math.min(h, 900) } })
await page.goto(url, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(500)
const sw = await page.evaluate(() => document.documentElement.scrollWidth)
const ours = path.join(out, `${name}-ours.png`)
await page.screenshot({ path: ours, fullPage: h > 900 })
await browser.close()
const joined = path.join(out, `${name}.png`)
execFileSync(py, [path.resolve('scripts', 'join.py'), jpg, ours, joined])
console.log(name, `${vw}px`, sw <= vw ? 'OK' : `OVERFLOW ${sw}`, joined)
