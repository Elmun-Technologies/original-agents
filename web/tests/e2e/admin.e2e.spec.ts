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

const SCREENS = [
  '/admin', '/admin/tayyorlik', '/admin/integratsiyalar', '/admin/seo', '/admin/heatmap',
  ...['umumiy', 'manbalar', 'sahifalar', 'mahsulotlar', 'qidiruv', 'auditoriya', 'tezlik', 'hozir'].map((t) => `/admin/analitika?tab=${t}`),
  ...['tashlab', 'mijozlar', 'kutish', 'havola', 'promokod'].map((t) => `/admin/marketing?tab=${t}`),
]

test('every admin screen opens, has its heading and no script errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page)
  for (const path of SCREENS) {
    const r = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    expect(r?.status(), path).toBe(200)
    await expect(page.locator('h1').first(), path).toBeVisible()
    await expect(page.locator('body'), path).not.toContainText('Something went wrong')
  }
  expect(errors).toEqual([])
})

test('the admin menu is in Uzbek and lists our screens', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/admin`)
  await page.locator('.nav-toggler').first().click()
  const nav = page.locator('nav, aside').filter({ hasText: 'Analitika' }).first()
  for (const t of ['Ishga tushirishga tayyorlik', 'Integratsiyalar', 'Analitika', 'Heatmap', 'Marketing', 'SEO audit', 'Buyurtmalar', 'Mahsulotlar', 'Mijozlar', 'Promokodlar']) await expect(nav, t).toContainText(t)
  await expect(nav).not.toContainText('Price Histories')
})

test('a campaign link appears in the sources report; the admin\'s own visits do not', async ({ page, browser }) => {
  const campaign = `e2e${Date.now()}`
  const visitor = await browser.newContext()
  const v = await visitor.newPage()
  await v.goto(`${BASE}/uz?utm_source=e2esource&utm_medium=story&utm_campaign=${campaign}`, { waitUntil: 'networkidle' })
  await v.goto(`${BASE}/uz/katalog/serum`, { waitUntil: 'networkidle' })
  await v.close() // sends what is queued
  await visitor.close()

  await login(page)
  await page.goto(`${BASE}/uz?utm_source=adminsource&utm_campaign=${campaign}admin`, { waitUntil: 'networkidle' }) // the admin browsing the site
  await page.waitForTimeout(500)
  await expect(async () => {
    await page.goto(`${BASE}/admin/analitika?tab=manbalar&r=1`, { waitUntil: 'networkidle' })
    await expect(page.locator('.yp-table')).toContainText(`e2esource / story / ${campaign}`)
  }).toPass({ timeout: 15_000 })
  await expect(page.locator('.yp-table')).not.toContainText('adminsource')
})

test('link builder makes a tracked link', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/admin/marketing?tab=havola`)
  await page.getByLabel('Kampaniya nomi').fill('Qish Aksiyasi!')
  await expect(page.locator('.yp-msg.ok')).toContainText('utm_source=instagram&utm_medium=story&utm_campaign=qish-aksiyasi')
})

test('customer list is a spreadsheet that cannot run formulas, and needs a login', async ({ page, request }) => {
  expect((await request.get(`${BASE}/api/admin/customers`)).status()).toBe(401)
  expect((await request.get(`${BASE}/api/admin/heat?path=/`)).status()).toBe(401)
  await login(page)
  const r = await page.request.get(`${BASE}/api/admin/customers`)
  expect(r.status()).toBe(200)
  expect(r.headers()['content-type']).toContain('text/csv')
  expect(r.headers()['content-disposition']).toContain('attachment')
  expect(await r.text()).toContain('Telefon,Ism,Buyurtmalar')
})

test('the Telegram webhook accepts nothing without Telegram\'s secret', async ({ request }) => {
  expect((await request.post(`${BASE}/api/telegram`, { data: { message: { text: '/start', chat: { id: 1, type: 'private' } } } })).status()).toBe(401)
  expect((await request.post(`${BASE}/api/telegram`, { headers: { 'x-telegram-bot-api-secret-token': 'guess' }, data: {} })).status()).toBe(401)
})

test('the key file of IndexNow is served only for the saved key', async ({ request }) => {
  expect((await request.get(`${BASE}/indexnow/${'a'.repeat(32)}`)).status()).toBe(404)
})
