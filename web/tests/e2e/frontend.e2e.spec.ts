import { expect, test } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3100'
const WIDTHS = [360, 390, 600, 834, 1024, 1280, 1440] // HANDOFF §9
const AMP = '/mahsulot/skin1004-madagascar-centella-ampoule'
const PAGES = ['/uz', '/ru', '/uz/dev/components', '/uz/katalog/serum', '/ru/katalog/serum?teri=dry', `/uz${AMP}`, `/ru${AMP}`, '/uz/savat', '/uz/rasmiylashtirish']
// stage-1 content pages: phone, tablet, desktop only (keeps the run short)
const MORE = ['/uz/yuz-parvarishi', '/uz/aksiyalar', '/uz/brendlar', '/uz/qidiruv?q=krem', '/uz/jurnal', '/uz/yordam/yetkazish', '/ru/sovgalar', '/uz/rutina', '/uz/sevimlilar', '/uz/kirish', '/uz/bonus', '/uz/maslahatchi', '/uz/kim-uchun/erkaklar']
const phone = () => `90 ${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`

test('root redirects to a language', async ({ page }) => {
  await page.goto(BASE)
  await expect(page).toHaveURL(/\/(uz|ru)$/)
  await expect(page.locator('html')).toHaveAttribute('lang', /uz|ru/)
})

test('russian page is translated', async ({ page }) => {
  await page.goto(`${BASE}/ru`)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.getByText('Только оригинал, с документами').first()).toBeVisible()
})

test('add to cart updates header and shows toast', async ({ page }) => {
  await page.goto(`${BASE}/uz`)
  const btn = page.locator('.pc .addbtn:visible').first()
  await btn.click()
  await expect(page.getByRole('status')).toContainText('Savatga qoʻshildi')
  await expect(btn).toContainText('Savatda ✓')
})

test('phone shows the mobile home, desktop the full one', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/uz`)
  await expect(page.getByText('Hozir koʻp olinmoqda')).toBeVisible()
  await expect(page.getByText('Salom! Keling, birga tanlaymiz.')).toBeHidden()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByText('Salom! Keling, birga tanlaymiz.')).toBeVisible()
})

test('picker changes products by skin and concern', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/uz`)
  const picks = page.locator('#pick-h').locator('xpath=ancestor::section').locator('.pc')
  await expect(picks).toHaveCount(3)
  await page.getByRole('button', { name: 'Quyoshdan himoya' }).click()
  await expect(picks.first()).toContainText('Safe Block')
})

test('home cards link to the matching pages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/uz`)
  const href = (name: string | RegExp) => page.locator('main').getByRole('link', { name, exact: true }).first().getAttribute('href')
  expect(await href(/^35\+ yosh/)).toBe('/uz/kim-uchun/35')
  expect(await href(/^Boʻlajak onalar/)).toBe('/uz/kim-uchun/onalar')
  expect(await href('Kremlar')).toBe('/uz/katalog/krem')
  expect(await href('Toʻplamlar')).toBe('/uz/katalog/toplamlar')
  expect(await href(/SPF qishda ham kerakmi/)).toBe('/uz/jurnal/spf-qishda')
})

test('catalog filters live in the URL and narrow the grid', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/uz/katalog/serum`)
  const grid = page.locator('.d-only .pgrid .pc')
  const all = await grid.count()
  await page.getByRole('checkbox', { name: 'Faqat aksiyadagilar' }).check()
  await expect(page).toHaveURL(/aksiya=1/)
  await expect.poll(() => grid.count()).toBeLessThan(all)
  await expect(page.getByRole('button', { name: 'Olib tashlash: Aksiyada' })).toBeVisible()
  await page.getByRole('radio', { name: 'Arzonroq' }).click()
  await expect(page).toHaveURL(/tartib=cheap/)
  await page.getByRole('button', { name: 'Hammasini tozalash' }).click()
  await expect(page).not.toHaveURL(/aksiya/)
})

test('catalog empty state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/uz/katalog/serum?dan=9000000`)
  await expect(page.getByText('Bunday mahsulot hozircha yoʻq')).toBeVisible()
})

test('phone catalog: own top bar and filter sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/uz/katalog/serum`)
  await expect(page.locator('.hdr')).toBeHidden()
  await page.getByRole('button', { name: /^Filtrlar/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Filtrlar' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Poralar' }).click()
  await expect(page).toHaveURL(/muammo=pores/)
  await sheet.getByRole('button', { name: /mahsulotni koʻrsatish/ }).click()
  await expect(sheet).toBeHidden()
})

test('unknown category is 404', async ({ page }) => {
  const r = await page.goto(`${BASE}/uz/katalog/yoq-narsa`)
  expect(r?.status()).toBe(404)
})

test('product: volume changes price, fit answers, cart gets the chosen volume', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/uz${AMP}`)
  const main = page.locator('.d-only')
  await expect(main.locator('.num').filter({ hasText: '245 000 soʻm' }).first()).toBeVisible()
  await main.getByRole('radio', { name: /100 ml/ }).click()
  await expect(main.locator('.num').filter({ hasText: '389 000 soʻm' }).first()).toBeVisible()
  await main.getByRole('button', { name: 'Quruq', exact: true }).click()
  await expect(main.getByText('Mos, lekin ustidan namlantiruvchi krem surting')).toBeVisible()
  await main.getByRole('button', { name: 'Savatga qoʻshish' }).click()
  await expect(page.getByRole('status')).toContainText('Savatga qoʻshildi')
  await expect(page.locator('header .num').first()).toHaveText('389 000')
})

test('product: no fake reviews, honest empty state and no rating markup', async ({ page }) => {
  await page.goto(`${BASE}/uz${AMP}`)
  await expect(page.locator('#reviews')).toContainText('Hali sharh yoʻq')
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent()
  expect(ld).toContain('"@type":"Product"')
  expect(ld).not.toContain('aggregateRating')
})

test('product: sold out offers a notification instead of the cart', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/uz/mahsulot/iunik-black-snail-restore-serum`)
  await expect(page.locator('.d-only').getByRole('link', { name: 'Kelganda xabar berish' })).toHaveAttribute('href', /start=notify_Y-SNAIL/)
})

test('phone product: sticky bar adds to cart, tab bar hidden', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/uz${AMP}`)
  await expect(page.locator('.mtabs')).toBeHidden()
  await page.locator('.m-bar').getByRole('button', { name: /Savatga · 245 000/ }).click()
  await expect(page.locator('.m-bar')).toContainText('rasmiylashtirish')
})

test('recently viewed shows the product in the catalog', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/uz${AMP}`)
  await page.goto(`${BASE}/uz/katalog/toner`)
  await expect(page.locator('#rv-h')).toBeVisible()
  await expect(page.locator('section[aria-labelledby="rv-h"]')).toContainText('Madagascar Centella Ampoule')
})

test('full purchase (desktop, Click, test payment): cart -> checkout -> pay -> order page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/uz${AMP}`)
  await page.locator('.d-only').getByRole('button', { name: 'Savatga qoʻshish' }).click()
  await page.goto(`${BASE}/uz/mahsulot/beauty-of-joseon-revive-serum-ginseng-snail-mucin`)
  await page.locator('.d-only').getByRole('button', { name: 'Savatga qoʻshish' }).click()
  await page.goto(`${BASE}/uz/savat`)
  const aside = page.getByRole('complementary', { name: 'Buyurtma xulosasi' })
  await expect(aside).toContainText('464 000')
  await aside.getByPlaceholder('Promokod, masalan SALOM10').fill('salom10')
  await aside.getByRole('button', { name: 'Qoʻllash' }).click()
  await expect(aside).toContainText('SALOM10 qoʻllandi — birinchi buyurtmaga −10%')
  await expect(aside).toContainText('418 000 soʻm')
  await aside.getByRole('link', { name: /Rasmiylashtirishga/ }).click()
  await expect(page).toHaveURL(/rasmiylashtirish/)
  const main = page.locator('.checkout-page .d-only').last()
  await main.getByRole('button', { name: /Click orqali 418 000/ }).click()
  await expect(main.getByText('Ismingizni yozing')).toBeVisible()
  await main.getByLabel('Ismingiz').fill('Malika')
  await main.getByLabel('Telefon raqam').fill(phone())
  await main.getByLabel('Manzil').fill('Amir Temur 1')
  await main.getByRole('button', { name: /Click orqali 418 000/ }).click()
  await expect(page).toHaveURL(/tolov\/sinov/)
  await page.getByRole('button', { name: 'Toʻlash (sinov)' }).click()
  await expect(page).toHaveURL(/buyurtma\/\d+\?t=/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Rahmat, Malika! Buyurtmangiz qabul qilindi')
  await expect(page.locator('main')).toContainText('Toʻlandi · Click')
  await expect(page.locator('header .num').first()).toHaveText('0') // cart cleared
  await expect(page.locator('section[aria-labelledby="nx-h"]')).not.toContainText('Madagascar Centella Ampoule') // bought -> not recommended
})

test('phone checkout is step by step and Uzcard/Humo goes through Payme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/uz${AMP}`)
  await page.locator('.m-bar').getByRole('button', { name: /Savatga/ }).click()
  await page.goto(`${BASE}/uz/savat`)
  await page.locator('.m-bar').getByRole('link', { name: 'Rasmiylashtirish' }).click()
  const phoneUi = page.locator('.m-only')
  await expect(phoneUi.getByText('1/3')).toBeVisible()
  await phoneUi.getByLabel('Ismingiz').fill('Aziz')
  await phoneUi.getByLabel('Telefon raqam').fill(phone())
  await page.locator('.m-bar').getByRole('button', { name: 'Davom etish' }).click()
  await expect(phoneUi.getByText('2/3')).toBeVisible()
  await phoneUi.getByLabel('Manzil').fill('Navoiy 5')
  await page.locator('.m-bar').getByRole('button', { name: 'Davom etish' }).click()
  await phoneUi.getByRole('radio', { name: /Uzcard \/ Humo/ }).click()
  await page.locator('.m-bar').getByRole('button', { name: /orqali toʻlash/ }).click()
  await expect(page).toHaveURL(/p=payme/)
  await page.getByRole('button', { name: 'Toʻlash (sinov)' }).click()
  await expect(page.locator('main')).toContainText('Toʻlandi · Payme')
})

test('cancelled test payment leaves the order unpaid with a pay button', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/uz${AMP}`)
  await page.locator('.d-only').getByRole('button', { name: 'Savatga qoʻshish' }).click()
  await page.goto(`${BASE}/uz/rasmiylashtirish`)
  const main = page.locator('.checkout-page .d-only').last()
  await main.getByLabel('Ismingiz').fill('Test')
  await main.getByLabel('Telefon raqam').fill(phone())
  await main.getByLabel('Manzil').fill('Test 1')
  await main.getByRole('radio', { name: /Payme/ }).click()
  await main.getByRole('button', { name: /Payme orqali/ }).click()
  await page.getByRole('button', { name: 'Bekor qilish' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Toʻlov oʻtmadi')
  await expect(page.getByRole('link', { name: /Payme orqali .* toʻlash/ })).toBeVisible()
})

test('order page needs the secret token; empty cart; unknown promo', async ({ page }) => {
  expect((await page.goto(`${BASE}/uz/buyurtma/10001?t=wrong`))?.status()).toBe(404)
  await page.goto(`${BASE}/uz/savat`)
  await expect(page.getByText('Savat hozircha boʻsh').first()).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/uz${AMP}`)
  await page.locator('.d-only').getByRole('button', { name: 'Savatga qoʻshish' }).click()
  await page.goto(`${BASE}/uz/savat`)
  const aside = page.getByRole('complementary', { name: 'Buyurtma xulosasi' })
  await aside.getByPlaceholder('Promokod, masalan SALOM10').fill('YOQ123')
  await aside.getByRole('button', { name: 'Qoʻllash' }).click()
  await expect(aside).toContainText('Bunday promokod topilmadi')
})

for (const path of PAGES) {
  for (const w of WIDTHS) {
    test(`no horizontal scroll ${path} @${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 })
      await page.goto(`${BASE}${path}`)
      const sw = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(sw).toBeLessThanOrEqual(w)
    })
  }
}

for (const path of MORE) {
  for (const w of [360, 834, 1440]) {
    test(`page ok, no horizontal scroll ${path} @${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 })
      const r = await page.goto(`${BASE}${path}`)
      expect(r?.status()).toBe(200)
      await expect(page.locator('h1').first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w)
    })
  }
}

test('help sections and unknown pages', async ({ page }) => {
  for (const s of ['yetkazish', 'tolov', 'qaytarish', 'originallik', 'aloqa']) {
    expect((await page.goto(`${BASE}/uz/yordam/${s}`))?.status()).toBe(200)
  }
  expect((await page.goto(`${BASE}/uz/yordam/yoq`))?.status()).toBe(404)
  expect((await page.goto(`${BASE}/uz/bunday-sahifa-yoq`))?.status()).toBe(404)
})

test('cabinet needs login; SMS code login (test mode) -> cabinet -> logout', async ({ page }) => {
  await page.goto(`${BASE}/uz/kabinet`)
  await expect(page).toHaveURL(/\/uz\/kirish/)
  await page.getByLabel('Telefon raqam').fill(`+998 ${phone()}`)
  await page.getByRole('button', { name: 'Kod olish' }).click()
  const hint = page.getByText('Sinov rejimi: SMS yuborilmadi. Kod:')
  await expect(hint).toBeVisible()
  const code = (await hint.locator('b').textContent())!.trim()
  await page.getByLabel('Kod', { exact: true }).fill('0000' === code ? '1111' : '0000')
  await page.getByRole('button', { name: 'Kirish', exact: true }).click()
  await expect(page.getByText('Kod notoʻgʻri yoki eskirgan')).toBeVisible()
  await page.getByLabel('Kod', { exact: true }).fill(code)
  await page.getByRole('button', { name: 'Kirish', exact: true }).click()
  await expect(page).toHaveURL(/\/uz\/kabinet/)
  await expect(page.getByRole('heading', { name: 'Buyurtmalarim' })).toBeVisible()
  await page.getByRole('button', { name: 'Chiqish' }).click()
  await expect(page).toHaveURL(/\/uz$/)
  await page.goto(`${BASE}/uz/kabinet`)
  await expect(page).toHaveURL(/\/uz\/kirish/)
})

test('favourites: heart on a card -> list -> remove', async ({ page }) => {
  await page.goto(`${BASE}/uz/katalog/serum`)
  const card = page.locator('.pc:visible').first()
  const name = (await card.locator('.pimg').first().getAttribute('aria-label'))!
  await card.getByRole('button', { name: 'Sevimlilarga' }).click()
  await page.goto(`${BASE}/uz/sevimlilar`)
  await expect(page.getByRole('link', { name }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Oʻchirish' }).first().click()
  await expect(page.getByText('Hali hech narsa saqlanmagan')).toBeVisible()
})

test('no broken internal links (crawl from both home pages)', async ({ request }) => {
  test.setTimeout(240_000)
  const seen = new Set<string>(), bad: string[] = []
  const queue = ['/uz', '/ru']
  while (queue.length && seen.size < 220) {
    const path = queue.shift()!
    if (seen.has(path)) continue
    seen.add(path)
    const r = await request.get(`${BASE}${path}`, { maxRedirects: 3 })
    if (r.status() >= 400) { bad.push(`${r.status()} ${path}`); continue }
    if (!(r.headers()['content-type'] ?? '').includes('text/html')) continue
    for (const m of (await r.text()).matchAll(/href="(\/(?:uz|ru)[^"#]*)"/g)) {
      const u = m[1].replace(/&amp;/g, '&')
      // personal/transactional pages and filter permutations are covered by their own tests
      if (/\/(kabinet|buyurtma|tolov|rasmiylashtirish)/.test(u) || u.includes('?')) continue
      if (!seen.has(u)) queue.push(u)
    }
  }
  expect(bad).toEqual([])
  expect(seen.size).toBeGreaterThan(40)
})

test('phone: search, consultant and cabinet use their own top bar (design Mobile*)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/uz/qidiruv?q=${encodeURIComponent('quruq teri uchun krem')}`)
  await expect(page.locator('.hdr')).toBeHidden()
  await expect(page.locator('.m-top').getByRole('button', { name: 'Orqaga' })).toBeVisible()
  await expect(page.locator('.m-top').getByText('Tushundim:')).toBeVisible()
  await page.goto(`${BASE}/uz/maslahatchi`)
  await expect(page.locator('.hdr')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Orqaga' })).toBeVisible()
  // cabinet: menu list -> section -> back
  await page.goto(`${BASE}/uz/kirish`)
  await page.getByLabel('Telefon raqam').fill(`+998 ${phone()}`)
  await page.getByRole('button', { name: 'Kod olish' }).click()
  const code = (await page.getByText('Sinov rejimi: SMS yuborilmadi. Kod:').locator('b').textContent())!.trim()
  await page.getByLabel('Kod', { exact: true }).fill(code)
  await page.getByRole('button', { name: 'Kirish', exact: true }).click()
  await expect(page).toHaveURL(/\/uz\/kabinet/)
  await page.getByRole('button', { name: /Teri profilim/ }).click()
  await expect(page.getByRole('heading', { name: 'Teri profilim' })).toBeVisible()
  await page.getByRole('button', { name: 'Orqaga' }).click()
  await expect(page.getByRole('button', { name: /Buyurtmalarim/ })).toBeVisible()
})
