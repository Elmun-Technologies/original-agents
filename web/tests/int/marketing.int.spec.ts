import { getPayload, type Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }))

import config from '@/payload.config'
import { runner, type Run } from '@/lib/analytics'
import { abandonedOrders, csvCell, customers, promoResults, segmentsOf, toCsv, trackedLink } from '@/lib/marketing'
import { buildAudit } from '@/lib/seo-audit'
import { buildChecklist, type Facts } from '@/lib/readiness'

const DAY = 86_400_000
const NOW = Date.parse('2026-06-01T10:00:00Z')

describe('customer groups', () => {
  const c = (orders: number, spent: number, daysAgo: number) => ({ orders, spent, last: new Date(NOW - daysAgo * DAY).toISOString() })
  it('who belongs where', () => {
    expect(segmentsOf(c(1, 100_000, 5), NOW)).toEqual(['new'])
    expect(segmentsOf(c(1, 100_000, 60), NOW)).toEqual(['lapsed', 'once'])
    expect(segmentsOf(c(4, 900_000, 10), NOW)).toEqual(['repeat'])
    expect(segmentsOf(c(2, 2_000_000, 100), NOW)).toEqual(['vip', 'lapsed'])
    expect(segmentsOf(c(1, 50_000, 40), NOW)).toEqual([]) // between "new" and "lapsed"
  })
})

describe('the spreadsheet', () => {
  it('a cell can never run as a formula or break the row', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`)
    expect(csvCell('+998901234567')).toBe(`"'+998901234567"`)
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
    expect(csvCell('a,"b"\nc')).toBe('"a,""b"" c"')
    expect(csvCell(null)).toBe('""')
  })
  it('has a header, a BOM for Excel and one line per customer', () => {
    const csv = toCsv([{ phone: '998901234567', name: 'Ali', orders: 2, spent: 500000, first: '2026-01-01T00:00:00Z', last: '2026-02-01T00:00:00Z', segments: ['lapsed'] }])
    expect(csv.startsWith('﻿Telefon,')).toBe(true)
    expect(csv.split('\r\n')).toHaveLength(2)
    expect(csv).toContain('"998901234567","Ali","2","500000","2026-01-01","2026-02-01","Qaytmagan"')
  })
})

describe('tracked links', () => {
  it('plain lower-case words only', () => {
    expect(trackedLink('https://yeppo.uz/', '/uz', { source: 'Instagram', medium: 'Story', campaign: 'Qish 2026!' })).toBe('https://yeppo.uz/uz?utm_source=instagram&utm_medium=story&utm_campaign=qish-2026')
    expect(trackedLink('https://yeppo.uz', 'uz/katalog/serum', { source: '', medium: '', campaign: '' })).toBe('https://yeppo.uz/uz/katalog/serum')
    expect(trackedLink('https://yeppo.uz', '/uz', { source: '<script>alert(1)', medium: 'a b', campaign: 'x' })).not.toContain('<')
  })
})

describe('with orders in the database', () => {
  let payload: Payload, run: Run
  beforeAll(async () => { payload = await getPayload({ config: await config }); run = await runner() })
  beforeEach(async () => { for (const t of ['payments', 'orders_items', 'orders']) await run(`DELETE FROM ${t}`) })
  const order = (o: { phone: string; total: number; paymentStatus: 'pending' | 'paid' | 'cancelled'; hoursAgo?: number; paidDaysAgo?: number; discount?: number; label?: string; status?: 'new' | 'accepted' }) =>
    payload.create({ collection: 'orders', overrideAccess: true, data: {
      number: 'T' + Math.random().toString(16).slice(2, 10), token: 't'.repeat(32), status: o.status ?? (o.paymentStatus === 'paid' ? 'accepted' : 'new'), paymentStatus: o.paymentStatus, payment: 'click', name: 'Ali', phone: o.phone,
      delivery: 'tashkent', address: 'x', items: [{ sku: 'S', name: 'Serum', price: o.total, qty: 1 }], subtotal: o.total, total: o.total, discount: o.discount ?? 0, discountLabel: o.label,
      paidAt: o.paymentStatus === 'paid' ? new Date(Date.now() - (o.paidDaysAgo ?? 1) * DAY).toISOString() : undefined, src: 'instagram', cmp: 'qish',
    } }).then(async (d) => { if (o.hoursAgo !== undefined) await run('UPDATE orders SET created_at = now() - ($2 || \' hours\')::interval WHERE id = $1', [d.id, String(o.hoursAgo)]); return d })

  it('unfinished orders: not the very fresh ones, not the paid, link only inside the payment window', async () => {
    await order({ phone: '998901111111', total: 100000, paymentStatus: 'pending', hoursAgo: 0.05 }) // 3 minutes: the customer is still paying
    const a = await order({ phone: '998902222222', total: 200000, paymentStatus: 'pending', hoursAgo: 2 })
    const b = await order({ phone: '998903333333', total: 300000, paymentStatus: 'cancelled', hoursAgo: 30 })
    await order({ phone: '998904444444', total: 400000, paymentStatus: 'paid', hoursAgo: 5 })
    await order({ phone: '998905555555', total: 500000, paymentStatus: 'pending', hoursAgo: 5, status: 'accepted' }) // cancelled by the shop's flow: not "unfinished"
    const rows = await abandonedOrders()
    expect(rows.map((r) => r.phone).sort()).toEqual(['998902222222', '998903333333'])
    expect(rows.find((r) => r.id === a.id)!.link).toMatch(/^\/uz\/buyurtma\/[^/]+\?t=t+$/)
    expect(rows.find((r) => r.id === b.id)!.link).toBeNull() // 30 h: expired, it must be a new order
    expect(rows[0]).toMatchObject({ items: 'Serum', src: 'instagram / qish' })
  })

  it('customers: totals per phone and their groups', async () => {
    await order({ phone: '998901111111', total: 1_000_000, paymentStatus: 'paid', paidDaysAgo: 100 })
    await order({ phone: '998901111111', total: 700_000, paymentStatus: 'paid', paidDaysAgo: 80 })
    await order({ phone: '998902222222', total: 100_000, paymentStatus: 'paid', paidDaysAgo: 3 })
    await order({ phone: '998903333333', total: 999, paymentStatus: 'pending' }) // never paid: not a customer
    const list = await customers(run)
    expect(list).toHaveLength(2)
    const a = list.find((c) => c.phone === '998901111111')!
    expect(a).toMatchObject({ orders: 2, spent: 1_700_000 }); expect(a.segments).toEqual(['vip', 'lapsed'])
    expect(list.find((c) => c.phone === '998902222222')!.segments).toEqual(['new'])
  })

  it('promo codes: how many orders, how much given away', async () => {
    await order({ phone: '998901111111', total: 90_000, discount: 10_000, label: 'SALOM10', paymentStatus: 'paid' })
    await order({ phone: '998902222222', total: 180_000, discount: 20_000, label: 'SALOM10', paymentStatus: 'paid' })
    await order({ phone: '998903333333', total: 50_000, discount: 5_000, label: 'routine', paymentStatus: 'paid' })
    const r = await promoResults(run, new Date(Date.now() - 7 * DAY), new Date(Date.now() + DAY))
    expect(r[0]).toEqual({ code: 'SALOM10', orders: 2, discount: 30_000, revenue: 270_000 })
  })
})

describe('SEO audit', () => {
  const good = { id: 1, name: 'A', hasDescription: true, hasSummary: true, images: 2, price: 100, hasRuText: true, hasBatch: true, hasSeoDescription: true }
  const site = { closed: false, https: true, ownDomain: true, google: true, yandex: true, analytics: true, indexNow: true }
  const base = { products: [good], articles: [], categories: [], brands: [], site }
  it('a complete site scores 100 with no problems', () => {
    const a = buildAudit(base)
    expect(a.score).toBe(100); expect(a.problems).toBe(0)
  })
  it('finds what is missing and links to the page that fixes it', () => {
    const a = buildAudit({ ...base, products: [good, { ...good, id: 2, name: 'B', hasDescription: false, images: 0, price: 0 }], site: { ...site, closed: true, google: false } })
    const f = (id: string) => a.findings.find((x) => x.id === id)!
    expect(f('desc').items).toEqual([{ label: 'B', href: '/admin/collections/products/2' }])
    expect(f('noimg').items).toHaveLength(1); expect(f('price0').items).toHaveLength(1)
    expect(f('closed').items).toHaveLength(1); expect(f('google').items).toHaveLength(1); expect(f('yandex').items).toHaveLength(0)
    expect(a.score).toBeLessThan(80)
    expect(a.findings[0].items.length).toBeGreaterThan(0) // problems first
  })
})

describe('launch checklist', () => {
  const ready: Facts = {
    closed: false, https: true, ownDomain: true, paymentsLive: true, clickReady: false, paymeReady: true, cardProvider: 'payme', smsLive: true, eskizReady: true, telegramReady: true, secretsUnreadable: 0,
    google: true, yandex: true, ga4: true, metrica: false, meta: false, indexNow: true, contacts: { phone: true, telegramUrl: true, telegramBot: true }, legal: { oferta: true, maxfiylik: true },
    products: { real: 20, sample: 0, noStock: 0, noBatch: 0 }, admins: 1, trackerEvents: 50,
  }
  it('everything the owner must do is listed; the two things only a person can confirm stay manual', () => {
    const r = buildChecklist(ready)
    expect(r.blockers).toBe(0)
    expect(r.checks.filter((c) => c.status === 'manual').map((c) => c.id).sort()).toEqual(['backup', 'e2e'])
    expect(r.done).toBe(r.total - 2)
  })
  it('a fresh test site: every blocker is named', () => {
    const r = buildChecklist({ ...ready, closed: true, ownDomain: false, https: false, paymentsLive: false, paymeReady: false, smsLive: false, eskizReady: false, telegramReady: false, google: false,
      legal: { oferta: false, maxfiylik: false }, products: { real: 0, sample: 12, noStock: 0, noBatch: 0 }, contacts: { phone: false, telegramUrl: false, telegramBot: false } })
    const todo = r.checks.filter((c) => c.status === 'todo').map((c) => c.id)
    for (const id of ['domain', 'https', 'open', 'pay-keys', 'pay-live', 'sms', 'tg', 'oferta', 'privacy', 'contacts', 'products']) expect(todo, id).toContain(id)
    expect(r.checks.find((c) => c.id === 'products')!.detail).toContain('12 ta NAMUNA')
    expect(r.checks.find((c) => c.id === 'contacts')!.detail).toContain('telefon')
    expect(r.checks.every((c) => !c.must || c.steps?.length || c.status === 'ok' || c.id === 'secrets')).toBe(true) // each blocker says what to do
    expect(r.checks[0].must).toBe(true) // required first
    expect(r.checks.filter((c) => !c.must).every((c) => c.status !== 'todo')).toBe(true) // recommendations are never blockers
    expect(r.checks.find((c) => c.id === 'stock')!.detail).toContain('Avval haqiqiy')
  })
  it('the card provider decides which keys count', () => {
    expect(buildChecklist({ ...ready, cardProvider: 'click', clickReady: false, paymeReady: true }).checks.find((c) => c.id === 'pay-keys')!.status).toBe('todo')
    expect(buildChecklist({ ...ready, cardProvider: 'click', clickReady: true, paymeReady: false }).checks.find((c) => c.id === 'pay-keys')!.status).toBe('ok')
  })
})
