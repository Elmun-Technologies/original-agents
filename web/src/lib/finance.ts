import 'server-only'

import { EXPENSE_CATEGORIES } from '@/collections/finance'
import { payload } from '@/lib/catalog'
import type { Run } from './analytics'

// Admin → Moliya hisoboti: money in (what customers paid) next to money out (purchase price of what was sold,
// payment fees, and the expenses the owner entered), month by month or day by day, in Tashkent time.
// Plain income / expense lines and what is left — no ratios.

export type Period = { key: string; label: string; from: Date; to: Date }
export type Line = { id: string; label: string; values: number[]; hint?: string }
export type Report = {
  periods: Period[]
  income: Line[]; incomeTotal: number[]
  expense: Line[]; expenseTotal: number[]
  left: number[]
  /** sold items with no purchase price: profit is overstated by their cost */
  noCost: { items: number; revenue: number }
  feeMissing: boolean
  channels: { channel: string; spent: number; revenue: number; orders: number }[]
}

const TZ_MS = 5 * 3_600_000
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']

/** the last `n` months (Tashkent calendar), oldest first; the current month is the last one */
export function lastMonths(n: number, now = Date.now()): Period[] {
  const t = new Date(now + TZ_MS)
  const out: Period[] = []
  for (let i = n - 1; i >= 0; i--) {
    const y = t.getUTCFullYear(), m = t.getUTCMonth() - i
    const from = new Date(Date.UTC(y, m, 1) - TZ_MS), to = new Date(Date.UTC(y, m + 1, 1) - TZ_MS)
    const d = new Date(Date.UTC(y, m, 1))
    out.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, from, to })
  }
  return out
}

/** every day of one month "YYYY-MM" (Tashkent calendar); days after today are left out */
export function daysOf(month: string, now = Date.now()): Period[] {
  const [y, m] = month.split('-').map(Number)
  const out: Period[] = []
  for (let d = 1; d <= 31; d++) {
    const day = new Date(Date.UTC(y, m - 1, d))
    if (day.getUTCMonth() !== m - 1) break
    const from = new Date(day.getTime() - TZ_MS)
    if (from.getTime() > now) break
    out.push({ key: day.toISOString().slice(0, 10), label: `${d}-${MONTHS[m - 1].slice(0, 3)}`, from, to: new Date(from.getTime() + 86_400_000) })
  }
  return out
}

const idx = (periods: Period[], at: Date) => periods.findIndex((p) => at >= p.from && at < p.to)
const zeros = (n: number) => Array.from({ length: n }, () => 0)
const sum = (lines: Line[], n: number) => zeros(n).map((_, i) => lines.reduce((a, l) => a + l.values[i], 0))

export type Raw = {
  orders: { paid_at: Date | string; total: number; delivery_fee: number; payment: string; payment_status: string; src: string | null; cost: number; no_cost_items: number; no_cost_revenue: number }[]
  expenses: { date: Date | string; category: string; amount: number; channel: string | null }[]
  fees: { click: number | null; payme: number | null }
  cardProvider: 'click' | 'payme'
}

/** pure: the report from the raw rows (tested without a database) */
export function buildReport(periods: Period[], raw: Raw): Report {
  const n = periods.length
  const sales = zeros(n), refunds = zeros(n), cogs = zeros(n), fees = zeros(n)
  let noCostItems = 0, noCostRevenue = 0, feeMissing = false
  const byChannel = new Map<string, { spent: number; revenue: number; orders: number }>()
  const ch = (k: string) => { const key = k.trim().toLowerCase() || 'sayt'; if (!byChannel.has(key)) byChannel.set(key, { spent: 0, revenue: 0, orders: 0 }); return byChannel.get(key)! }
  for (const o of raw.orders) {
    const i = idx(periods, new Date(o.paid_at))
    if (i < 0) continue
    const total = Number(o.total) || 0
    sales[i] += total
    if (o.payment_status === 'refund') refunds[i] += total // to be returned to the customer: no money in
    else {
      cogs[i] += Number(o.cost) || 0
      noCostItems += Number(o.no_cost_items) || 0
      noCostRevenue += Number(o.no_cost_revenue) || 0
      const provider = o.payment === 'card' ? raw.cardProvider : o.payment
      const pct = provider === 'click' ? raw.fees.click : raw.fees.payme
      if (pct == null) feeMissing = true
      else fees[i] += Math.round((total * pct) / 100)
      const c = ch(o.src ?? ''); c.revenue += total; c.orders++
    }
  }
  const cats = new Map<string, number[]>(EXPENSE_CATEGORIES.map((c) => [c.value, zeros(n)]))
  for (const e of raw.expenses) {
    const i = idx(periods, new Date(e.date))
    if (i < 0) continue
    const amount = Number(e.amount) || 0
    ;(cats.get(e.category) ?? cats.get('other')!)[i] += amount
    if (e.category === 'ads') ch(e.channel ?? 'reklama').spent += amount
  }
  const income: Line[] = [
    { id: 'sales', label: 'Mijozlar toʻlagan pul', values: sales, hint: 'Toʻlangan buyurtmalar (yetkazish va sovgʻa qutisi bilan), toʻlangan kun boʻyicha' },
    ...(refunds.some(Boolean) ? [{ id: 'refunds', label: 'Mijozga qaytariladigan pul', values: refunds.map((v) => -v), hint: 'Buyurtma «Qaytarish kerak» holatida' }] : []),
  ]
  const expense: Line[] = [
    { id: 'cogs', label: 'Sotilgan tovar tannarxi', values: cogs, hint: 'Mahsulot kartasidagi «Tannarx» × sotilgan dona' },
    { id: 'fees', label: 'Toʻlov tizimi komissiyasi', values: fees, hint: 'Moliya sozlamalaridagi Click/Payme foizi' },
    ...EXPENSE_CATEGORIES.map((c) => ({ id: c.value, label: c.label, values: cats.get(c.value)! })).filter((l) => l.values.some(Boolean) || l.id === 'ads' || l.id === 'delivery'),
  ]
  const incomeTotal = sum(income, n), expenseTotal = sum(expense, n)
  return {
    periods, income, incomeTotal, expense, expenseTotal, left: incomeTotal.map((v, i) => v - expenseTotal[i]),
    noCost: { items: noCostItems, revenue: noCostRevenue }, feeMissing,
    channels: [...byChannel.entries()].map(([channel, v]) => ({ channel, ...v })).sort((a, b) => b.spent + b.revenue - (a.spent + a.revenue)),
  }
}

export async function financeReport(run: Run, periods: Period[]): Promise<Report> {
  const from = periods[0].from, to = periods[periods.length - 1].to
  // cost of an item: the price saved on the order at the moment of sale, else the product's cost today
  const orders = await run(`SELECT o.paid_at, o.total, o.delivery_fee, o.payment, o.payment_status, o.src,
      coalesce(sum(coalesce(i.cost, v.cost, 0) * i.qty), 0) cost,
      coalesce(sum(i.qty) FILTER (WHERE i.cost IS NULL AND v.cost IS NULL), 0) no_cost_items,
      coalesce(sum(i.price * i.qty) FILTER (WHERE i.cost IS NULL AND v.cost IS NULL), 0) no_cost_revenue
    FROM orders o LEFT JOIN orders_items i ON i._parent_id = o.id LEFT JOIN LATERAL (SELECT pv.cost FROM products_variants pv WHERE pv.sku = i.sku AND pv.cost IS NOT NULL LIMIT 1) v ON true
    WHERE o.payment_status IN ('paid', 'refund') AND o.paid_at >= $1 AND o.paid_at < $2
    GROUP BY o.id`, [from, to])
  const expenses = await run(`SELECT date, category, amount, channel FROM expenses WHERE date >= $1 AND date < $2`, [from, to])
  const p = await payload()
  const fin = (await p.findGlobal({ slug: 'finance', depth: 0, overrideAccess: true })) as unknown as { clickFeePct?: number | null; paymeFeePct?: number | null }
  const { integrations } = await import('@/lib/integrations')
  const v = await integrations()
  return buildReport(periods, {
    orders: orders as Raw['orders'], expenses: expenses as Raw['expenses'],
    fees: { click: fin.clickFeePct ?? null, payme: fin.paymeFeePct ?? null }, cardProvider: v.cardProvider === 'click' ? 'click' : 'payme',
  })
}

/** the report as a spreadsheet (UTF-8 with BOM, opens in Excel) */
export function reportCsv(r: Report) {
  const cell = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`
  const row = (label: string, vals: number[]) => [label, ...vals].map(cell).join(',')
  return '﻿' + [
    ['', ...r.periods.map((p) => p.label)].map(cell).join(','),
    row('KIRIM', r.periods.map(() => 0)).replace(/,"0"/g, ',""'),
    ...r.income.map((l) => row(l.label, l.values)),
    row('Kirim jami', r.incomeTotal),
    row('CHIQIM', r.periods.map(() => 0)).replace(/,"0"/g, ',""'),
    ...r.expense.map((l) => row(l.label, l.values)),
    row('Chiqim jami', r.expenseTotal),
    row('QOLDI (kirim − chiqim)', r.left),
  ].join('\r\n')
}
