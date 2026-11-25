import { NextResponse } from 'next/server'

import { readCookies } from '@/lib/analytics-ingest'
import { isLang } from '@/lib/i18n'
import { createOrder, OrderError } from '@/lib/orders'
import { payUrl } from '@/lib/payments'

// ponytail: no rate limit yet; add one (per IP, e.g. 10/min) before ads bring traffic
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.lines)) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  try {
    const { visitor, session, src, med, cmp, landing } = readCookies(req.headers.get('cookie'))
    const { order } = await createOrder({ ...body, lang: isLang(body.lang) ? body.lang : 'uz', attribution: { visitor, session, src, med, cmp, landing } })
    return NextResponse.json({ number: order.number, token: order.token, payUrl: await payUrl(order) })
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.code }, { status: 422 })
    throw e
  }
}
