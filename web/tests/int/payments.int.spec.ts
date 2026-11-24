// Click and Payme handlers against a real database: the same code paths the providers call in production.
import crypto from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }))

import config from '@/payload.config'
import { createOrder, markPaid, quoteCart } from '@/lib/orders'
import { clickHandle, clickSign, CLICK_ERR, type ClickParams } from '@/lib/payments/click'
import { clickConfig, paymeConfig } from '@/lib/payments/config'
import { paymeHandle, PAYME_ERR } from '@/lib/payments/payme'

let payload: Payload
const id = () => crypto.randomBytes(5).toString('hex')
const SKU = `T-${id()}`.toUpperCase()
const PRICE = 200_000
type Sql = { query: (q: string, v: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }
const sql = () => (payload.db as unknown as { pool: Sql }).pool
const stock = async () => Number((await sql().query('SELECT stock FROM products_variants WHERE sku = $1', [SKU])).rows[0].stock)
const order = async (n: string) => (await payload.find({ collection: 'orders', where: { number: { equals: n } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
const phone = () => `9989${String(crypto.randomInt(0, 1e8)).padStart(8, '0')}`

async function newOrder(x: { qty?: number; promo?: string; payment?: 'click' | 'payme' } = {}) {
  const { order: o } = await createOrder({ lang: 'uz', lines: [{ sku: SKU, qty: x.qty ?? 1 }], promo: x.promo, name: 'Test', phone: phone(), address: 'Test 1', payment: x.payment ?? 'click', consent: true })
  return o
}
const age = (orderId: number | string, hours: number) => sql().query(`UPDATE orders SET created_at = now() - ($2 || ' hours')::interval WHERE id = $1`, [orderId, String(hours)])

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const brand = await payload.create({ collection: 'brands', data: { name: `Test ${id()}`, slug: `t-${id()}` } })
  const cat = await payload.create({ collection: 'categories', data: { title: 'Test', slug: `t-${id()}` } })
  await payload.create({ collection: 'products', data: { name: `Pay test ${id()}`, slug: `t-${id()}`, brand: brand.id, category: cat.id, variants: [{ sku: SKU, price: PRICE, stock: 50 }] } })
})

describe('Click', () => {
  const call = async (p: Omit<ClickParams, 'sign_string'>, secret?: string) => clickHandle({ ...p, sign_string: clickSign(p, secret ?? (await clickConfig()).secretKey) })
  const base = (o: { number: string; total: number }, trans = String(crypto.randomInt(1e9))) =>
    ({ click_trans_id: trans, service_id: '0', click_paydoc_id: '1', merchant_trans_id: o.number, amount: String(o.total), sign_time: '2026-06-01 10:00:00', error: '0', error_note: 'Success' })
  const pay = async (o: { number: string; total: number }) => {
    const b = base(o)
    const prep = await call({ ...b, action: '0' })
    return { b, prep, done: prep.error === 0 ? await call({ ...b, action: '1', merchant_prepare_id: String(prep.merchant_prepare_id) }) : null }
  }

  it('rejects a wrong signature, a wrong amount and an unknown order', async () => {
    const o = await newOrder()
    expect((await call({ ...base(o), action: '0' }, 'not-the-secret')).error).toBe(CLICK_ERR.SIGN)
    expect((await call({ ...base(o), amount: String(o.total - 1000), action: '0' })).error).toBe(CLICK_ERR.AMOUNT)
    expect((await call({ ...base({ number: '999999999', total: 1 }), action: '0' })).error).toBe(CLICK_ERR.ORDER_NOT_FOUND)
    expect((await order(o.number)).paymentStatus).toBe('pending')
  })

  it('prepare + complete pays the order once and takes the stock once', async () => {
    const o = await newOrder({ qty: 2 })
    const before = await stock()
    const { b, prep, done } = await pay(o)
    expect(done?.error).toBe(CLICK_ERR.OK)
    expect((await order(o.number))).toMatchObject({ paymentStatus: 'paid', status: 'accepted' })
    expect(await stock()).toBe(before - 2)
    // Click repeats Complete when it gets no answer: same result, nothing taken twice
    expect((await call({ ...b, action: '1', merchant_prepare_id: String(prep.merchant_prepare_id) })).error).toBe(CLICK_ERR.ALREADY_PAID)
    expect(await stock()).toBe(before - 2)
    // a second transaction for a paid order is refused before any money moves
    expect((await call({ ...base(o), action: '0' })).error).toBe(CLICK_ERR.ALREADY_PAID)
  })

  it('a failed payment can be tried again', async () => {
    const o = await newOrder()
    const b = base(o)
    const prep = await call({ ...b, action: '0' })
    expect((await call({ ...b, action: '1', merchant_prepare_id: String(prep.merchant_prepare_id), error: '-5017', error_note: 'Cancelled' })).error).toBe(CLICK_ERR.CANCELLED)
    expect((await order(o.number)).paymentStatus).toBe('cancelled')
    expect((await pay(o)).done?.error).toBe(CLICK_ERR.OK)
    expect((await order(o.number)).paymentStatus).toBe('paid')
  })

  it('refuses an order older than the payment window or cancelled by the shop', async () => {
    const old = await newOrder()
    await age(old.id, 13)
    expect((await call({ ...base(old), action: '0' })).error).toBe(CLICK_ERR.CANCELLED)
    const gone = await newOrder()
    await payload.update({ collection: 'orders', id: gone.id, data: { status: 'cancelled' }, overrideAccess: true })
    expect((await call({ ...base(gone), action: '0' })).error).toBe(CLICK_ERR.CANCELLED)
  })

  it('an abandoned transaction does not undo a payment made through another one', async () => {
    const o = await newOrder()
    const stale = base(o)
    const prep = await call({ ...stale, action: '0' })
    expect((await pay(o)).done?.error).toBe(CLICK_ERR.OK)
    await call({ ...stale, action: '1', merchant_prepare_id: String(prep.merchant_prepare_id), error: '-5017', error_note: 'Cancelled' })
    expect((await order(o.number)).paymentStatus).toBe('paid')
  })
})

describe('Payme', () => {
  const auth = async () => `Basic ${Buffer.from(`Paycom:${(await paymeConfig()).key}`).toString('base64')}`
  const rpc = async (method: string, params: object, header?: string | null) => (await paymeHandle({ id: 1, method, params }, header === undefined ? await auth() : header)) as { result?: any; error?: { code: number } }
  const tiyin = (o: { total: number }) => Math.round(o.total * 100)
  const acc = (o: { number: string }) => ({ order_id: o.number })

  it('needs the merchant key', async () => {
    const o = await newOrder({ payment: 'payme' })
    for (const h of [null, 'Basic xxx', `Basic ${Buffer.from('Paycom:wrong').toString('base64')}`]) {
      expect((await rpc('CheckPerformTransaction', { amount: tiyin(o), account: acc(o) }, h)).error?.code).toBe(PAYME_ERR.AUTH.code)
    }
  })

  it('checks the amount and the order', async () => {
    const o = await newOrder({ payment: 'payme' })
    expect((await rpc('CheckPerformTransaction', { amount: tiyin(o), account: acc(o) })).result).toEqual({ allow: true })
    expect((await rpc('CheckPerformTransaction', { amount: tiyin(o) + 100, account: acc(o) })).error?.code).toBe(-31001)
    const unknown = (await rpc('CheckPerformTransaction', { amount: 100, account: { order_id: '999999999' } })).error!.code
    expect(unknown).toBeLessThanOrEqual(-31050); expect(unknown).toBeGreaterThanOrEqual(-31099)
    expect((await rpc('NoSuchMethod', {})).error?.code).toBe(-32601)
  })

  it('create -> perform pays once; repeats return the same transaction', async () => {
    const o = await newOrder({ payment: 'payme', qty: 3 })
    const before = await stock()
    const tx = id()
    const made = await rpc('CreateTransaction', { id: tx, time: Date.now(), amount: tiyin(o), account: acc(o) })
    expect(made.result.state).toBe(1)
    expect((await rpc('CreateTransaction', { id: tx, time: Date.now(), amount: tiyin(o), account: acc(o) })).result.transaction).toBe(made.result.transaction)
    // a second transaction for the same order while the first is open: refused with an account error
    const busy = (await rpc('CreateTransaction', { id: id(), time: Date.now(), amount: tiyin(o), account: acc(o) })).error!.code
    expect(busy).toBeLessThanOrEqual(-31050); expect(busy).toBeGreaterThanOrEqual(-31099)
    const done = await rpc('PerformTransaction', { id: tx })
    expect(done.result.state).toBe(2)
    expect((await rpc('PerformTransaction', { id: tx })).result.perform_time).toBe(done.result.perform_time)
    expect((await order(o.number)).paymentStatus).toBe('paid')
    expect(await stock()).toBe(before - 3)
    const seen = await rpc('CheckTransaction', { id: tx })
    expect(seen.result).toMatchObject({ state: 2, transaction: made.result.transaction, reason: null })
    const list = await rpc('GetStatement', { from: Date.now() - 60_000, to: Date.now() + 60_000 })
    expect(list.result.transactions.some((t: { id: string; account: { order_id: string } }) => t.id === tx && t.account.order_id === o.number)).toBe(true)
  })

  it('cancel before payment lets the customer retry; cancel after payment asks the admin for a refund', async () => {
    const o = await newOrder({ payment: 'payme' })
    const first = id()
    await rpc('CreateTransaction', { id: first, time: Date.now(), amount: tiyin(o), account: acc(o) })
    expect((await rpc('CancelTransaction', { id: first, reason: 3 })).result.state).toBe(-1)
    expect((await order(o.number)).paymentStatus).toBe('cancelled')
    expect((await rpc('PerformTransaction', { id: first })).error?.code).toBe(-31008)
    const second = id()
    expect((await rpc('CreateTransaction', { id: second, time: Date.now(), amount: tiyin(o), account: acc(o) })).result.state).toBe(1)
    expect((await order(o.number)).paymentStatus).toBe('pending')
    expect((await rpc('PerformTransaction', { id: second })).result.state).toBe(2)
    const back = await rpc('CancelTransaction', { id: second, reason: 5 })
    expect(back.result.state).toBe(-2)
    expect((await rpc('CheckTransaction', { id: second })).result.reason).toBe(5)
    expect((await order(o.number)).paymentStatus).toBe('refund')
    // a late cancel of the first, never-paid transaction changes nothing
    await rpc('CancelTransaction', { id: first, reason: 4 })
    expect((await order(o.number)).paymentStatus).toBe('refund')
  })

  it('does not take money for an old, cancelled or already paid order', async () => {
    const old = await newOrder({ payment: 'payme' })
    await age(old.id, 13)
    expect((await rpc('CheckPerformTransaction', { amount: tiyin(old), account: acc(old) })).error?.code).toBe(PAYME_ERR.ORDER_BUSY.code)
    const o = await newOrder({ payment: 'payme' })
    const tx = id()
    await rpc('CreateTransaction', { id: tx, time: Date.now(), amount: tiyin(o), account: acc(o) })
    await payload.update({ collection: 'orders', id: o.id, data: { status: 'cancelled' }, overrideAccess: true })
    expect((await rpc('PerformTransaction', { id: tx })).error?.code).toBe(-31008)
    expect((await rpc('CheckTransaction', { id: tx })).result.state).toBe(-1)
    expect((await order(o.number)).paymentStatus).not.toBe('paid')
    expect((await rpc('CancelTransaction', { id: 'no-such-transaction' })).error?.code).toBe(-31003)
  })
})

describe('order money rules', () => {
  it('two callbacks at the same moment take the stock once', async () => {
    const o = await newOrder({ qty: 2 })
    const before = await stock()
    await Promise.all([markPaid(Number(o.id), 'click'), markPaid(Number(o.id), 'click'), markPaid(Number(o.id), 'payme')])
    expect(await stock()).toBe(before - 2)
  })

  it('stock never goes below zero', async () => {
    const o = await newOrder({ qty: 2 })
    const left = await stock()
    await sql().query('UPDATE products_variants SET stock = 1 WHERE sku = $1', [SKU])
    await markPaid(Number(o.id), 'click')
    expect(await stock()).toBe(0)
    await sql().query('UPDATE products_variants SET stock = $2 WHERE sku = $1', [SKU, left])
  })

  it('a gift certificate cannot be spent twice by two unpaid orders', async () => {
    const code = `YP-${id().toUpperCase()}`
    await payload.create({ collection: 'gift-cards', overrideAccess: true, data: { code, amount: 150_000, balance: 150_000, active: true } })
    const first = await newOrder({ promo: code })
    expect(first.discount).toBe(150_000)
    // the first order is not paid yet, but its part of the certificate is reserved
    expect((await quoteCart({ lines: [{ sku: SKU, qty: 1 }], promo: code }, 'uz')).quote.promoError).toBe('not_found')
    await markPaid(Number(first.id), 'click')
    const gc = (await payload.find({ collection: 'gift-cards', where: { code: { equals: code } }, overrideAccess: true })).docs[0]
    expect(gc.balance).toBe(0)
    expect((await quoteCart({ lines: [{ sku: SKU, qty: 1 }], promo: code }, 'uz')).quote.discount).toBe(0)
  })

  it('an unpaid order frees the certificate after the hold period', async () => {
    const code = `YP-${id().toUpperCase()}`
    await payload.create({ collection: 'gift-cards', overrideAccess: true, data: { code, amount: 100_000, balance: 100_000, active: true } })
    const o = await newOrder({ promo: code })
    await age(o.id, 25)
    expect((await quoteCart({ lines: [{ sku: SKU, qty: 1 }], promo: code }, 'uz')).quote.discount).toBe(100_000)
  })
})
