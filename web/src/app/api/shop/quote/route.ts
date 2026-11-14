import { NextResponse } from 'next/server'

import { isLang } from '@/lib/i18n'
import { quoteCart } from '@/lib/orders'

// Cart pricing for the cart/checkout pages. Input: SKUs + quantities (+ promo, delivery, gift). Prices come from the DB.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.lines)) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const lang = isLang(body.lang) ? body.lang : 'uz'
  return NextResponse.json(await quoteCart(body, lang))
}
