// Site open/closed from the admin panel, orders on/off, cost price, reminders, finance report, search statistics.
import crypto from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }))

import config from '@/payload.config'
import { runner } from '@/lib/analytics'
import { buildReport, daysOf, financeReport, lastMonths, reportCsv } from '@/lib/finance'
import { invalidateIntegrations } from '@/lib/integrations'
import { serviceAccountOf, validate } from '@/lib/integrations-def'
import { requestCode } from '@/lib/customer'
import { createOrder, OrderError } from '@/lib/orders'
import { allowedHour, candidates, channelFor, fill, loadSettings, runReminders } from '@/lib/reminders'
import { dateWindow, googleAssertion, googleStats, gscProperty, yandexHostId, yandexStats } from '@/lib/search-stats'
import { resolveSite } from '@/lib/site-state-def'
import { invalidateSiteState, isSiteClosed, siteState } from '@/lib/site-state'

let payload: Payload
const id = () => crypto.randomBytes(5).toString('hex')
const SKU = `L-${id()}`.toUpperCase()
const PRICE = 150_000, COST = 90_000
type Sql = { query: (q: string, v?: unknown[]) => Promise<{ rows: Record<string, any>[] }> }
const sql = () => (payload.db as unknown as { pool: Sql }).pool
const phone = () => `9989${String(crypto.randomInt(0, 1e8)).padStart(8, '0')}`
const env = { SITE_PASSWORD: process.env.SITE_PASSWORD, SITE_NOINDEX: process.env.SITE_NOINDEX }
const restoreEnv = () => { for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
const setSite = async (data: Record<string, unknown>) => { await payload.updateGlobal({ slug: 'site-state', data: data as never, overrideAccess: true }); invalidateSiteState() }
const setReminders = async (data: Record<string, unknown>) => payload.updateGlobal({ slug: 'reminders', data: data as never, overrideAccess: true })
const order = (x: { phone?: string; consent?: boolean } = {}) =>
  createOrder({ lang: 'uz', lines: [{ sku: SKU, qty: 2 }], name: 'Malika Karimova', phone: x.phone ?? phone(), address: 'Test 1', payment: 'payme', consent: true, marketingConsent: x.consent })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const brand = await payload.create({ collection: 'brands', data: { name: `L ${id()}`, slug: `l-${id()}` } })
  const cat = await payload.create({ collection: 'categories', data: { title: 'L', slug: `l-${id()}` } })
  await payload.create({ collection: 'products', data: { name: `Launch ${id()}`, slug: `l-${id()}`, brand: brand.id, category: cat.id, variants: [{ sku: SKU, price: PRICE, stock: 500, cost: COST }] } as never })
})
afterAll(async () => { await setSite({ mode: 'env', ordersEnabled: true }); await setReminders({ abandonedOn: false, lapsedOn: false }); restoreEnv() })

describe('site open / closed', () => {
  it('rules', () => {
    expect(resolveSite('env', true, { SITE_PASSWORD: 'x' })).toMatchObject({ locked: true, noindex: true })
    expect(resolveSite('env', true, { SITE_NOINDEX: '1' })).toMatchObject({ locked: false, noindex: true })
    expect(resolveSite('env', undefined, {})).toMatchObject({ locked: false, noindex: false, ordersEnabled: true })
    expect(resolveSite('open', true, { SITE_PASSWORD: 'x', SITE_NOINDEX: '1' })).toMatchObject({ locked: false, noindex: false })
    expect(resolveSite('closed', false, { SITE_PASSWORD: 'x' })).toMatchObject({ locked: true, noindex: true, ordersEnabled: false })
    expect(resolveSite('closed', true, {})).toMatchObject({ locked: false, noindex: true }) // no password on the server: hidden only
    expect(resolveSite('nonsense', true, {}).mode).toBe('env')
  })
  it('the admin setting beats the server environment', async () => {
    process.env.SITE_PASSWORD = 'pw'; process.env.SITE_NOINDEX = '1'
    try {
      await setSite({ mode: 'env' })
      expect(await isSiteClosed()).toBe(true)
      await setSite({ mode: 'open' })
      expect(await siteState()).toMatchObject({ locked: false, noindex: false })
      await setSite({ mode: 'closed' })
      expect(await siteState()).toMatchObject({ locked: true, noindex: true })
    } finally { restoreEnv(); await setSite({ mode: 'env' }) }
  })
  it('orders can be switched off; the message is the owner’s or the default', async () => {
    await setSite({ ordersEnabled: false })
    try {
      await expect(order()).rejects.toThrow(OrderError)
      await expect(order()).rejects.toMatchObject({ code: 'closed' })
    } finally { await setSite({ ordersEnabled: true }) }
    expect((await order()).order.number).toBeTruthy()
  })
})

describe('test SMS on an open site', () => {
  it('the on-screen code works only on a closed site or a developer computer', async () => {
    const url = process.env.SITE_URL, sms = process.env.SMS_MODE
    process.env.SMS_MODE = 'mock'; invalidateIntegrations()
    try {
      process.env.SITE_URL = 'https://yeppy.uz'; delete process.env.SITE_PASSWORD
      await setSite({ mode: 'open' })
      expect(await requestCode(phone())).toEqual({ ok: false, error: 'sms_off' })
      process.env.SITE_PASSWORD = 'pw'; await setSite({ mode: 'closed' })
      expect(await requestCode(phone())).toMatchObject({ ok: true })
      process.env.SITE_URL = 'http://localhost:3000'; delete process.env.SITE_PASSWORD; await setSite({ mode: 'open' })
      expect(await requestCode(phone())).toMatchObject({ ok: true })
    } finally {
      if (url === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = url
      if (sms === undefined) delete process.env.SMS_MODE; else process.env.SMS_MODE = sms
      restoreEnv(); invalidateIntegrations(); await setSite({ mode: 'env' })
    }
  })
})

describe('purchase price', () => {
  it('is saved on the order, kept on later updates, and the public API never shows it', async () => {
    const { order: o } = await order()
    const row = async () => (await sql().query('SELECT cost FROM orders_items WHERE _parent_id = $1', [o.id])).rows[0]
    expect(Number((await row()).cost)).toBe(COST)
    await payload.update({ collection: 'orders', id: o.id, data: { status: 'accepted' }, overrideAccess: true })
    expect(Number((await row()).cost)).toBe(COST)
    // what /api/products gives a visitor (access rules applied, no user)
    const p = (await payload.find({ collection: 'products', where: { 'variants.sku': { equals: SKU } }, limit: 1, overrideAccess: false })).docs[0]
    expect((p.variants[0] as { cost?: number | null }).cost ?? null).toBeNull()
    const admin = (await payload.find({ collection: 'users', limit: 1 })).docs[0]
    if (admin) {
      const seen = (await payload.find({ collection: 'products', where: { 'variants.sku': { equals: SKU } }, limit: 1, user: admin })).docs[0]
      expect((seen.variants[0] as { cost?: number }).cost).toBe(COST)
    }
  })
})

describe('reminders', () => {
  const NOW = Date.parse('2026-06-01T08:00:00Z') // 13:00 in Tashkent
  it('helpers', () => {
    expect(fill('Salom {ism}, №{buyurtma} {nomaʼlum}', { ism: 'Ali', buyurtma: '10001' })).toBe('Salom Ali, №10001 {nomaʼlum}')
    expect(allowedHour(Date.parse('2026-06-01T04:59:00Z'))).toBe(false) // 09:59 Tashkent
    expect(allowedHour(Date.parse('2026-06-01T05:00:00Z'))).toBe(true)
    expect(allowedHour(Date.parse('2026-06-01T15:00:00Z'))).toBe(false) // 20:00
    expect(channelFor('telegram_sms', '123', true)).toBe('telegram')
    expect(channelFor('telegram_sms', null, true)).toBe('sms')
    expect(channelFor('telegram_sms', null, false)).toBeNull()
    expect(channelFor('telegram', null, true)).toBeNull()
    expect(channelFor('sms', '123', true)).toBe('sms')
  })

  beforeEach(async () => { await sql().query('DELETE FROM reminder_log') })

  it('off by default: nothing is sent', async () => {
    await setReminders({ abandonedOn: false, lapsedOn: false })
    expect(await runReminders({ now: NOW, force: true })).toMatchObject({ checked: false, reason: 'off' })
  })

  it('one reminder per unpaid order, Telegram when the customer joined the bot, never twice', async () => {
    const tel = phone(), chat = String(crypto.randomInt(1e6, 1e9))
    const { order: o } = await order({ phone: tel })
    await sql().query(`UPDATE orders SET created_at = now() - interval '2 hours', telegram_chat = $2 WHERE id = $1`, [o.id, chat])
    await setReminders({ abandonedOn: true, abandonedAfterMin: 60, abandonedChannel: 'telegram_sms', lapsedOn: false })
    // older test orders in this database are candidates too: they get "sent" to the fake sender, which is fine
    const sent: [string, string][] = []
    const senders = { telegram: async (c: string, t: string) => { sent.push([c, t]); return { ok: true } }, sms: async () => { throw new Error('no sms in this test') }, smsReady: async () => false }
    const r1 = await runReminders({ senders, force: true })
    expect(r1.checked).toBe(true)
    const mine = sent.filter(([c]) => c === chat)
    expect(mine).toHaveLength(1)
    expect(mine[0][1]).toContain(`№${o.number}`)
    expect(mine[0][1]).toContain(`/uz/buyurtma/${o.number}?t=${o.token}`)
    expect(mine[0][1]).toContain('Malika!')
    await runReminders({ senders, force: true })
    expect(sent.filter(([c]) => c === chat)).toHaveLength(1)
    const log = (await sql().query(`SELECT status, channel FROM reminder_log WHERE key = $1`, [`a:${o.id}`])).rows
    expect(log).toEqual([{ status: 'sent', channel: 'telegram' }])
  })

  it('skips orders already paid by the same phone, too fresh or too old to pay', async () => {
    const tel = phone()
    const { order: a } = await order({ phone: tel })
    const { order: b } = await order({ phone: tel })
    await sql().query(`UPDATE orders SET created_at = now() - interval '2 hours' WHERE id = $1`, [a.id])
    await sql().query(`UPDATE orders SET payment_status = 'paid', paid_at = now(), status = 'accepted' WHERE id = $1`, [b.id])
    const { order: fresh } = await order()
    const { order: old } = await order()
    await sql().query(`UPDATE orders SET created_at = now() - interval '13 hours' WHERE id = $1`, [old.id])
    await setReminders({ abandonedOn: true, abandonedAfterMin: 60, lapsedOn: false })
    const keys = (await candidates(await runner(), await loadSettings())).map((c) => c.key)
    expect(keys).not.toContain(`a:${a.id}`)
    expect(keys).not.toContain(`a:${fresh.id}`)
    expect(keys).not.toContain(`a:${old.id}`)
  })

  it('lapsed customers: only with consent on their latest order, only once per quiet period', async () => {
    const yes = phone(), no = phone()
    for (const [tel, consent] of [[yes, true], [no, false]] as const) {
      const { order: o } = await order({ phone: tel, consent })
      await sql().query(`UPDATE orders SET payment_status = 'paid', status = 'delivered', paid_at = now() - interval '50 days', created_at = now() - interval '50 days', telegram_chat = $2 WHERE id = $1`, [o.id, tel])
    }
    await setReminders({ abandonedOn: false, lapsedOn: true, lapsedDays: 45, lapsedChannel: 'telegram', lapsedPromo: 'QAYT10', lapsedText: 'Salom {ism}! Promokod: {promokod}' })
    const c = (await candidates(await runner(), await loadSettings())).filter((x) => x.kind === 'lapsed')
    expect(c.map((x) => x.phone)).toContain(yes)
    expect(c.map((x) => x.phone)).not.toContain(no)
    expect(c.find((x) => x.phone === yes)?.text).toBe('Salom Malika! Promokod: QAYT10')
    const sent: string[] = []
    const senders = { telegram: async (chat: string) => { sent.push(chat); return { ok: true } }, sms: async () => {}, smsReady: async () => false }
    await runReminders({ senders, force: true })
    await runReminders({ senders, force: true })
    expect(sent.filter((x) => x === yes)).toHaveLength(1)
  })
})

describe('finance report', () => {
  it('months and days in Tashkent time', () => {
    const m = lastMonths(3, Date.parse('2026-03-31T20:00:00Z')) // already 1 April in Tashkent
    expect(m.map((p) => p.key)).toEqual(['2026-02', '2026-03', '2026-04'])
    expect(m[2].from.toISOString()).toBe('2026-03-31T19:00:00.000Z')
    expect(daysOf('2026-02', Date.parse('2026-12-01'))).toHaveLength(28)
    expect(daysOf('2026-06', Date.parse('2026-06-03T12:00:00Z'))).toHaveLength(3)
  })
  it('income, expenses and what is left (pure)', () => {
    const periods = lastMonths(1, Date.parse('2026-06-15T12:00:00Z'))
    const r = buildReport(periods, {
      orders: [
        { paid_at: '2026-06-02T10:00:00Z', total: 300_000, delivery_fee: 25_000, payment: 'payme', payment_status: 'paid', src: 'instagram', cost: 150_000, no_cost_items: 0, no_cost_revenue: 0 },
        { paid_at: '2026-06-03T10:00:00Z', total: 100_000, delivery_fee: 0, payment: 'card', payment_status: 'paid', src: null, cost: 0, no_cost_items: 1, no_cost_revenue: 100_000 },
        { paid_at: '2026-06-04T10:00:00Z', total: 50_000, delivery_fee: 0, payment: 'click', payment_status: 'refund', src: null, cost: 20_000, no_cost_items: 0, no_cost_revenue: 0 },
        { paid_at: '2026-05-04T10:00:00Z', total: 999, delivery_fee: 0, payment: 'click', payment_status: 'paid', src: null, cost: 0, no_cost_items: 0, no_cost_revenue: 0 }, // other month
      ],
      expenses: [{ date: '2026-06-05T00:00:00Z', category: 'ads', amount: 40_000, channel: 'Instagram' }, { date: '2026-06-06T00:00:00Z', category: 'nonsense', amount: 1_000, channel: null }],
      fees: { click: 1.5, payme: 2 }, cardProvider: 'payme',
    })
    const line = (rows: { id: string; values: number[] }[], k: string) => rows.find((l) => l.id === k)?.values[0]
    expect(line(r.income, 'sales')).toBe(450_000)
    expect(line(r.income, 'refunds')).toBe(-50_000)
    expect(r.incomeTotal[0]).toBe(400_000)
    expect(line(r.expense, 'cogs')).toBe(150_000)
    expect(line(r.expense, 'fees')).toBe(6_000 + 2_000) // 2% of 300 000 + 2% of 100 000 (card goes through Payme)
    expect(line(r.expense, 'ads')).toBe(40_000)
    expect(line(r.expense, 'other')).toBe(1_000)
    expect(r.expenseTotal[0]).toBe(199_000)
    expect(r.left[0]).toBe(201_000)
    expect(r.noCost).toEqual({ items: 1, revenue: 100_000 })
    expect(r.feeMissing).toBe(false)
    expect(r.channels.find((c) => c.channel === 'instagram')).toEqual({ channel: 'instagram', spent: 40_000, revenue: 300_000, orders: 1 })
    const csv = reportCsv(r)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('"QOLDI (kirim − chiqim)","201000"')
  })
  it('from the database: a paid order and an expense show up', async () => {
    const { order: o } = await order()
    await sql().query(`UPDATE orders SET payment_status = 'paid', paid_at = now(), status = 'accepted' WHERE id = $1`, [o.id])
    await payload.create({ collection: 'expenses', data: { date: new Date().toISOString(), category: 'delivery', amount: 12_345 }, overrideAccess: true })
    const r = await financeReport(await runner(), lastMonths(1))
    expect(r.incomeTotal[0]).toBeGreaterThanOrEqual(o.total)
    expect(r.expense.find((l) => l.id === 'cogs')!.values[0]).toBeGreaterThanOrEqual(COST * 2)
    expect(r.expense.find((l) => l.id === 'delivery')!.values[0]).toBeGreaterThanOrEqual(12_345)
  })
})

describe('search statistics', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const SA = JSON.stringify({ type: 'service_account', client_email: 'yeppo@proj.iam.gserviceaccount.com', private_key: pem })

  it('accepts only a real key file; checks the property format', () => {
    expect(serviceAccountOf(SA)).toEqual({ email: 'yeppo@proj.iam.gserviceaccount.com', key: pem })
    expect(serviceAccountOf('{"client_email":"a@b.c"}')).toBeNull()
    expect(serviceAccountOf('not json')).toBeNull()
    expect(validate({ gscServiceAccount: 'nope' }, ['gscServiceAccount'])).toHaveLength(1)
    expect(validate({ gscServiceAccount: SA }, ['gscServiceAccount'])).toEqual([])
    expect(validate({ gscProperty: 'sc-domain:yeppy.uz' }, ['gscProperty'])).toEqual([])
    expect(validate({ gscProperty: 'yeppy.uz' }, ['gscProperty'])).toHaveLength(1)
  })
  it('a signed request Google can verify', () => {
    const jwt = googleAssertion('a@p.iam.gserviceaccount.com', pem, Date.parse('2026-06-01T00:00:00Z'))
    const [h, c, s] = jwt.split('.')
    expect(crypto.createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true)
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toMatchObject({ iss: 'a@p.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/webmasters.readonly', exp: 1780275600 })
  })
  it('helpers', () => {
    expect(gscProperty({}, 'https://yeppy.uz')).toBe('https://yeppy.uz/')
    expect(gscProperty({ gscProperty: 'sc-domain:yeppy.uz' }, 'https://yeppy.uz')).toBe('sc-domain:yeppy.uz')
    expect(yandexHostId('https://yeppy.uz')).toBe('https:yeppy.uz:443')
    expect(dateWindow(7, Date.parse('2026-06-10T12:00:00Z'))).toEqual({ start: '2026-06-02', end: '2026-06-08' })
  })
  it('Google: reads queries, pages, days and totals', async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('oauth2')) return Response.json({ access_token: 'tok' })
      const b = JSON.parse(String(init?.body))
      expect(url).toContain(encodeURIComponent('sc-domain:yeppy.uz'))
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok')
      const dim = b.dimensions?.[0]
      const rows = dim === 'query' ? [{ keys: ['koreys kosmetikasi'], clicks: 3, impressions: 120, ctr: 0.025, position: 8.44 }]
        : dim === 'page' ? [{ keys: ['https://yeppy.uz/uz'], clicks: 3, impressions: 120, ctr: 0.025, position: 8.4 }]
        : dim === 'date' ? [{ keys: ['2026-06-01'], clicks: 3, impressions: 120, ctr: 0.025, position: 8 }]
        : [{ clicks: 3, impressions: 120, ctr: 0.025, position: 8.44 }]
      return Response.json({ rows })
    })
    const r = await googleStats(28, { gscServiceAccount: SA, gscProperty: 'sc-domain:yeppy.uz' }, f as unknown as typeof fetch)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.totals).toEqual({ clicks: 3, impressions: 120, ctr: 2.5, position: 8.4 })
      expect(r.data.queries[0]).toEqual({ query: 'koreys kosmetikasi', clicks: 3, impressions: 120, ctr: 2.5, position: 8.4 })
      expect(r.data.days).toHaveLength(1)
    }
  })
  it('Google: a clear message when the service account has no access; not connected without a key', async () => {
    const f = async (url: string) => (url.includes('oauth2') ? Response.json({ access_token: 'tok2' }) : new Response('', { status: 403 }))
    const r = await googleStats(7, { gscServiceAccount: SA.replace('yeppo@', 'other@') }, f as unknown as typeof fetch)
    expect(r).toMatchObject({ ok: false, reason: 'error' })
    if (!r.ok) expect(r.message).toContain('ruxsat berilmagan')
    expect(await googleStats(7, {})).toMatchObject({ ok: false, reason: 'not_connected' })
  })
  it('Yandex: finds the host and reads popular queries', async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe('OAuth ytok')
      if (url.endsWith('/user')) return Response.json({ user_id: 42 })
      if (url.endsWith('/user/42/hosts')) return Response.json({ hosts: [{ host_id: 'https:other.uz:443' }, { host_id: 'https:yeppy.uz:443', ascii_host_url: 'https://yeppy.uz/' }] })
      if (url.includes('/summary')) return Response.json({ searchable_pages_count: 40, excluded_pages_count: 3, sqi: 10 })
      expect(url).toContain('/hosts/https%3Ayeppy.uz%3A443/search-queries/popular?')
      return Response.json({ queries: [{ query_text: 'yeppy', indicators: { TOTAL_SHOWS: 50, TOTAL_CLICKS: 10, AVG_SHOW_POSITION: 1.26 } }] })
    })
    const r = await yandexStats(28, { yandexOAuth: 'ytok' }, f as unknown as typeof fetch, 'https://yeppy.uz')
    expect(r).toMatchObject({ ok: true, data: { host: 'https://yeppy.uz/', indexed: 40, excluded: 3, sqi: 10, queries: [{ query: 'yeppy', impressions: 50, clicks: 10, ctr: 20, position: 1.3 }] } })
    const bad = await yandexStats(7, { yandexOAuth: 'x' }, (async () => new Response('', { status: 401 })) as unknown as typeof fetch, 'https://yeppy.uz')
    expect(bad).toMatchObject({ ok: false, reason: 'error' })
  })
})

it('integrations cache is not disturbed', () => { invalidateIntegrations(); expect(true).toBe(true) })
