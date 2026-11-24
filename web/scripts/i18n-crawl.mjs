// Finds texts shown in Russian without a translation, including the ones a static search cannot see
// (texts kept in arrays or coming from props).
//   1) NEXT_PUBLIC_I18N_DEBUG=1 pnpm build && pnpm start -p 3100 > server.log 2>&1
//   2) node scripts/i18n-crawl.mjs http://localhost:3100 server.log
// Opens every /ru page it can reach at phone and desktop width and prints each "[i18n-miss]" once.
import fs from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:3100'
const LOG = process.argv[3]
const START = ['/ru', '/ru/savat', '/ru/rasmiylashtirish', '/ru/kirish', '/ru/kabinet', '/ru/sevimlilar', '/ru/rutina', '/ru/maslahatchi', '/ru/bonus',
  '/ru/qidiruv?q=krem', '/ru/qidiruv?q=zzzz', '/ru/yoq-sahifa', '/ru/yordam/oferta', '/ru/yordam/maxfiylik']
const miss = new Map()
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const ctx = await browser.newContext(process.env.E2E_PASSWORD ? { httpCredentials: { username: 'yeppo', password: process.env.E2E_PASSWORD } } : {})
const page = await ctx.newPage()
let current = ''
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[i18n-miss] ')) miss.set(t.slice(12), miss.get(t.slice(12)) ?? current) })
const seen = new Set(), queue = [...START]
while (queue.length && seen.size < 300) {
  const path = queue.shift()
  if (seen.has(path)) continue
  seen.add(path)
  current = path
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const r = await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => null)
    if (!r) break
  }
  for (const h of await page.$$eval('a[href^="/ru"]', (as) => as.map((a) => a.getAttribute('href')))) {
    const u = h.split('#')[0]
    if (!seen.has(u) && !/\/(buyurtma|tolov)/.test(u) && !u.includes('?')) queue.push(u)
  }
}
await browser.close()
if (LOG && fs.existsSync(LOG)) for (const l of fs.readFileSync(LOG, 'utf8').split('\n')) { const i = l.indexOf('[i18n-miss] '); if (i >= 0 && !miss.has(l.slice(i + 12))) miss.set(l.slice(i + 12), 'server') }
for (const [text, where] of [...miss].sort()) console.log(`${where}\t${text}`)
console.error(`${seen.size} pages, ${miss.size} texts without Russian`)
