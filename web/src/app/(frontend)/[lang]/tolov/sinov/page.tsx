// Test payment page (PAYMENTS_MODE=mock): stands in for the Click / Payme hosted page until the accounts exist.
import { notFound } from 'next/navigation'

import { MockPay } from '@/components/checkout/MockPay'
import { isLang } from '@/lib/i18n'
import { getOrder } from '@/lib/orders'
import { paymentsMode } from '@/lib/payments/config'

// reads searchParams on every request (the layout is ISR otherwise)
export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false } }

export default async function MockPayPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { lang } = await params
  const sp = await searchParams
  if (!isLang(lang) || paymentsMode() !== 'mock') notFound()
  const order = await getOrder(sp.o ?? '', sp.t ?? '')
  if (!order) notFound()
  return <MockPay lang={lang} number={order.number} token={order.token} total={order.total} provider={sp.p === 'click' ? 'click' : 'payme'} paid={order.paymentStatus === 'paid'} />
}
