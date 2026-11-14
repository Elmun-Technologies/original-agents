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
  await page.locator('.pc .addbtn').first().click()
  await expect(page.getByRole('status')).toContainText('Savatga qoʻshildi')
  await expect(page.locator('.pc .addbtn').first()).toContainText('Savatda ✓')
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
