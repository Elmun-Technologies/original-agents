// Screenshots a page at several widths and reports horizontal overflow (compare with design/screens/*.jpg).
//   node scripts/shot.mjs <url> <out-prefix> 1440 834 390
import { chromium } from '@playwright/test'

const [, , url, out, ...widths] = process.argv
const browser = await chromium.launch()
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: +w, height: 900 } })
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(500)
  const sw = await page.evaluate(() => document.documentElement.scrollWidth)
  console.log(w, 'scrollWidth', sw, sw <= +w ? 'OK' : 'OVERFLOW')
  await page.screenshot({ path: `${out}-${w}.png`, fullPage: true })
  await page.close()
}
await browser.close()
