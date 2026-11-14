import { expect, test } from '@playwright/test'

const BASE = 'http://localhost:3000'
const WIDTHS = [360, 390, 600, 834, 1024, 1280, 1440] // HANDOFF §9
const PAGES = ['/uz', '/ru', '/uz/dev/components', '/uz/katalog/serum', '/ru/katalog/serum?teri=dry']

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
