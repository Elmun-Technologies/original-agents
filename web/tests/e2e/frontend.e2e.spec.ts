import { expect, test } from '@playwright/test'

const BASE = 'http://localhost:3000'
const WIDTHS = [360, 390, 600, 834, 1024, 1280, 1440] // HANDOFF §9
const PAGES = ['/uz', '/ru', '/uz/dev/components']

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
  const href = (name: string) => page.locator('main a:visible', { hasText: name }).first().getAttribute('href')
  expect(await href('35+ yosh')).toBe('/uz/kim-uchun/35')
  expect(await href('Boʻlajak onalar')).toBe('/uz/kim-uchun/onalar')
  expect(await href('Kremlar')).toBe('/uz/katalog/krem')
  expect(await href('Toʻplamlar')).toBe('/uz/katalog/toplamlar')
  expect(await href('SPF qishda ham kerakmi')).toBe('/uz/jurnal/spf-qishda')
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
