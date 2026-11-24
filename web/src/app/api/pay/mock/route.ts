import { NextResponse } from 'next/server'

import { getOrder } from '@/lib/orders'
import { clickMockPay } from '@/lib/payments/click'
import { paymentsMode } from '@/lib/payments/config'
import { paymeMockPay } from '@/lib/payments/payme'

// Test payments (only while the payment mode is "Sinov"): replays the provider's own calls with valid signatures.
export async function POST(req: Request) {
  if ((await paymentsMode()) !== 'mock') return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const b = await req.json().catch(() => ({}))
  const order = await getOrder(String(b.o ?? ''), String(b.t ?? ''))
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const pay = b.ok !== false
  const result = b.p === 'click' ? await clickMockPay(order.number, order.total, pay) : await paymeMockPay(order.number, order.total, pay)
  return NextResponse.json({ result })
}
