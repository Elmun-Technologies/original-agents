// Pure rules about what state an order is in for payment. Shared by the payment handlers, bonus points,
// gift certificates and the order page, so they can never disagree.
import type { Order } from '@/payload-types'

/** An order can be paid for 12 hours after it is placed (same as the providers' own checkout timeout). */
export const PAY_WINDOW_MS = 12 * 3_600_000
/** A provider transaction opened at the end of the window may still be performed for another 12 hours, so points
 * and certificate balance reserved by an unpaid order stay reserved for both periods. */
export const HOLD_MS = 2 * PAY_WINDOW_MS

type State = Pick<Order, 'status' | 'paymentStatus' | 'createdAt'>
const age = (o: State, now: number) => now - new Date(o.createdAt).getTime()
/** not paid, and the shop has not cancelled it. A failed attempt (payment "cancelled") may be tried again. */
const open = (o: State) => o.status === 'new' && (o.paymentStatus === 'pending' || o.paymentStatus === 'cancelled')

/** A new payment may be started for this order. */
export const payable = (o: State, now = Date.now()) => open(o) && age(o, now) < PAY_WINDOW_MS

/** The order still reserves the bonus points / certificate balance it was priced with. */
export const holds = (o: State, now = Date.now()) =>
  o.status !== 'cancelled' && (o.paymentStatus === 'paid' || o.paymentStatus === 'refund' || (open(o) && age(o, now) < HOLD_MS))
