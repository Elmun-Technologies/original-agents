// Admin panel screens. Needs an admin account: E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD (create one with `pnpm admin:create`).
// Skipped without them, so a public checkout never runs against a real admin.
import { expect, test, type Page } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL
const PASSWORD = process.env.E2E_ADMIN_PASSWORD
test.skip(!EMAIL || !PASSWORD, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set')
test.describe.configure({ mode: 'serial' })

async function login(page: Page) {
  await page.goto(`${BASE}/admin/login`)
  await page.fill('input[name=email]', EMAIL!)
  await page.fill('input[name=password]', PASSWORD!)
  await page.click('button[type=submit]')
  await page.waitForURL(/\/admin(\/?$|\/(?!login))/)
}

test('screens need a login', async ({ page, request }) => {
  await page.goto(`${BASE}/admin/integratsiyalar`)
  await expect(page).toHaveURL(/\/admin\/login/)
  for (const url of ['/api/admin/integrations']) expect((await request.get(`${BASE}${url}`)).status()).toBe(401)
  expect((await request.patch(`${BASE}/api/admin/integrations`, { data: { values: { ga4Id: 'G-ABCD1234' } } })).status()).toBe(401)
  expect((await request.post(`${BASE}/api/admin/integrations/test`, { data: { service: 'telegram' } })).status()).toBe(401)
})

test('integrations: save, refuse bad input, hide secrets, protect payments', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/admin/integratsiyalar`)
  await expect(page.getByRole('heading', { name: 'Integratsiyalar', level: 1 })).toBeVisible()
  const ga = page.locator('#ga4')
  await ga.getByLabel('Measurement ID').fill('G-1"></script>')
  await ga.getByRole('button', { name: 'Saqlash' }).click()
  await expect(ga.locator('.yp-msg.err')).toContainText('G- bilan boshlanishi kerak')
  await ga.getByLabel('Measurement ID').fill('G-AB12CD34EF')
  await ga.getByRole('button', { name: 'Saqlash' }).click()
  await expect(ga.locator('.yp-msg.ok')).toHaveText('Saqlandi.')
  await expect(ga.locator('.yp-pill')).toHaveText('Ulangan')
  await page.reload()
  await expect(page.locator('#ga4').getByLabel('Measurement ID')).toHaveValue('G-AB12CD34EF')

  // a secret: saved, shown only as a mask, never returned in clear text
  const tg = page.locator('#telegram')
  await tg.getByLabel('Bot token').fill('123456:e2e-token-abcdefgh')
  await tg.getByLabel(/Admin Telegram/).fill('123456789')
  await tg.getByRole('button', { name: 'Saqlash' }).click()
  await expect(tg.locator('.yp-msg.ok')).toBeVisible()
  const shown = await (await page.request.get(`${BASE}/api/admin/integrations`)).text()
  expect(shown).not.toContain('e2e-token')
  expect(shown).toContain('••••••••efgh')
  await page.reload()
  await expect(page.locator('#telegram').getByLabel('Bot token')).toHaveValue('••••••••efgh')
  await expect(page.locator('#telegram .yp-pill')).toHaveText('Ulangan')

  // real payments cannot be switched on without keys
  const mode = page.locator('#mode')
  await mode.getByLabel('Rejim').selectOption('live')
  await mode.getByRole('button', { name: 'Saqlash' }).click()
  await expect(mode.locator('.yp-msg.err')).toContainText('Click yoki Payme')
  await page.reload()
  await expect(page.locator('#mode .yp-pill')).toHaveText('Sinov')

  // clean up what the test saved
  page.on('dialog', (d) => d.accept())
  await page.locator('#telegram').getByRole('button', { name: 'Kalitni oʻchirish' }).click()
  await expect(page.locator('#telegram .yp-msg.ok')).toBeVisible()
  await page.locator('#telegram').getByLabel(/Admin Telegram/).fill('')
  await page.locator('#telegram').getByRole('button', { name: 'Saqlash' }).click()
  await page.locator('#ga4').getByLabel('Measurement ID').fill('')
  await page.locator('#ga4').getByRole('button', { name: 'Saqlash' }).click()
  await expect(page.locator('#ga4 .yp-msg.ok')).toBeVisible()
})
