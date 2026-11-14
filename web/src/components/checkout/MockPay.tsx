'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { fmt, sum } from '@/lib/format'
import { t, type Lang } from '@/lib/i18n'

export function MockPay({ lang, number, token, total, provider, paid }: { lang: Lang; number: string; token: string; total: number; provider: 'click' | 'payme'; paid: boolean }) {
  const tr = (s: string) => t(lang, s)
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = async (ok: boolean) => {
    setBusy(true)
    const r = await fetch('/api/pay/mock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ o: number, t: token, p: provider, ok }) })
    const d = await r.json().catch(() => ({}))
    const res = d.result
    if (ok && (res?.error && res.error !== -4 && !res.error?.code)) { setError(String(res.error_note ?? res.error)); setBusy(false); return }
    router.push(`/${lang}/buyurtma/${number}?t=${token}`)
  }
  return (
    <div className="wrap checkout-page" style={{ marginTop: '40px', maxWidth: '520px' }}>
      <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <span className="chip" style={{ alignSelf: 'flex-start', background: '#F5DCC9' }}>{tr('SINOV REJIMI — pul yechilmaydi')}</span>
        <b className="h" style={{ fontSize: '30px' }}>{provider === 'click' ? 'Click' : 'Payme'}</b>
        <span className="muted">{tr('Buyurtma')} № {number}</span>
        <span className="num" style={{ fontSize: '40px' }}>{fmt(total)} {sum(lang)}</span>
        <span className="muted" style={{ fontSize: '14px', lineHeight: 1.5 }}>{tr('Haqiqiy hisoblar ulanganda bu sahifa oʻrniga Click yoki Payme toʻlov sahifasi ochiladi.')}</span>
        {error && <span role="alert" style={{ color: '#A8475C' }}>{error}</span>}
        {paid ? <span style={{ color: '#2F5228' }}>{tr('Bu buyurtma allaqachon toʻlangan.')}</span> : null}
        <button className="pill dark" style={{ minHeight: '52px' }} disabled={busy} onClick={() => go(true)}>{tr('Toʻlash (sinov)')}</button>
        <button className="pill line" style={{ minHeight: '48px' }} disabled={busy} onClick={() => go(false)}>{tr('Bekor qilish')}</button>
      </div>
    </div>
  )
}
