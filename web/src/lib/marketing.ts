import 'server-only'

import { payload } from '@/lib/catalog'
import type { Run } from './analytics'

// Marketing tools built from what the shop already knows: unfinished orders, who bought how often, which promo
// codes worked. No new data is collected. Customer lists contain phone numbers: admin screens only.

const DAY = 86_400_000

export type Abandoned = { id: number | string; number: string; name: string; phone: string; city: string; total: number; at: string; items: string; lang: 'uz' | 'ru'; link: string | null; src: string; ageHours: number }

/** Orders that were started but not paid. The pay link works only inside the 12-hour payment window. */
export async function abandonedOrders(now = Date.now()): Promise<Abandoned[]> {
  const p = await payload()
  const r = await p.find({ collection: 'orders', depth: 0, limit: 150, sort: '-createdAt', overrideAccess: true,
    where: { and: [{ paymentStatus: { in: ['pending', 'cancelled'] } }, { status: { equals: 'new' } }, { createdAt: { less_than: new Date(now - 15 * 60_000).toISOString() } }, { createdAt: { greater_than: new Date(now - 14 * DAY).toISOString() } }] } })
  return r.docs.map((o) => {
    const age = now - new Date(o.createdAt).getTime()
    return {
      id: o.id, number: o.number, name: o.name, phone: o.phone, city: o.city ?? '', total: o.total, at: o.createdAt, lang: o.lang === 'ru' ? 'ru' : 'uz', ageHours: Math.round(age / 3_600_000),
      items: o.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', '), src: [o.src, o.cmp].filter(Boolean).join(' / '),
      link: age < 12 * 3_600_000 ? `/${o.lang === 'ru' ? 'ru' : 'uz'}/buyurtma/${o.number}?t=${o.token}` : null,
    }
  })
}

export type Customer = { phone: string; name: string; orders: number; spent: number; first: string; last: string; segments: string[] }
export const SEGMENTS: Record<string, { label: string; hint: string }> = {
  new: { label: 'Yangi', hint: 'Bitta buyurtma, oxirgi 30 kunda. Ikkinchi xaridga undang: kichik chegirma yoki foydali maslahat.' },
  repeat: { label: 'Doimiy', hint: '3 va undan koʻp buyurtma. Ularni yangi mahsulotlardan birinchi xabardor qiling.' },
  vip: { label: 'VIP', hint: '1 500 000 soʻmdan koʻp xarid qilganlar. Shaxsiy minnatdorchilik, sovgʻa.' },
  lapsed: { label: 'Qaytmagan', hint: 'Oxirgi xaridi 45 kundan oldin. Qaytarish vaqti: «sizga yoqqan krem tugayotgan boʻlishi mumkin».' },
  once: { label: 'Bir martalik', hint: 'Bitta buyurtma va 45 kundan beri jim. Eng arzon qaytarish usuli — promokod bilan eslatma.' },
}

/** which groups a customer belongs to (a customer may be in several) */
export function segmentsOf(c: { orders: number; spent: number; last: string }, now = Date.now()): string[] {
  const idle = (now - new Date(c.last).getTime()) / DAY
  const s: string[] = []
  if (c.orders === 1 && idle <= 30) s.push('new')
  if (c.orders >= 3) s.push('repeat')
  if (c.spent >= 1_500_000) s.push('vip')
  if (idle > 45) s.push('lapsed')
  if (c.orders === 1 && idle > 45) s.push('once')
  return s
}

export async function customers(run: Run, now = Date.now()): Promise<Customer[]> {
  const rows = await run(`SELECT phone, max(name) name, count(*) n, sum(total) spent, min(paid_at) first, max(paid_at) last FROM orders
    WHERE payment_status = 'paid' AND paid_at IS NOT NULL GROUP BY phone ORDER BY max(paid_at) DESC LIMIT 5000`)
  return rows.map((r) => {
    const c = { phone: String(r.phone), name: String(r.name ?? ''), orders: Number(r.n), spent: Number(r.spent), first: new Date(r.first).toISOString(), last: new Date(r.last).toISOString() }
    return { ...c, segments: segmentsOf(c, now) }
  })
}

/** a spreadsheet cell that cannot run as a formula (=, +, -, @ at the start) and cannot break the row */
export const csvCell = (v: unknown) => {
  let s = String(v ?? '').replace(/\r?\n/g, ' ')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
export const toCsv = (rows: Customer[]) =>
  '﻿' + ['Telefon,Ism,Buyurtmalar,Jami soʻm,Birinchi xarid,Oxirgi xarid,Guruhlar', ...rows.map((c) =>
    [c.phone, c.name, c.orders, c.spent, c.first.slice(0, 10), c.last.slice(0, 10), c.segments.map((s) => SEGMENTS[s].label).join(' / ')].map(csvCell).join(','))].join('\r\n')

export type Waiting = { sku: string; name: string; volume: string; people: number; stock: number }
/** what customers are waiting for (pressed "Kelganda xabar berish"): the clearest restock signal there is */
export async function waitingDemand(run: Run): Promise<Waiting[]> {
  const rows = await run(`SELECT w.sku, count(*) n, max(p.name) name, max(v.volume) volume, coalesce(max(v.stock), 0) stock FROM waitlist w
    LEFT JOIN products_variants v ON v.sku = w.sku LEFT JOIN products p ON p.id = v._parent_id GROUP BY w.sku ORDER BY count(*) DESC LIMIT 100`)
  return rows.map((r) => ({ sku: String(r.sku), name: String(r.name ?? r.sku), volume: String(r.volume ?? ''), people: Number(r.n), stock: Number(r.stock) }))
}

export type PromoRow = { code: string; orders: number; discount: number; revenue: number }
export async function promoResults(run: Run, from: Date, to: Date): Promise<PromoRow[]> {
  const rows = await run(`SELECT discount_label l, count(*) n, sum(discount) d, sum(total) t FROM orders WHERE payment_status = 'paid' AND discount > 0
    AND paid_at >= $1 AND paid_at < $2 GROUP BY 1 ORDER BY 2 DESC LIMIT 30`, [from, to])
  return rows.map((r) => ({ code: String(r.l ?? '—'), orders: Number(r.n), discount: Number(r.d), revenue: Number(r.t) }))
}

export { trackedLink } from './tracked-link'
