import 'server-only'
import crypto from 'node:crypto'

import { payload } from '@/lib/catalog'
import { markPaid, markPaymentCancelled, orderByNumber } from '@/lib/orders'
import type { Payment } from '@/payload-types'
import { paymeConfig } from './config'

// Payme "Merchant API" (JSON-RPC 2.0, Basic auth "Paycom:<key>"). Amounts are in tiyin (1 soʻm = 100).
// Account field: order_id = our order number. TODO(admin): when the cabinet is ready, set PAYME_MERCHANT_ID / PAYME_KEY,
// set the endpoint https://<domain>/api/pay/payme and the account field "order_id" in the Payme cabinet, then run
// Payme's sandbox checks (PAYME_TEST=1).

const TIMEOUT = 43_200_000 // 12 h: an unperformed transaction is cancelled
const msg = (uz: string, ru: string, en: string) => ({ uz, ru, en })
export const PAYME_ERR = {
  AUTH: { code: -32504, message: msg('Ruxsat yoʻq', 'Недостаточно привилегий', 'Insufficient privileges') },
  METHOD: { code: -32601, message: msg('Metod topilmadi', 'Метод не найден', 'Method not found') },
  PARSE: { code: -32700, message: msg('Soʻrov xato', 'Ошибка разбора', 'Parse error') },
  AMOUNT: { code: -31001, message: msg('Summa notoʻgʻri', 'Неверная сумма', 'Incorrect amount') },
  NOT_FOUND: { code: -31003, message: msg('Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found') },
  CANT_CANCEL: { code: -31007, message: msg('Bekor qilib boʻlmaydi', 'Невозможно отменить', 'Unable to cancel') },
  CANT_PERFORM: { code: -31008, message: msg('Bajarib boʻlmaydi', 'Невозможно выполнить операцию', 'Unable to perform') },
  ORDER: { code: -31050, message: msg('Buyurtma topilmadi', 'Заказ не найден', 'Order not found'), data: 'order_id' },
  ORDER_BUSY: { code: -31051, message: msg('Buyurtma boshqa toʻlovda', 'Заказ ожидает другой оплаты', 'Order is being paid'), data: 'order_id' },
}
type Err = (typeof PAYME_ERR)[keyof typeof PAYME_ERR]
type Rpc = { id?: number | string; method?: string; params?: any }

const fail = (id: Rpc['id'], e: Err) => ({ jsonrpc: '2.0', id: id ?? null, error: e })
const ok = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result })

export function paymeAuthOk(header: string | null) {
  const { key } = paymeConfig()
  const want = `Basic ${Buffer.from(`Paycom:${key}`).toString('base64')}`
  return !!header && header.length === want.length && crypto.timingSafeEqual(Buffer.from(header), Buffer.from(want))
}

/** Hosted checkout URL: base64("m=<merchant>;ac.order_id=<n>;a=<tiyin>;c=<return>;l=<lang>"). */
export function paymePayUrl(orderNumber: string, total: number, returnUrl: string, lang: string) {
  const { merchantId, checkoutUrl } = paymeConfig()
  const params = `m=${merchantId};ac.order_id=${orderNumber};a=${Math.round(total * 100)};c=${returnUrl};l=${lang === 'ru' ? 'ru' : 'uz'}`
  return `${checkoutUrl}/${Buffer.from(params).toString('base64')}`
}

const txView = (t: Payment) => ({
  create_time: t.createTime ?? 0, perform_time: t.performTime ?? 0, cancel_time: t.cancelTime ?? 0,
  transaction: String(t.id), state: t.state, reason: t.reason ?? null,
})

async function findTx(id: string) {
  const p = await payload()
  return (await p.find({ collection: 'payments', where: { providerId: { equals: `payme:${id}` } }, limit: 1, overrideAccess: true, depth: 0 })).docs[0]
}

async function checkOrder(params: any): Promise<{ err?: Err; order?: NonNullable<Awaited<ReturnType<typeof orderByNumber>>> }> {
  const order = await orderByNumber(String(params?.account?.order_id ?? ''))
  if (!order) return { err: PAYME_ERR.ORDER }
  if (Number(params?.amount) !== Math.round(order.total * 100)) return { err: PAYME_ERR.AMOUNT }
  if (order.paymentStatus !== 'pending' || order.status === 'cancelled') return { err: PAYME_ERR.ORDER_BUSY }
  return { order }
}

async function cancelTx(t: Payment, reason: number) {
  const p = await payload()
  const state = t.state === 2 ? -2 : -1
  const upd = await p.update({ collection: 'payments', id: t.id, overrideAccess: true, data: { state, reason, cancelTime: Date.now() } })
  await markPaymentCancelled(Number(typeof t.order === 'object' ? t.order.id : t.order))
  return upd
}

export async function paymeHandle(rpc: Rpc, authHeader: string | null) {
  if (!paymeAuthOk(authHeader)) return fail(rpc?.id, PAYME_ERR.AUTH)
  const { id, method, params } = rpc ?? {}
  const p = await payload()
  switch (method) {
    case 'CheckPerformTransaction': {
      const { err } = await checkOrder(params)
      return err ? fail(id, err) : ok(id, { allow: true })
    }
    case 'CreateTransaction': {
      const existing = await findTx(String(params?.id))
      if (existing) {
        if (existing.state !== 1) return fail(id, PAYME_ERR.CANT_PERFORM)
        if (Date.now() - (existing.createTime ?? 0) > TIMEOUT) { await cancelTx(existing, 4); return fail(id, PAYME_ERR.CANT_PERFORM) }
        return ok(id, { create_time: existing.createTime, transaction: String(existing.id), state: 1 })
      }
      const { err, order } = await checkOrder(params)
      if (err) return fail(id, err)
      const active = await p.count({ collection: 'payments', where: { order: { equals: order!.id }, provider: { equals: 'payme' }, state: { equals: 1 } }, overrideAccess: true })
      if (active.totalDocs) return fail(id, PAYME_ERR.ORDER_BUSY)
      const t = await p.create({ collection: 'payments', overrideAccess: true, data: {
        provider: 'payme', providerId: `payme:${params.id}`, order: order!.id, amount: Number(params.amount), state: 1, createTime: Number(params.time) || Date.now() } })
      return ok(id, { create_time: t.createTime, transaction: String(t.id), state: 1 })
    }
    case 'PerformTransaction': {
      const t = await findTx(String(params?.id))
      if (!t) return fail(id, PAYME_ERR.NOT_FOUND)
      if (t.state === 2) return ok(id, { transaction: String(t.id), perform_time: t.performTime, state: 2 })
      if (t.state !== 1) return fail(id, PAYME_ERR.CANT_PERFORM)
      if (Date.now() - (t.createTime ?? 0) > TIMEOUT) { await cancelTx(t, 4); return fail(id, PAYME_ERR.CANT_PERFORM) }
      const done = await p.update({ collection: 'payments', id: t.id, overrideAccess: true, data: { state: 2, performTime: Date.now() } })
      await markPaid(Number(typeof t.order === 'object' ? t.order.id : t.order), 'payme')
      return ok(id, { transaction: String(done.id), perform_time: done.performTime, state: 2 })
    }
    case 'CancelTransaction': {
      const t = await findTx(String(params?.id))
      if (!t) return fail(id, PAYME_ERR.NOT_FOUND)
      if (t.state < 0) return ok(id, { transaction: String(t.id), cancel_time: t.cancelTime, state: t.state })
      if (t.state === 2) {
        // refund after payment only before the parcel left; otherwise the admin handles it by hand
        const o = await p.findByID({ collection: 'orders', id: typeof t.order === 'object' ? t.order.id : t.order, overrideAccess: true, depth: 0 })
        if (['shipping', 'delivered'].includes(o.status)) return fail(id, PAYME_ERR.CANT_CANCEL)
      }
      const c = await cancelTx(t, Number(params?.reason) || 0)
      return ok(id, { transaction: String(c.id), cancel_time: c.cancelTime, state: c.state })
    }
    case 'CheckTransaction': {
      const t = await findTx(String(params?.id))
      return t ? ok(id, txView(t)) : fail(id, PAYME_ERR.NOT_FOUND)
    }
    case 'GetStatement': {
      const res = await p.find({ collection: 'payments', where: { provider: { equals: 'payme' }, createTime: { greater_than_equal: Number(params?.from) || 0, less_than_equal: Number(params?.to) || Date.now() } },
        limit: 1000, overrideAccess: true, depth: 1, pagination: false })
      return ok(id, { transactions: res.docs.map((t) => ({
        id: t.providerId.replace(/^payme:/, ''), time: t.createTime, amount: t.amount,
        account: { order_id: typeof t.order === 'object' ? t.order.number : '' }, ...txView(t),
      })) })
    }
    default:
      return fail(id, PAYME_ERR.METHOD)
  }
}

/** Test mode: plays Payme's call sequence with a valid auth header (same code path as production). */
export async function paymeMockPay(orderNumber: string, total: number, ok_: boolean) {
  const auth = `Basic ${Buffer.from(`Paycom:${paymeConfig().key}`).toString('base64')}`
  const txId = crypto.randomBytes(12).toString('hex')
  const account = { order_id: orderNumber }
  const amount = Math.round(total * 100)
  const steps: Rpc[] = [
    { id: 1, method: 'CheckPerformTransaction', params: { amount, account } },
    { id: 2, method: 'CreateTransaction', params: { id: txId, time: Date.now(), amount, account } },
    ok_ ? { id: 3, method: 'PerformTransaction', params: { id: txId } } : { id: 3, method: 'CancelTransaction', params: { id: txId, reason: 3 } },
  ]
  let last: any
  for (const s of steps) {
    last = await paymeHandle(s, auth)
    if (last.error) return last
  }
  return last
}
