'use client'
import { useEffect } from 'react'

type Tags = { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void; ym?: (id: string, ev: string, target?: string) => void; __ymId?: string }

/** Tells the connected Google / Meta / Yandex tags that this order was paid, once per order (also after a reload). */
export function PurchasePixels({ number, total }: { number: string; total: number }) {
  useEffect(() => {
    const key = `yp_purchase_${number}`
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1') } catch { /* private mode: may repeat, the tags ignore a repeated transaction id */ }
    const w = window as unknown as Tags
    try {
      w.gtag?.('event', 'purchase', { transaction_id: number, value: total, currency: 'UZS' })
      w.fbq?.('track', 'Purchase', { value: total, currency: 'UZS' })
      if (w.__ymId) w.ym?.(w.__ymId, 'reachGoal', 'purchase')
    } catch { /* never break the order page */ }
  }, [number, total])
  return null
}
