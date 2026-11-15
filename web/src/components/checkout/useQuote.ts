'use client'
// Server pricing for the cart/checkout (POST /api/shop/quote). The browser cart only holds SKUs + quantities;
// prices shown here always come from the server and the local copy is synced to them.
import { useEffect, useRef, useState } from 'react'

import { useShop } from '@/components/shop'
import type { Lang } from '@/lib/i18n'
import type { Priced, Quote } from '@/lib/pricing'

export type QuoteResponse = { quote: Quote; suggest: (Priced & { reason: 'spf' | 'toner' }) | null; freeFrom: number }

export function useQuote(lang: Lang, opts: { delivery?: 'tashkent' | 'region'; gift?: boolean; usePoints?: boolean; phone?: string } = {}) {
  const shop = useShop()
  const [data, setData] = useState<QuoteResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)
  const key = JSON.stringify([shop.lines.map((l) => [l.sku, l.qty]), shop.promo, opts.delivery, opts.gift, opts.usePoints, opts.phone])
  useEffect(() => {
    const n = ++seq.current
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/shop/quote', {
          method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctl.signal,
          body: JSON.stringify({ lang, lines: shop.lines.map((l) => ({ sku: l.sku, qty: l.qty })), promo: shop.promo || undefined, ...opts }),
        })
        const d: QuoteResponse = await r.json()
        if (n !== seq.current) return
        setData(d)
        shop.sync(d.quote.lines, d.quote.missing)
      } catch {} finally {
        if (n === seq.current) setLoading(false)
      }
    }, 150)
    return () => { clearTimeout(t); ctl.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every input
  }, [key, lang])
  return { data, loading }
}
