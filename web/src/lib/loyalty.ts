// Bonus points (1 point = 1 soʻm). Balance is derived from orders, never stored separately:
// earned on delivered paid orders − spent on orders that still hold them (lib/order-state.ts). Tier = lifetime
// delivered spending. Expiry (Store.loyalty.expireMonths): after that many months without a paid order the points
// collected so far are burned; the next order starts from zero.
import type { BasePayload } from 'payload'

import type { Order, Store } from '@/payload-types'
import { holds } from './order-state'

type Tier = NonNullable<NonNullable<Store['loyalty']>['tiers']>[number]
export const tierFor = (tiers: Tier[], spent: number) => [...tiers].sort((a, b) => (b.from ?? 0) - (a.from ?? 0)).find((t) => spent >= (t.from ?? 0)) ?? null

export type PointOrder = Pick<Order, 'createdAt' | 'status' | 'paymentStatus' | 'pointsUsed' | 'pointsEarned'>

const addMonths = (ms: number, months: number) => { const d = new Date(ms); d.setUTCMonth(d.getUTCMonth() + months); return d.getTime() }

/** Points left today and when they burn (null = never / nothing to burn). Pure: orders in, numbers out. */
export function pointsBalance(os: PointOrder[], expireMonths?: number | null, now = Date.now()): { balance: number; expiresAt: string | null } {
  const months = expireMonths && expireMonths > 0 ? expireMonths : 0
  let balance = 0
  let lastPurchase: number | null = null
  for (const o of [...os].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
    const at = new Date(o.createdAt).getTime()
    // too long since the previous purchase: what was collected before this order is gone
    if (months && lastPurchase !== null && at > addMonths(lastPurchase, months)) balance = 0
    if (holds(o, now)) balance -= o.pointsUsed ?? 0
    if (o.paymentStatus === 'paid' && o.status !== 'cancelled') {
      balance += o.pointsEarned ?? 0
      lastPurchase = at
    }
  }
  const burnsAt = months && lastPurchase !== null ? addMonths(lastPurchase, months) : null
  if (burnsAt !== null && now > burnsAt) balance = 0
  balance = Math.max(0, balance)
  return { balance, expiresAt: balance > 0 && burnsAt !== null ? new Date(burnsAt).toISOString() : null }
}

async function orders(p: BasePayload, phone: string) {
  return (await p.find({ collection: 'orders', where: { phone: { equals: phone } }, depth: 0, limit: 500, pagination: false, overrideAccess: true,
    select: { createdAt: true, total: true, deliveryFee: true, giftFee: true, status: true, paymentStatus: true, pointsUsed: true, pointsEarned: true } })).docs
}
const goods = (o: Pick<Order, 'total' | 'deliveryFee' | 'giftFee'>) => o.total - (o.deliveryFee ?? 0) - (o.giftFee ?? 0)

export async function loyaltyOf(p: BasePayload, phone: string, locale: 'uz' | 'ru' = 'uz') {
  const store = await p.findGlobal({ slug: 'store', depth: 0, locale })
  const tiers = store.loyalty?.tiers ?? []
  const os = await orders(p, phone)
  const spent = os.filter((o) => o.status === 'delivered' && o.paymentStatus === 'paid').reduce((a, o) => a + goods(o), 0)
  const { balance, expiresAt } = pointsBalance(os, store.loyalty?.expireMonths)
  const tier = tierFor(tiers, spent)
  const next = [...tiers].sort((a, b) => (a.from ?? 0) - (b.from ?? 0)).find((t) => (t.from ?? 0) > spent) ?? null
  return { on: tiers.length > 0, balance, expiresAt, spent, tier, next, maxUsePct: store.loyalty?.maxUsePct ?? 30 }
}

/** Points for one order at the moment it is delivered: the tier reached before it × goods paid. */
export async function earnedFor(p: BasePayload, o: Pick<Order, 'phone' | 'total' | 'deliveryFee' | 'giftFee'>) {
  const l = await loyaltyOf(p, o.phone)
  return l.on && l.tier ? Math.floor((goods(o) * l.tier.percent) / 100) : 0
}
