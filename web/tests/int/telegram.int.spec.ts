import { getPayload, type Payload } from 'payload'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }))

import config from '@/payload.config'
import { invalidateIntegrations } from '@/lib/integrations'
import { runner } from '@/lib/analytics'
import { waitingDemand } from '@/lib/marketing'
import { createOrder } from '@/lib/orders'
import { webhookSecret } from '@/lib/telegram'
import { handleUpdate, notifyBackInStock, notifyOrderStatus, orderStatusMessage, type Send } from '@/lib/telegram-bot'

let payload: Payload
let sent: { chat: string; text: string }[]
const send: Send = async (chat, text) => { sent.push({ chat, text }); return { ok: true, status: 200 } }
const sql = (q: string, v: unknown[] = []) => (payload.db as unknown as { pool: { query: (q: string, v: unknown[]) => Promise<{ rows: Record<string, any>[] }> } }).pool.query(q, v)
const msg = (text: string, chat = 777, lang = 'uz', type = 'private') => ({ message: { text, chat: { id: chat, type }, from: { language_code: lang } } })
const id = () => Math.random().toString(16).slice(2, 8).toUpperCase()
const SKU = `TG-${id()}`
let slug = ''

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const brand = await payload.create({ collection: 'brands', data: { name: `TB ${id()}`, slug: `tb-${id()}` } })
  const cat = await payload.create({ collection: 'categories', data: { title: 'T', slug: `tc-${id()}` } })
  slug = `tg-${id().toLowerCase()}`
  await payload.create({ collection: 'products', data: { name: 'Bot Serum', slug, brand: brand.id, category: cat.id, variants: [{ sku: SKU, price: 100000, stock: 0 }] } })
})
beforeEach(async () => { sent = []; await sql('DELETE FROM waitlist') })

async function newOrder(telegramUpdates = true) {
  const { order } = await createOrder({ lang: 'uz', lines: [{ sku: SKU, qty: 1 }], name: 'T', phone: `9989${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`, address: 'a', payment: 'click', consent: true, telegramUpdates })
  return order
}
const withStock = (n: number) => sql('UPDATE products_variants SET stock = $2 WHERE sku = $1', [SKU, n])

describe('the customer bot', () => {
  it('connects an order only with the right secret link', async () => {
    await withStock(5)
    const o = await newOrder()
    expect(await handleUpdate(msg(`/start o_${o.number}_${'0'.repeat(32)}`), send)).toBe('bad-link')
    expect((await payload.findByID({ collection: 'orders', id: o.id, overrideAccess: true })).telegramChat).toBeFalsy()
    expect(await handleUpdate(msg(`/start o_${o.number}_${o.token}`), send)).toBe('order')
    expect((await payload.findByID({ collection: 'orders', id: o.id, overrideAccess: true })).telegramChat).toBe('777')
    expect(sent.at(-1)!.text).toContain(`№${o.number}`)
    expect(sent.at(-1)!.text).toContain('Toʻlov kutilmoqda')
  })
  it('does not connect an order that opted out of Telegram messages', async () => {
    await withStock(5)
    const o = await newOrder(false)
    expect(await handleUpdate(msg(`/start o_${o.number}_${o.token}`), send)).toBe('no-updates')
    expect((await payload.findByID({ collection: 'orders', id: o.id, overrideAccess: true })).telegramChat).toBeFalsy()
  })
  it('answers in Russian to a Russian-speaking customer', async () => {
    expect(await handleUpdate(msg('/start', 5, 'ru'), send)).toBe('hello')
    expect(sent[0].text).toContain('Здравствуйте')
    expect(await handleUpdate(msg('привет', 5, 'ru'), send)).toBe('other')
  })
  it('ignores groups, channels, long text and junk', async () => {
    expect(await handleUpdate(msg('/start', 1, 'uz', 'group'), send)).toBe('ignored')
    expect(await handleUpdate(msg('x'.repeat(300)), send)).toBe('ignored')
    expect(await handleUpdate({}, send)).toBe('ignored')
    expect(await handleUpdate({ message: { text: '/start', chat: { id: 'x' as never, type: 'private' } } }, send)).toBe('ignored')
    expect(sent).toEqual([])
    expect(await handleUpdate(msg('/start <script>alert(1)</script>'), send)).toBe('other')
  })
  it('"notify me": waits when out of stock, says so when it is in stock, never twice for one chat', async () => {
    await withStock(0)
    const arg = SKU.replace(/[^\w-]/g, '_')
    expect(await handleUpdate(msg(`/start notify_${arg}`), send)).toBe('waiting')
    expect(await handleUpdate(msg(`/start notify_${arg}`), send)).toBe('waiting')
    expect((await sql('SELECT count(*) c FROM waitlist WHERE sku = $1', [SKU])).rows[0].c).toBe('1')
    expect(sent[0].text).toContain('Bot Serum')
    await withStock(3)
    expect(await handleUpdate(msg(`/start notify_${arg}`, 888), send)).toBe('in-stock')
    expect(await handleUpdate(msg('/start notify_NO-SUCH-SKU'), send)).toBe('no-product')
  })
  it('"buy" and "account" links point to the site, the order is placed there', async () => {
    expect(await handleUpdate(msg(`/start buy_${SKU}`), send)).toBe('buy')
    expect(sent.at(-1)!.text).toContain(`/uz/mahsulot/${slug}`)
    expect(await handleUpdate(msg('/start account'), send)).toBe('account')
    expect(sent.at(-1)!.text).toContain('/uz/kabinet')
  })
  it('/stop forgets the chat everywhere', async () => {
    await withStock(5)
    const o = await newOrder()
    await handleUpdate(msg(`/start o_${o.number}_${o.token}`, 321), send)
    await withStock(0)
    await handleUpdate(msg(`/start notify_${SKU.replace(/[^\w-]/g, '_')}`, 321), send)
    expect(await handleUpdate(msg('/stop', 321), send)).toBe('stopped')
    expect((await payload.findByID({ collection: 'orders', id: o.id, overrideAccess: true })).telegramChat).toBeFalsy()
    expect((await sql('SELECT count(*) c FROM waitlist WHERE chat = $1', ['321'])).rows[0].c).toBe('0')
  })
})

describe('what the owner sees', () => {
  it('most waited-for products first, with the stock they have now', async () => {
    await withStock(0)
    const arg = SKU.replace(/[^\w-]/g, '_')
    for (const c of [11, 12, 13]) await handleUpdate(msg(`/start notify_${arg}`, c), send)
    expect((await waitingDemand(await runner()))[0]).toEqual({ sku: SKU, name: 'Bot Serum', volume: '', people: 3, stock: 0 })
  })
})

describe('messages the customer receives', () => {
  it('one text per status, in the order language, with bonus points on delivery', () => {
    expect(orderStatusMessage({ number: '10001', status: 'shipping', lang: 'uz' })).toContain('30 daqiqa oldin')
    expect(orderStatusMessage({ number: '10001', status: 'shipping', lang: 'ru' })).toContain('за 30 минут')
    expect(orderStatusMessage({ number: '10001', status: 'delivered', lang: 'uz', pointsEarned: 1200 })).toContain('+1200')
    expect(orderStatusMessage({ number: '10001', status: 'new', lang: 'uz' })).toBeNull() // nothing to say before payment
  })
  it('a status change reaches the connected chat; a blocked bot is forgotten', async () => {
    await withStock(5)
    const o = await newOrder()
    await handleUpdate(msg(`/start o_${o.number}_${o.token}`, 555), send)
    sent = []
    const doc = await payload.update({ collection: 'orders', id: o.id, data: { status: 'shipping' }, overrideAccess: true })
    expect(await notifyOrderStatus(doc, send)).toBe(true)
    expect(sent).toEqual([{ chat: '555', text: expect.stringContaining('Yoʻlda') }])
    expect(await notifyOrderStatus({ ...doc, telegramChat: null }, send)).toBe(false) // nobody connected
    expect(await notifyOrderStatus({ ...doc, telegramUpdates: false }, send)).toBe(false)
    await notifyOrderStatus(doc, async () => ({ ok: false, status: 403, blocked: true }))
    expect((await payload.findByID({ collection: 'orders', id: o.id, overrideAccess: true })).telegramChat).toBeFalsy()
  })
  it('back in stock: everyone waiting gets one message, in their language, and is removed', async () => {
    await withStock(0)
    await handleUpdate(msg(`/start notify_${SKU.replace(/[^\w-]/g, '_')}`, 1001, 'uz'), send)
    await handleUpdate(msg(`/start notify_${SKU.replace(/[^\w-]/g, '_')}`, 1002, 'ru'), send)
    sent = []
    expect(await notifyBackInStock(SKU, 'Bot Serum', slug, send)).toBe(2)
    expect(sent.find((s) => s.chat === '1001')!.text).toContain('qaytib keldi')
    expect(sent.find((s) => s.chat === '1002')!.text).toContain('снова в наличии')
    expect(await notifyBackInStock(SKU, 'Bot Serum', slug, send)).toBe(0)
  })
  it('the real hooks: raising the stock in the admin notifies the waiting customer', async () => {
    await withStock(0)
    await handleUpdate(msg(`/start notify_${SKU.replace(/[^\w-]/g, '_')}`, 2002), send)
    const calls: unknown[][] = []
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (...a) => { calls.push(a); return new Response('{"ok":true}', { status: 200 }) })
    await payload.updateGlobal({ slug: 'integrations', data: { telegramToken: 'tok-for-test', telegramAdminIds: '123456789' } as never, overrideAccess: true }); invalidateIntegrations()
    try {
      const pr = (await payload.find({ collection: 'products', where: { slug: { equals: slug } }, limit: 1, overrideAccess: true, depth: 0 })).docs[0]
      await payload.update({ collection: 'products', id: pr.id, overrideAccess: true, data: { variants: pr.variants.map((v) => ({ ...v, stock: 4 })) } })
      await new Promise((r) => setTimeout(r, 300))
      const tg = calls.filter((c) => String(c[0]).includes('api.telegram.org/bottok-for-test/sendMessage'))
      expect(tg.length).toBe(1)
      expect(JSON.parse(String((tg[0][1] as RequestInit).body))).toMatchObject({ chat_id: '2002' })
      expect((await sql('SELECT count(*) c FROM waitlist WHERE sku = $1', [SKU])).rows[0].c).toBe('0')
    } finally { spy.mockRestore(); await sql('DELETE FROM integrations'); invalidateIntegrations() }
  })
})

describe('the webhook secret', () => {
  afterEach(() => { process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET })
  it('depends on the bot token and on the server key, and is a plain header-safe string', () => {
    const a = webhookSecret('123:abc'), b = webhookSecret('123:abd')
    expect(a).toMatch(/^[a-f0-9]{48}$/); expect(a).not.toBe(b); expect(webhookSecret('123:abc')).toBe(a)
    const old = process.env.PAYLOAD_SECRET
    process.env.PAYLOAD_SECRET = 'another-secret-of-enough-length'
    expect(webhookSecret('123:abc')).not.toBe(a)
    process.env.PAYLOAD_SECRET = old
  })
})
