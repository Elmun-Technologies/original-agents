import 'server-only'
import crypto from 'node:crypto'

import type { Media, Order, Product } from '@/payload-types'
import { getStore, oldPrices, payload } from './catalog'
import type { Lang } from './i18n'
import { recordOrderEvent } from './analytics-record'
import type { readCookies } from './analytics-ingest'
import { thumb } from './media-url'
import { notifyAdmins } from './notify'
export const GIFT_CATEGORY = 'sertifikatlar'
/** the shop's own brand (gift certificates) — not listed among cosmetics brands */
export const HOUSE_BRAND = 'yeppo'

import { sessionPhone } from './customer'
import { loyaltyOf } from './loyalty'
import { holds } from './order-state'
import { normalizePhone, priceCart, suggestion, type Delivery, type Priced, type Promo, type Quote } from './pricing'

export type CartRequest = { lines: { sku: string; qty: number }[]; promo?: string; delivery?: Delivery; gift?: boolean; phone?: string; usePoints?: boolean }

/** Current prices, real old prices and stock for the SKUs in a cart (+ category for the suggestion rule). */
async function loadPriced(skus: string[], lang: Lang) {
  const p = await payload()
  const res = await p.find({ collection: 'products', where: { 'variants.sku': { in: skus } }, locale: lang, depth: 1, limit: 200, pagination: false })
  const olds = await oldPrices(skus)
  const map = new Map<string, Priced & { category: string }>()
  for (const pr of res.docs) {
    const img = thumb((pr.images?.[0] as Media | undefined)?.url, 480)
    for (const v of pr.variants) {
      if (!skus.includes(v.sku)) continue
      map.set(v.sku, {
        sku: v.sku, slug: pr.slug, brand: typeof pr.brand === 'object' ? pr.brand.name : '', name: pr.name, img, volume: v.volume ?? undefined,
        price: v.price, old: olds.get(v.sku), stock: v.stock ?? 0, category: typeof pr.category === 'object' ? pr.category.slug : '',
        giftcard: typeof pr.category === 'object' && pr.category.slug === GIFT_CATEGORY,
      })
    }
  }
  return map
}

/** Ready sets that get −10%: the home routine, every segment set and every article set (first variant of each product). */
async function readyBundles(homeRoutine: unknown) {
  const sku = (r: unknown) => (r && typeof r === 'object' ? (r as Product).variants?.[0]?.sku : undefined)
  const p = await payload()
  const [segs, arts] = await Promise.all([
    p.find({ collection: 'segments', depth: 2, limit: 50, pagination: false, select: { set: true } }),
    p.find({ collection: 'articles', depth: 2, limit: 200, pagination: false, select: { steps: true } }),
  ])
  const sets = [Array.isArray(homeRoutine) ? homeRoutine.map(sku) : [], ...segs.docs.map((s) => (s.set ?? []).map((x) => sku(x.product))),
    ...arts.docs.map((a) => (a.steps ?? []).map((x) => sku(x.product)))]
  return sets.map((s) => s.filter(Boolean) as string[]).filter((s) => s.length >= 2)
}

async function findPromo(code: string | undefined, lang: Lang): Promise<Promo | null> {
  if (!code?.trim()) return null
  const p = await payload()
  const doc = (await p.find({ collection: 'promo-codes', where: { code: { equals: code.trim().toUpperCase() } }, limit: 1, depth: 0, locale: lang, overrideAccess: true })).docs[0]
  if (!doc) {
    // a gift certificate code works in the same field: fixed discount up to its balance
    const gc = (await p.find({ collection: 'gift-cards', where: { code: { equals: code.trim().toUpperCase() }, active: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (gc && (!gc.validTo || new Date(gc.validTo) > new Date())) {
      // the balance is spent when an order is paid; unpaid orders that may still be paid keep their part reserved
      const open = await p.find({ collection: 'orders', where: { discountLabel: { equals: gc.code }, paymentStatus: { in: ['pending', 'cancelled'] }, status: { equals: 'new' } },
        select: { createdAt: true, status: true, paymentStatus: true, discount: true }, limit: 200, pagination: false, depth: 0, overrideAccess: true })
      const left = gc.balance - open.docs.filter((o) => holds(o)).reduce((a, o) => a + (o.discount ?? 0), 0)
      if (left > 0) return { code: gc.code, type: 'fixed', value: left, note: lang === 'ru' ? 'подарочный сертификат' : 'sovgʻa sertifikati', active: true }
    }
  }
  return doc ? { note: doc.note, code: doc.code, type: doc.type, value: doc.value, minTotal: doc.minTotal, firstOrderOnly: doc.firstOrderOnly, active: doc.active, validTo: doc.validTo } : null
}

/** "First order" = no paid order with this phone yet. */
async function isFirstOrder(phone?: string | null) {
  if (!phone) return true
  const p = await payload()
  const n = await p.count({ collection: 'orders', where: { phone: { equals: phone }, paymentStatus: { equals: 'paid' } }, overrideAccess: true })
  return n.totalDocs === 0
}

export async function quoteCart(req: CartRequest, lang: Lang) {
  const lines = (req.lines ?? []).filter((l) => typeof l?.sku === 'string' && Number.isFinite(l.qty)).slice(0, 50)
  const skus = [...new Set(lines.map((l) => l.sku))]
  const [store, products, promo] = await Promise.all([getStore(), loadPriced(skus, lang), findPromo(req.promo, lang)])
  const bundles = await readyBundles(store.homeRoutine)
  const phone = req.phone ? normalizePhone(req.phone) : null
  // bonus points: only the signed-in customer's own, and only for an order on their own phone
  const me = await sessionPhone()
  const loyal = me && (!phone || phone === me) ? await loyaltyOf(await payload(), me) : null
  const q = priceCart({
    points: loyal?.on ? { balance: loyal.balance, maxPct: loyal.maxUsePct } : undefined, usePoints: !!req.usePoints,
    lines, products, promo, promoCode: req.promo?.trim() || undefined, isFirstOrder: await isFirstOrder(phone), bundles,
    delivery: req.delivery === 'region' ? 'region' : 'tashkent', gift: !!req.gift,
    store: { freeDeliveryFrom: store.freeDeliveryFrom, tashkentPrice: store.tashkentPrice, regionPrice: store.regionPrice, giftBoxPrice: store.giftBoxPrice },
  })
  // one suggestion (p_spec.py): cheapest fitting SPF/toner not in the cart
  let suggest: (Priced & { reason: 'spf' | 'toner' }) | null = null
  if (q.lines.length) {
    const p = await payload()
    const cats = q.lines.map((l) => products.get(l.sku)?.category ?? '')
    const pool = await p.find({ collection: 'products', where: { 'category.slug': { in: ['spf', 'toner'] } }, locale: lang, depth: 1, limit: 50 })
    const cands = pool.docs.flatMap((pr) => pr.variants.slice(0, 1).map((v) => ({
      sku: v.sku, slug: pr.slug, brand: typeof pr.brand === 'object' ? pr.brand.name : '', name: pr.name, img: thumb((pr.images?.[0] as Media | undefined)?.url, 480),
      volume: v.volume ?? undefined, price: v.price, stock: v.stock ?? 0, category: typeof pr.category === 'object' ? pr.category.slug : '',
    }))).filter((c) => !skus.includes(c.sku))
    const s = suggestion(cats, cands, q.subtotal)
    if (s) suggest = { ...s.item, reason: s.reason }
  }
  return { quote: q, suggest, freeFrom: store.freeDeliveryFrom }
}

export type OrderRequest = CartRequest & {
  lang: Lang; name: string; phone: string; telegramUpdates?: boolean; city?: string; address: string; slot?: string; comment?: string
  payment: 'click' | 'payme' | 'card'; consent: boolean
  /** where the customer came from (first-party cookies, see readCookies in lib/analytics-ingest.ts) */
  attribution?: Pick<ReturnType<typeof readCookies>, 'visitor' | 'session' | 'src' | 'med' | 'cmp' | 'landing'>
}

export class OrderError extends Error {
  constructor(public code: string) { super(code) }
}

const clean = (s: unknown, max = 300) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '')

/** Validates, prices on the server and stores the order (status new, payment pending). */
export async function createOrder(req: OrderRequest): Promise<{ order: Order; quote: Quote }> {
  const name = clean(req.name, 80)
  const phone = normalizePhone(clean(req.phone, 30))
  const address = clean(req.address, 300)
  if (!name) throw new OrderError('name')
  if (!phone) throw new OrderError('phone')
  if (!address) throw new OrderError('address')
  if (!req.consent) throw new OrderError('consent')
  if (!['click', 'payme', 'card'].includes(req.payment)) throw new OrderError('payment')
  const { quote } = await quoteCart({ ...req, phone }, req.lang)
  if (!quote.lines.length) throw new OrderError('empty')
  if (quote.missing.length) throw new OrderError('missing')
  if (req.promo && quote.promoError) throw new OrderError(`promo_${quote.promoError}`)
  const p = await payload()
  const token = crypto.randomBytes(16).toString('hex')
  const draft = await p.create({
    collection: 'orders', overrideAccess: true,
    data: {
      number: `T${crypto.randomBytes(4).toString('hex')}`, token, lang: req.lang, status: 'new', paymentStatus: 'pending', payment: req.payment,
      name, phone, telegramUpdates: req.telegramUpdates !== false, delivery: quote.delivery, city: clean(req.city, 80), address,
      slot: clean(req.slot, 20), comment: clean(req.comment, 500), gift: !!req.gift,
      items: quote.lines.map((l) => ({ sku: l.sku, slug: l.slug, brand: l.brand, name: l.name, volume: l.volume, img: l.img, price: l.price, qty: l.qty })),
      src: req.attribution?.src ?? undefined, med: req.attribution?.med ?? undefined, cmp: req.attribution?.cmp ?? undefined,
      landing: req.attribution?.landing ?? undefined, visitor: req.attribution?.visitor ?? undefined, session: req.attribution?.session ?? undefined,
      subtotal: quote.subtotal, discount: quote.discount, discountLabel: quote.discountLabel, deliveryFee: quote.deliveryFee, giftFee: quote.giftFee, total: quote.total, pointsUsed: quote.pointsUsed,
    },
  })
  // short human number from the id: 10001, 10002 …
  const order = await p.update({ collection: 'orders', id: draft.id, overrideAccess: true, data: { number: String(10000 + Number(draft.id)) } })
  await recordOrderEvent('order_created', order)
  return { order, quote }
}

export async function getOrder(number: string, token: string) {
  const p = await payload()
  const o = (await p.find({ collection: 'orders', where: { number: { equals: number } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  if (!o || !token || !crypto.timingSafeEqual(Buffer.from(o.token.padEnd(64)), Buffer.from(token.padEnd(64).slice(0, 64)))) return null
  return o
}

export async function orderByNumber(number: string) {
  const p = await payload()
  return (await p.find({ collection: 'orders', where: { number: { equals: number } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] ?? null
}

type Pool = { query: (sql: string, params: unknown[]) => Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }> }
/** Plain SQL for the two places that must be atomic (Payload's own update reads, then writes). */
const pool = (p: Awaited<ReturnType<typeof payload>>) => (p.db as unknown as { pool: Pool }).pool

/** The only way an order becomes "paid": called from a provider callback that the server verified. Idempotent. */
export async function markPaid(orderId: number, provider: 'click' | 'payme') {
  const p = await payload()
  const db = pool(p)
  // of two callbacks that arrive together only one gets the row: stock and certificates are handled exactly once
  const claim = await db.query(`UPDATE orders SET payment_status = 'paid' WHERE id = $1 AND payment_status <> 'paid' RETURNING id`, [orderId])
  const o = await p.findByID({ collection: 'orders', id: orderId, overrideAccess: true, depth: 0 })
  if (!claim.rowCount) return o
  const paid = await p.update({ collection: 'orders', id: orderId, overrideAccess: true, data: { paymentStatus: 'paid', status: 'accepted', paidAt: new Date().toISOString() } })
  // stock: one UPDATE per line, so simultaneous orders cannot both take the last item unnoticed
  const short: string[] = []
  for (const it of o.items) {
    const r = await db.query('UPDATE products_variants SET stock = COALESCE(stock, 0) - $1 WHERE sku = $2 RETURNING stock', [it.qty, it.sku])
    if (r.rows.some((row) => Number(row.stock) < 0)) {
      short.push(`${it.brand ?? ''} ${it.name}`.trim())
      await db.query('UPDATE products_variants SET stock = 0 WHERE sku = $1 AND stock < 0', [it.sku])
    }
  }
  // gift certificates: issue codes for bought ones, spend the balance of a redeemed one
  const issued: string[] = []
  for (const it of o.items) {
    const m = it.sku.match(/^GC-(\d+)-(TG|CARD)$/)
    if (!m) continue
    for (let n = 0; n < it.qty; n++) {
      const code = `YP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
      await p.create({ collection: 'gift-cards', overrideAccess: true, data: { code, amount: Number(m[1]), balance: Number(m[1]), orderNumber: o.number, form: m[2] === 'TG' ? 'tg' : 'card', validTo: new Date(Date.now() + 365 * 86_400_000).toISOString() } })
      issued.push(code)
    }
  }
  if (o.discountLabel && o.discount) {
    await db.query('UPDATE gift_cards SET balance = GREATEST(0, balance - $1) WHERE code = $2', [o.discount, o.discountLabel])
  }
  await recordOrderEvent('purchase', o)
  await notifyAdmins(`💳 Toʻlandi (${provider}) — buyurtma №${o.number}\n${o.items.map((i) => `• ${i.brand} ${i.name}${i.volume ? ` ${i.volume}` : ''} × ${i.qty}`).join('\n')}\nJami: ${o.total.toLocaleString('ru-RU')} soʻm\n${o.name}, +${o.phone}\n${o.delivery === 'tashkent' ? 'Toshkent' : 'Viloyat'}: ${o.city ? `${o.city}, ` : ''}${o.address}${o.slot ? `, ${o.slot}` : ''}${o.gift ? '\n🎁 Sovgʻa qutisi' : ''}${issued.length ? `\n🎟 Sertifikat kodlari: ${issued.join(', ')}` : ''}${o.comment ? `\nIzoh: ${o.comment}` : ''}${short.length ? `\n⚠️ Omborda yetmadi: ${short.join(', ')}. Mijoz bilan bogʻlaning.` : ''}`)
  return paid
}

/** A new payment attempt starts on an order whose previous attempt failed: it is waiting for payment again. */
export async function reopenPayment(orderId: number) {
  await pool(await payload()).query(`UPDATE orders SET payment_status = 'pending' WHERE id = $1 AND payment_status = 'cancelled'`, [orderId])
}

/** A payment attempt ended without success. `wasPaid`: this very transaction had taken the money (a refund). */
export async function markPaymentCancelled(orderId: number, wasPaid = false) {
  const p = await payload()
  if (wasPaid) {
    // money was taken and is being returned: the admin decides (HANDOFF: refunds are a human decision)
    const o = await p.update({ collection: 'orders', id: orderId, overrideAccess: true, data: { paymentStatus: 'refund' } })
    await notifyAdmins(`↩️ Toʻlov bekor qilindi — buyurtma №${o.number}. Qaytarishni tekshiring.`)
    return
  }
  // an abandoned attempt never touches an order that another transaction has already paid
  await pool(p).query(`UPDATE orders SET payment_status = 'cancelled' WHERE id = $1 AND payment_status = 'pending'`, [orderId])
}
