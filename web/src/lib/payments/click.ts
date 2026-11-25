import 'server-only'
import crypto from 'node:crypto'

import { payload } from '@/lib/catalog'
import { payable } from '@/lib/order-state'
import { markPaid, markPaymentCancelled, orderByNumber, reopenPayment } from '@/lib/orders'
import { clickConfig, siteUrl } from './config'

// Click "Shop API" (merchant callbacks). Click calls Prepare (action=0), then Complete (action=1) as
// application/x-www-form-urlencoded POSTs. TODO(admin): when the merchant account arrives, compare with the
// current docs at docs.click.uz (field names, error codes) and set CLICK_SERVICE_ID / CLICK_MERCHANT_ID / CLICK_SECRET_KEY.

export const CLICK_ERR = {
  OK: 0, SIGN: -1, AMOUNT: -2, ACTION: -3, ALREADY_PAID: -4, ORDER_NOT_FOUND: -5, TXN_NOT_FOUND: -6, UPDATE_FAILED: -7, BAD_REQUEST: -8, CANCELLED: -9,
} as const

export type ClickParams = Record<string, string>

export function clickSign(p: ClickParams, secret: string) {
  const prepareId = p.action === '1' ? (p.merchant_prepare_id ?? '') : ''
  return crypto.createHash('md5')
    .update(`${p.click_trans_id}${p.service_id}${secret}${p.merchant_trans_id}${prepareId}${p.amount}${p.action}${p.sign_time}`)
    .digest('hex')
}

type ClickReply = { click_trans_id: string; merchant_trans_id: string; error: number; error_note: string; merchant_prepare_id?: number | string; merchant_confirm_id?: number | string }
const reply = (p: ClickParams, error: number, note: string, extra: Partial<ClickReply> = {}): ClickReply =>
  ({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error, error_note: note, ...extra })

/** Pay page URL for an order (Click hosted page). */
export async function clickPayUrl(orderNumber: string, total: number, returnUrl: string) {
  const c = await clickConfig()
  const q = new URLSearchParams({ service_id: c.serviceId, merchant_id: c.merchantId, amount: String(total), transaction_param: orderNumber, return_url: returnUrl })
  return `https://my.click.uz/services/pay?${q}`
}

export async function clickHandle(p: ClickParams) {
  const { secretKey } = await clickConfig()
  const need = ['click_trans_id', 'service_id', 'merchant_trans_id', 'amount', 'action', 'sign_time', 'sign_string']
  if (need.some((k) => p[k] === undefined)) return reply(p, CLICK_ERR.BAD_REQUEST, 'Error in request from click')
  const expected = clickSign(p, secretKey)
  if (expected.length !== p.sign_string.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(p.sign_string))) {
    return reply(p, CLICK_ERR.SIGN, 'SIGN CHECK FAILED!')
  }
  if (p.action !== '0' && p.action !== '1') return reply(p, CLICK_ERR.ACTION, 'Action not found')
  const order = await orderByNumber(p.merchant_trans_id)
  if (!order) return reply(p, CLICK_ERR.ORDER_NOT_FOUND, 'Order not found')
  if (Math.abs(Number(p.amount) - order.total) > 0.01) return reply(p, CLICK_ERR.AMOUNT, 'Incorrect parameter amount')
  const pl = await payload()
  const existing = (await pl.find({ collection: 'payments', where: { providerId: { equals: `click:${p.click_trans_id}` } }, limit: 1, overrideAccess: true })).docs[0]

  if (p.action === '0') { // Prepare
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'refund') return reply(p, CLICK_ERR.ALREADY_PAID, 'Already paid')
    // cancelled by the shop, or older than the payment window (prices and stock are no longer held)
    if (!payable(order)) return reply(p, CLICK_ERR.CANCELLED, 'Transaction cancelled')
    if (existing?.state === -1) return reply(p, CLICK_ERR.CANCELLED, 'Transaction cancelled')
    const pay = existing ?? await pl.create({ collection: 'payments', overrideAccess: true, data: {
      provider: 'click', providerId: `click:${p.click_trans_id}`, order: order.id, amount: Number(p.amount), state: 0, createTime: Date.now() } })
    await reopenPayment(Number(order.id)) // a retry after a failed attempt: the order waits for payment again
    return reply(p, CLICK_ERR.OK, 'Success', { merchant_prepare_id: pay.id })
  }

  // Complete
  if (!existing || String(existing.id) !== String(p.merchant_prepare_id)) return reply(p, CLICK_ERR.TXN_NOT_FOUND, 'Transaction does not exist')
  if (existing.state === -1) return reply(p, CLICK_ERR.CANCELLED, 'Transaction cancelled')
  if (existing.state === 1) return reply(p, CLICK_ERR.ALREADY_PAID, 'Already paid', { merchant_confirm_id: existing.id }) // repeated complete
  if (Number(p.error ?? 0) < 0) { // Click reports a failed payment
    await pl.update({ collection: 'payments', id: existing.id, overrideAccess: true, data: { state: -1, cancelTime: Date.now() } })
    await markPaymentCancelled(Number(order.id))
    return reply(p, CLICK_ERR.CANCELLED, 'Transaction cancelled')
  }
  // another transaction paid the order, or the shop cancelled it: an error here makes Click return the money
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'refund') return reply(p, CLICK_ERR.ALREADY_PAID, 'Already paid')
  if (order.status === 'cancelled') return reply(p, CLICK_ERR.CANCELLED, 'Transaction cancelled')
  await pl.update({ collection: 'payments', id: existing.id, overrideAccess: true, data: { state: 1, performTime: Date.now() } })
  await markPaid(Number(order.id), 'click')
  return reply(p, CLICK_ERR.OK, 'Success', { merchant_confirm_id: existing.id })
}

/** Test mode: plays Click's two calls with a valid signature (same code path as production). */
export async function clickMockPay(orderNumber: string, total: number, ok: boolean) {
  const { serviceId, secretKey } = await clickConfig()
  const base: ClickParams = { click_trans_id: String(Date.now()), service_id: serviceId, click_paydoc_id: '1', merchant_trans_id: orderNumber,
    amount: String(total), sign_time: new Date().toISOString().slice(0, 19).replace('T', ' '), error: '0', error_note: 'Success' }
  const prep = { ...base, action: '0' }
  const r1 = await clickHandle({ ...prep, sign_string: clickSign(prep, secretKey) })
  if (r1.error !== 0) return r1
  const done = { ...base, action: '1', merchant_prepare_id: String(r1.merchant_prepare_id), ...(ok ? {} : { error: '-5017', error_note: 'Cancelled by user' }) }
  return clickHandle({ ...done, sign_string: clickSign(done, secretKey) })
}

export const clickReturnUrl = (lang: string, number: string, token: string) => `${siteUrl()}/${lang}/buyurtma/${number}?t=${token}`
