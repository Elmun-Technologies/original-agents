import { describe, expect, it } from 'vitest'

import { pointsBalance, type PointOrder } from '@/lib/loyalty'
import { holds, payable, PAY_WINDOW_MS } from '@/lib/order-state'

const NOW = Date.parse('2026-06-01T10:00:00Z')
const DAY = 86_400_000
const o = (daysAgo: number, x: Partial<PointOrder> = {}): PointOrder =>
  ({ createdAt: new Date(NOW - daysAgo * DAY).toISOString(), status: 'delivered', paymentStatus: 'paid', pointsUsed: 0, pointsEarned: 0, ...x })

describe('order state', () => {
  const at = (hoursAgo: number, x: object = {}) => ({ status: 'new' as const, paymentStatus: 'pending' as const, createdAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(), ...x })
  it('a new order can be paid for 12 hours', () => {
    expect(payable(at(1), NOW)).toBe(true)
    expect(payable(at(11.9), NOW)).toBe(true)
    expect(payable(at(12.1), NOW)).toBe(false)
    expect(PAY_WINDOW_MS).toBe(12 * 3_600_000)
  })
  it('a failed attempt can be retried, a paid or shop-cancelled order cannot', () => {
    expect(payable(at(1, { paymentStatus: 'cancelled' }), NOW)).toBe(true)
    expect(payable(at(1, { paymentStatus: 'paid' }), NOW)).toBe(false)
    expect(payable(at(1, { status: 'cancelled' }), NOW)).toBe(false)
  })
  it('points stay reserved while a late transaction may still be performed (24 h), then return', () => {
    expect(holds(at(13), NOW)).toBe(true)
    expect(holds(at(25), NOW)).toBe(false)
    expect(holds(at(100, { paymentStatus: 'paid', status: 'accepted' }), NOW)).toBe(true)
    expect(holds(at(1, { status: 'cancelled' }), NOW)).toBe(false)
  })
})

describe('bonus points balance', () => {
  it('earned minus spent', () => {
    expect(pointsBalance([o(30, { pointsEarned: 9000 }), o(10, { pointsEarned: 6000, pointsUsed: 4000 })], null, NOW)).toEqual({ balance: 11000, expiresAt: null })
  })
  it('an unpaid order holds its points only inside the window', () => {
    const paid = o(30, { pointsEarned: 9000 })
    const fresh = o(0.1, { status: 'new', paymentStatus: 'pending', pointsUsed: 5000 })
    const stale = o(3, { status: 'new', paymentStatus: 'pending', pointsUsed: 5000 })
    expect(pointsBalance([paid, fresh], null, NOW).balance).toBe(4000)
    expect(pointsBalance([paid, stale], null, NOW).balance).toBe(9000)
  })
  it('a cancelled order gives back what it used and earns nothing', () => {
    expect(pointsBalance([o(30, { pointsEarned: 9000 }), o(5, { status: 'cancelled', pointsUsed: 3000, pointsEarned: 7000 })], null, NOW).balance).toBe(9000)
  })
  it('never negative', () => expect(pointsBalance([o(1, { pointsUsed: 500 })], null, NOW).balance).toBe(0))

  it('no expiry rule: old points stay', () => expect(pointsBalance([o(900, { pointsEarned: 1000 })], null, NOW).balance).toBe(1000))
  it('expiry: points burn after N months without a purchase', () => {
    expect(pointsBalance([o(200, { pointsEarned: 1000 })], 6, NOW)).toEqual({ balance: 0, expiresAt: null })
    const live = pointsBalance([o(100, { pointsEarned: 1000 })], 6, NOW)
    expect(live.balance).toBe(1000)
    expect(live.expiresAt).toBe(new Date(Date.parse('2026-08-21T10:00:00Z')).toISOString()) // 100 days ago = 21 Feb, + 6 months
  })
  it('expiry: every purchase moves the date, a gap burns only what was collected before it', () => {
    // bought regularly: nothing burns
    expect(pointsBalance([o(400, { pointsEarned: 1000 }), o(250, { pointsEarned: 1000 }), o(100, { pointsEarned: 1000 })], 6, NOW).balance).toBe(3000)
    // a year of silence, then a new order: only the new points count
    expect(pointsBalance([o(500, { pointsEarned: 1000 }), o(20, { pointsEarned: 700 })], 6, NOW).balance).toBe(700)
  })
  it('an unpaid order does not move the expiry date', () => {
    expect(pointsBalance([o(200, { pointsEarned: 1000 }), o(0.1, { status: 'new', paymentStatus: 'pending' })], 6, NOW).balance).toBe(0)
  })
})
