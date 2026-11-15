// Bonus points (1 point = 1 soʻm). Balance is derived from orders, never stored separately:
// earned on delivered paid orders − spent on orders that were not cancelled. Tier = lifetime delivered spending.
// ponytail: expiry (Store.loyalty.expireMonths) is shown as a rule but not enforced yet; add when the first points get old.
import type { BasePayload } from 'payload'

import type { Order, Store } from '@/payload-types'

const PAY_WINDOW_MS = 12 * 3_600_000 // Payme/Click checkout timeout
type Tier = NonNullable<NonNullable<Store['loyalty']>['tiers']>[number]
export const tierFor = (tiers: Tier[], spent: number) => [...tiers].sort((a, b) => (b.from ?? 0) - (a.from ?? 0)).find((t) => spent >= (t.from ?? 0)) ?? null

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
  const earned = os.filter((o) => o.paymentStatus === 'paid').reduce((a, o) => a + (o.pointsEarned ?? 0), 0)
  // spent = paid orders + unpaid ones still inside the payment window (an abandoned checkout gives the points back)
  const windowStart = Date.now() - PAY_WINDOW_MS
  const used = os.filter((o) => o.status !== 'cancelled' && (o.paymentStatus === 'paid' || o.paymentStatus === 'refund'
    || (o.paymentStatus === 'pending' && new Date(o.createdAt).getTime() > windowStart))).reduce((a, o) => a + (o.pointsUsed ?? 0), 0)
  const tier = tierFor(tiers, spent)
  const next = [...tiers].sort((a, b) => (a.from ?? 0) - (b.from ?? 0)).find((t) => (t.from ?? 0) > spent) ?? null
  return { on: tiers.length > 0, balance: Math.max(0, earned - used), spent, tier, next, maxUsePct: store.loyalty?.maxUsePct ?? 30 }
}

/** Points for one order at the moment it is delivered: the tier reached before it × goods paid. */
export async function earnedFor(p: BasePayload, o: Pick<Order, 'phone' | 'total' | 'deliveryFee' | 'giftFee'>) {
  const l = await loyaltyOf(p, o.phone)
  return l.on && l.tier ? Math.floor((goods(o) * l.tier.percent) / 100) : 0
}
