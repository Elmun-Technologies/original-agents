import { getPayload, type Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }))

import config from '@/payload.config'
import * as A from '@/lib/analytics'
import { cleanPath, isBot, makeLimiter, parseBatch, readCookies } from '@/lib/analytics-ingest'
import { purgeOldEvents, recordEvents } from '@/lib/analytics-record'
import { sourceOf } from '@/lib/track-client'

const V = 'a'.repeat(16), S = 'b'.repeat(16)
const ev = (o: Record<string, unknown>) => ({ n: 'pageview', p: '/uz', ...o })
const batch = (e: unknown[], extra: Record<string, unknown> = {}) => ({ v: V, s: S, d: 'mobile', a: { s: 'instagram', m: 'social', c: 'qish' }, e, ...extra })

describe('what the collector accepts', () => {
  it('keeps clean events and fills the dimensions', () => {
    const [r] = parseBatch(batch([ev({ p: '/ru/mahsulot/skin1004-ampoule' })], { r: 'l.instagram.com' }))
    expect(r).toMatchObject({ name: 'pageview', path: '/ru/mahsulot/skin1004-ampoule', lang: 'ru', device: 'mobile', ref: 'l.instagram.com', src: 'instagram', med: 'social', cmp: 'qish', data: null })
  })
  it('drops everything that is not a site page: admin, api, other hosts, queries', () => {
    expect(parseBatch(batch([ev({ p: '/admin' }), ev({ p: '/api/t' }), ev({ p: 'https://evil.test/uz' }), ev({ p: '/uz/../admin' }), ev({ p: '/de/mahsulot/x' })]))).toEqual([])
    expect(cleanPath('/uz/qidiruv?q=krem#x')).toBe('/uz/qidiruv') // the query never reaches the database
    expect(cleanPath('/uz/buyurtma/10001?t=SECRET')).toBe('/uz/buyurtma') // an order link carries a secret
    expect(cleanPath('/uz/tolov/sinov')).toBe('/uz/tolov')
    expect(cleanPath('/uz/katalog/serum/')).toBe('/uz/katalog/serum')
  })
  it('refuses unknown event names, bad ids and oversized batches', () => {
    expect(parseBatch(batch([{ n: 'purchase', p: '/uz', value: 9e9 }, { n: 'drop table', p: '/uz' }]))).toEqual([]) // purchases come from the server only
    expect(parseBatch({ ...batch([ev({})]), v: 'not-hex' })).toEqual([])
    expect(parseBatch({ ...batch([ev({})]), s: undefined })).toEqual([])
    expect(parseBatch(null)).toEqual([]); expect(parseBatch('x')).toEqual([]); expect(parseBatch({ v: V, s: S, e: 'x' })).toEqual([])
    expect(parseBatch(batch(Array.from({ length: 100 }, () => ev({})))).length).toBe(40)
  })
  it('whitelists the data of each event and cuts it', () => {
    const [c] = parseBatch(batch([{ n: 'click', p: '/uz', x: 0.5234567, y: 812.4, w: 1440, h: 5000, t: '<b>a:/uz/savat</b>', name: 'Malika', phone: '998901234567' }]))
    expect(c.data).toEqual({ x: 0.5235, y: 812, w: 1440, h: 5000, t: 'b a:/uz/savat /b' })
    expect(JSON.stringify(c.data)).not.toMatch(/Malika|998901234567|[<>]/) // personal fields never pass
    expect(parseBatch(batch([{ n: 'click', p: '/uz', x: 5, y: 1, w: 1440 }]))).toEqual([]) // x outside the page
    expect(parseBatch(batch([{ n: 'scroll', p: '/uz', depth: 250 }]))[0].data).toEqual({ depth: 100 })
    expect(parseBatch(batch([{ n: 'vitals', p: '/uz', lcp: 1800.4, cls: 0.0123456, inp: 120, junk: 1 }]))[0].data).toEqual({ lcp: 1800, cls: 0.012, inp: 120 })
    expect(parseBatch(batch([{ n: 'vitals', p: '/uz' }]))).toEqual([])
    expect(parseBatch(batch([{ n: 'add_to_cart', p: '/uz', sku: 'Y-AMP', slug: 'amp', price: 245000, qty: 2, email: 'a@b.c' }]))[0].data).toEqual({ sku: 'Y-AMP', slug: 'amp', price: 245000, qty: 2 })
  })
  it('source labels are plain text only', () => {
    const [r] = parseBatch(batch([ev({})], { a: { s: '<script>alert(1)</script>', m: 'x'.repeat(80), c: 'Qish 2026' } }))
    expect(r.src).toBeNull(); expect(r.med).toBeNull(); expect(r.cmp).toBe('qish 2026')
  })
  it('recognises robots and the admin cookie', () => {
    for (const ua of ['Googlebot/2.1', 'Mozilla/5.0 (compatible; YandexBot/3.0)', 'facebookexternalhit/1.1', 'Lighthouse', '', null]) expect(isBot(ua), String(ua)).toBe(true)
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile Safari')).toBe(false)
    expect(readCookies('a=1; payload-token=abc').hasAdmin).toBe(true)
    expect(readCookies('yp_v=' + V).hasAdmin).toBe(false)
  })
  it('reads the order attribution from cookies and refuses a forged one', () => {
    const ok = readCookies(`yp_v=${V}; yp_s=${S}; yp_a=${encodeURIComponent(JSON.stringify({ s: 'instagram', m: 'social', c: 'qish', l: '/uz/katalog/serum' }))}`)
    expect(ok).toMatchObject({ visitor: V, session: S, src: 'instagram', med: 'social', cmp: 'qish', landing: '/uz/katalog/serum' })
    const bad = readCookies(`yp_v=zz; yp_a=${encodeURIComponent(JSON.stringify({ s: '<x>', l: 'https://evil' }))}`)
    expect(bad).toMatchObject({ visitor: null, src: null, landing: null })
    expect(readCookies('yp_a=%7Bbroken').src).toBeNull()
  })
  it('limits one address', () => {
    const allow = makeLimiter(5, 1000)
    expect([1, 2, 3, 4, 5].every(() => allow('ip', 1, 0))).toBe(true)
    expect(allow('ip', 1, 10)).toBe(false)
    expect(allow('other', 1, 10)).toBe(true)
    expect(allow('ip', 1, 2000)).toBe(true) // the window passed
  })
})

describe('where a visit came from (browser)', () => {
  const u = (s: string) => new URL('https://yeppo.uz' + s)
  it('utm wins, then the referring site, own site and direct are not a source', () => {
    expect(sourceOf(u('/uz?utm_source=Instagram&utm_medium=Story&utm_campaign=Qish'), 'https://l.instagram.com/')).toEqual({ s: 'instagram', m: 'story', c: 'qish' })
    expect(sourceOf(u('/uz'), 'https://l.instagram.com/')).toEqual({ s: 'instagram', m: 'social' })
    expect(sourceOf(u('/uz'), 'https://t.me/yeppo')).toEqual({ s: 'telegram', m: 'social' })
    expect(sourceOf(u('/uz'), 'https://www.google.com/')).toEqual({ s: 'google', m: 'organic' })
    expect(sourceOf(u('/uz'), 'https://yandex.ru/search')).toEqual({ s: 'yandex', m: 'organic' })
    expect(sourceOf(u('/uz'), 'https://blog.example.org/post')).toEqual({ s: 'blog.example.org', m: 'referral' })
    expect(sourceOf(u('/uz'), 'https://www.yeppo.uz/ru')).toBeNull()
    expect(sourceOf(u('/uz'), '')).toBeNull()
  })
})

let payload: Payload
let run: A.Run
const DAYS = 86_400_000
const now = new Date()
const at = (daysAgo: number, hour = 12) => new Date(now.getTime() - daysAgo * DAYS + (hour - 12) * 3_600_000)
const range: A.Range = { from: new Date(now.getTime() - 7 * DAYS), to: new Date(now.getTime() + 3_600_000) }

/** an event with a chosen timestamp */
async function put(name: string, o: { s: string; v?: string; path?: string; device?: string; src?: string | null; med?: string | null; cmp?: string | null; data?: Record<string, unknown>; when?: Date }) {
  await recordEvents([{ name, visitor: o.v ?? o.s, session: o.s, path: o.path ?? '/uz', lang: 'uz', device: o.device ?? 'mobile', ref: null, src: o.src ?? null, med: o.med ?? null, cmp: o.cmp ?? null, data: o.data ?? null }])
  if (o.when) await run('UPDATE analytics_events SET created_at = $1 WHERE id = (SELECT max(id) FROM analytics_events)', [o.when])
}
const sess = (c: string) => c.repeat(16)


async function paidOrder(o: { total: number; src?: string; cmp?: string; slug?: string; qty?: number; paidAt?: Date }) {
  const d = await payload.create({ collection: 'orders', overrideAccess: true, data: {
    number: 'T' + Math.random().toString(16).slice(2, 10), token: 'x'.repeat(32), status: 'accepted', paymentStatus: 'paid', payment: 'click', name: 'Test', phone: '998901234567', delivery: 'tashkent', address: 'x',
    items: [{ sku: 'S1', slug: o.slug ?? 'amp', name: 'Amp', price: o.total, qty: o.qty ?? 1 }], subtotal: o.total, total: o.total, paidAt: (o.paidAt ?? now).toISOString(), src: o.src, med: o.src ? 'social' : undefined, cmp: o.cmp } })
  return d
}

describe('reports on real rows', () => {
  beforeAll(async () => { payload = await getPayload({ config: await config }); run = await A.runner() })
  beforeEach(async () => { for (const t of ['analytics_events', 'payments', 'orders_items', 'orders']) await run(`DELETE FROM ${t}`) })

  it('overview: visitors, sessions, page views, orders, revenue, conversion', async () => {
    await put('pageview', { s: sess('1'), v: sess('a') }); await put('pageview', { s: sess('1'), v: sess('a'), path: '/uz/katalog/serum' })
    await put('pageview', { s: sess('2'), v: sess('a') }) // same visitor, second session
    await put('pageview', { s: sess('3'), v: sess('b') }); await put('pageview', { s: sess('4'), v: sess('c') })
    await put('pageview', { s: sess('9'), v: sess('z'), when: at(30) }) // outside the range
    await paidOrder({ total: 300000 }); await paidOrder({ total: 100000 })
    const o = await A.overview(run, range)
    expect(o).toMatchObject({ visitors: 3, sessions: 4, pageviews: 5, paid: 2, revenue: 400000, aov: 200000 })
    expect(o.conversion).toBeCloseTo(0.5)
  })
  it('daily: one row per day, empty days included', async () => {
    await put('pageview', { s: sess('1'), when: at(2) }); await put('pageview', { s: sess('2'), when: at(2) }); await put('pageview', { s: sess('3'), when: at(0) })
    await paidOrder({ total: 50000, paidAt: at(2) })
    const d = await A.daily(run, range)
    expect(d.length).toBeGreaterThanOrEqual(7)
    expect(d.reduce((a, x) => a + x.sessions, 0)).toBe(3)
    expect(d.reduce((a, x) => a + x.revenue, 0)).toBe(50000)
    expect(d.filter((x) => x.sessions === 0).length).toBeGreaterThan(3)
  })
  it('funnel counts sessions, not events', async () => {
    for (const s of ['1', '2', '3', '4']) await put('pageview', { s: sess(s) })
    for (const s of ['1', '2', '3']) { await put('pageview', { s: sess(s), path: '/uz/mahsulot/amp' }); await put('pageview', { s: sess(s), path: '/ru/mahsulot/toner' }) }
    for (const s of ['1', '2']) { await put('add_to_cart', { s: sess(s), data: { sku: 'S1', slug: 'amp', qty: 1 } }); await put('add_to_cart', { s: sess(s), data: { sku: 'S2', slug: 'toner', qty: 1 } }) }
    await put('pageview', { s: sess('1'), path: '/uz/rasmiylashtirish' }); await put('order_created', { s: sess('1') }); await put('purchase', { s: sess('1') })
    expect(await A.funnel(run, range)).toEqual({ visit: 4, product: 3, cart: 2, checkout: 1, ordered: 1, paid: 1 })
  })
  it('sources: sessions from events, orders and revenue from the orders themselves', async () => {
    await put('pageview', { s: sess('1'), src: 'instagram', med: 'social', cmp: 'qish' }); await put('pageview', { s: sess('1'), src: 'instagram', med: 'social', cmp: 'qish' })
    await put('pageview', { s: sess('2'), src: 'instagram', med: 'social', cmp: 'qish' }); await put('pageview', { s: sess('3') }); await put('pageview', { s: sess('4'), src: 'google', med: 'organic' })
    await paidOrder({ total: 250000, src: 'instagram', cmp: 'qish' })
    const s = await A.sources(run, range)
    expect(s[0]).toMatchObject({ src: 'instagram', cmp: 'qish', sessions: 2, orders: 1, revenue: 250000 })
    expect(s.find((x) => x.src === A.DIRECT)).toMatchObject({ sessions: 1, orders: 0 })
    expect(s.find((x) => x.src === 'google')).toMatchObject({ sessions: 1 })
  })
  it('pages: language-free paths with views, visitors and scroll depth', async () => {
    await put('pageview', { s: sess('1'), path: '/uz/katalog/serum' }); await put('pageview', { s: sess('2'), path: '/ru/katalog/serum' }); await put('pageview', { s: sess('3'), path: '/uz' })
    await put('scroll', { s: sess('1'), path: '/uz/katalog/serum', data: { depth: 50 } }); await put('scroll', { s: sess('2'), path: '/ru/katalog/serum', data: { depth: 100 } })
    const p = await A.pages(run, range)
    expect(p[0]).toEqual({ path: '/katalog/serum', views: 2, visitors: 2, depth: 75 })
    expect(p.find((x) => x.path === '/')).toMatchObject({ views: 1, depth: null })
  })
  it('products: views, carts, units and revenue per product', async () => {
    await put('pageview', { s: sess('1'), path: '/uz/mahsulot/amp' }); await put('pageview', { s: sess('2'), path: '/ru/mahsulot/amp' }); await put('pageview', { s: sess('2'), path: '/uz/mahsulot/toner' })
    await put('add_to_cart', { s: sess('1'), data: { sku: 'S1', slug: 'amp', qty: 2 } })
    await paidOrder({ total: 245000, slug: 'amp', qty: 1 })
    const p = await A.products(run, range)
    expect(p[0]).toMatchObject({ slug: 'amp', views: 2, carts: 2, sold: 1, revenue: 245000 })
    expect(p.find((x) => x.slug === 'toner')).toMatchObject({ views: 1, carts: 0, sold: 0 })
  })
  it('devices and speed (75th percentile)', async () => {
    await put('pageview', { s: sess('1'), device: 'mobile' }); await put('pageview', { s: sess('2'), device: 'mobile' }); await put('pageview', { s: sess('3'), device: 'desktop' })
    expect((await A.devices(run, range)).device).toEqual([{ key: 'mobile', sessions: 2 }, { key: 'desktop', sessions: 1 }])
    for (const l of [1000, 2000, 3000, 4000]) await put('vitals', { s: sess('1'), device: 'mobile', data: { lcp: l, cls: 0.05, inp: 100 } })
    const [m] = await A.vitals(run, range)
    expect(m).toMatchObject({ device: 'mobile', samples: 4, lcp: 3250, cls: 0.05, inp: 100 })
    expect(A.grade('lcp', 2400)).toBe('good'); expect(A.grade('lcp', 3000)).toBe('mid'); expect(A.grade('cls', 0.3)).toBe('bad'); expect(A.grade('inp', null)).toBeNull()
  })
  it('heatmap data: clicks of one page on one device, scroll depth, top elements', async () => {
    const click = (x: number, y: number, t: string, path = '/uz/mahsulot/amp', device = 'desktop') => put('click', { s: sess('1'), path, device, data: { x, y, w: 1440, h: 4000, t } })
    await click(0.5, 300, 'button:Savatga'); await click(0.52, 310, 'button:Savatga'); await click(0.1, 50, 'a:/uz/savat', '/ru/mahsulot/amp'); await click(0.9, 900, 'a:/uz', '/uz/mahsulot/amp', 'mobile')
    await put('scroll', { s: sess('1'), path: '/uz/mahsulot/amp', device: 'desktop', data: { depth: 100 } }); await put('pageview', { s: sess('1'), path: '/uz/mahsulot/amp', device: 'desktop' })
    const h = await A.heat(run, range, '/mahsulot/amp', 'desktop')
    expect(h.clicks).toHaveLength(3) // uz + ru, desktop only
    expect(h.views).toBe(1); expect(h.depth).toEqual([{ depth: 100, count: 1 }])
    expect(h.top[0]).toEqual({ t: 'button:Savatga', count: 2 })
    expect((await A.heatPages(run, range))[0]).toEqual({ path: '/mahsulot/amp', clicks: 4 })
  })
  it('real time: who is on the site now', async () => {
    await put('pageview', { s: sess('1'), path: '/uz/katalog/serum' }); await put('pageview', { s: sess('2'), path: '/uz/katalog/serum' }); await put('pageview', { s: sess('3'), path: '/uz', when: at(1) })
    const r = await A.realtime(run)
    expect(r.visitors).toBe(2); expect(r.pages[0]).toEqual({ path: '/katalog/serum', visitors: 2 }); expect(r.last).toHaveLength(3)
  })
  it('old rows are deleted, recent ones stay, and it runs at most once an hour', async () => {
    await put('click', { s: sess('1'), data: { x: 0.5, y: 1, w: 1440 }, when: at(100) }); await put('click', { s: sess('2'), data: { x: 0.5, y: 1, w: 1440 }, when: at(10) })
    await put('vitals', { s: sess('3'), data: { lcp: 1 }, when: at(100) }); await put('pageview', { s: sess('4'), when: at(100) }); await put('pageview', { s: sess('5'), when: at(800) })
    expect(await purgeOldEvents(Date.now() + 10 * 3_600_000)).toBe(true)
    const left = await run("SELECT name, count(*) c FROM analytics_events GROUP BY 1 ORDER BY 1")
    expect(left.map((r) => `${r.name}:${r.c}`)).toEqual(['click:1', 'pageview:1', 'vitals:1'])
    expect(await purgeOldEvents(Date.now() + 10 * 3_600_000 + 60_000)).toBe(false)
  })
  it('ranges are cut at midnight Tashkent time', () => {
    const r = A.rangeOf('1', new Date('2026-06-10T22:30:00Z')) // 03:30 on 11 June in Tashkent
    expect(r.from.toISOString()).toBe('2026-06-10T19:00:00.000Z')
    expect(A.rangeOf('7', new Date('2026-06-10T10:00:00Z')).from.toISOString()).toBe('2026-06-03T19:00:00.000Z')
    expect(A.rangeOf('bad').to.getTime()).toBeGreaterThan(Date.now())
  })
})
