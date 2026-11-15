'use client'
// Login — design/preview/Login.html. Phone + 4-digit SMS code (lib/customer.ts); own layout without the site chrome.
// Telegram login is left out: it gives no phone number, and orders/bonuses are tied to the phone.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { href, t, type Lang } from '@/lib/i18n'

const TICK = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>

export function LoginPage({ lang, next }: { lang: Lang; next: string }) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const router = useRouter()
  const [phone, setPhone] = useState('+998 ')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [err, setErr] = useState('')
  const [mock, setMock] = useState('')
  const [busy, setBusy] = useState(false)
  const post = (url: string, body: object) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const getCode = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    const r = await post('/api/auth/code', { phone }).then((x) => x.json()).catch(() => ({ ok: false }))
    setBusy(false)
    if (r.ok) { setStep('code'); setMock(r.mock ?? '') } else setErr(tr(r.error === 'phone' ? 'Raqamni toʻliq kiriting: +998 XX XXX XX XX' : r.error === 'too_soon' ? 'Kod yuborildi. Yangisini 1 daqiqadan keyin soʻrang.' : r.error === 'too_many' ? 'Bugun kodlar soni tugadi. Ertaga urinib koʻring yoki Telegramda yozing.' : 'SMS yuborilmadi. Birozdan keyin urinib koʻring.'))
  }
  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    const r = await post('/api/auth/verify', { phone, code }).catch(() => null)
    setBusy(false)
    if (r?.ok) { router.replace(next); router.refresh() } else setErr(tr('Kod notoʻgʻri yoki eskirgan'))
  }
  return (
    <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap' }}>
      <section style={{ flex: '1 1 560px', display: 'flex', flexDirection: 'column', padding: '40px clamp(16px, 5vw, 56px)', gap: '24px', boxSizing: 'border-box' }}>
        <Link href={L('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', font: "500 26px 'Inter Tight', sans-serif", letterSpacing: '-0.04em' }}><span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#E8B4B8', boxShadow: '8px 0 0 #2A211E' }}></span><span style={{ marginLeft: '8px' }}>Yeppo</span></Link>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '18px', maxWidth: '440px', width: '100%', margin: '0 auto' }}>
          <h1 className="h h1" style={{ fontSize: '40px' }}>{tr('Kirish yoki roʻyxatdan oʻtish')}</h1>
          {step === 'phone' ? (
            <form onSubmit={getCode} style={{ display: 'contents' }}>
              <p className="muted" style={{ margin: 0, fontSize: '16px', lineHeight: 1.55 }}>{tr('Parol kerak emas. Raqamingizga SMS-kod yuboramiz.')}</p>
              <label className="lbl">{tr('Telefon raqam')}<input className="inp" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ fontSize: '18px' }} autoFocus /></label>
              {err && <span role="alert" style={{ color: '#A8475C', fontSize: '14px' }}>{err}</span>}
              <button className="pill dark" style={{ minHeight: '56px', fontSize: '16px' }} disabled={busy}>{tr('Kod olish')}</button>
            </form>
          ) : (
            <form onSubmit={verify} style={{ display: 'contents' }}>
              <p className="muted" style={{ margin: 0, fontSize: '16px', lineHeight: 1.55 }}>{tr('Kodni SMSdan kiriting.')} <b style={{ color: '#2A211E' }}>{phone}</b> · <button type="button" onClick={() => { setStep('phone'); setCode(''); setErr('') }} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', textDecoration: 'underline', cursor: 'pointer', color: 'inherit' }}>{tr('Oʻzgartirish')}</button></p>
              {mock && <span style={{ padding: '10px 14px', borderRadius: '12px', background: '#F5DCC9', fontSize: '14px' }}>{tr('Sinov rejimi: SMS yuborilmadi. Kod:')} <b>{mock}</b></span>}
              <label className="lbl">{tr('Kod')}<input className="inp" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ fontSize: '22px', letterSpacing: '.3em' }} autoFocus /></label>
              {err && <span role="alert" style={{ color: '#A8475C', fontSize: '14px' }}>{err}</span>}
              <button className="pill dark" style={{ minHeight: '56px', fontSize: '16px' }} disabled={busy || code.length !== 4}>{tr('Kirish')}</button>
            </form>
          )}
          <span className="muted" style={{ fontSize: '12px', lineHeight: 1.5 }}>{tr('Davom etib,')} <Link href={L('/yordam/maxfiylik')}>{tr('maxfiylik siyosati')}</Link> {tr('va')} <Link href={L('/yordam/oferta')}>{tr('ommaviy oferta')}</Link> {tr('shartlariga rozilik bildirasiz.')}</span>
        </div>
      </section>
      <aside className="d-only" style={{ flex: '1 1 560px', position: 'relative', minHeight: '600px' }}>
        <img className="ph" src="/img/face-glow.jpg" alt="" style={{ position: 'absolute', inset: 0, objectPosition: '50% 30%' }} />
        <div className="glass" style={{ position: 'absolute', left: '32px', right: '32px', bottom: '32px', padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <b className="h" style={{ fontSize: '22px' }}>{tr('Kirganingizda')}</b>
          <span style={{ display: 'flex', gap: '10px', fontSize: '15px' }}>{TICK} {tr('Buyurtmalar va kuzatish bir joyda')}</span>
          <span style={{ display: 'flex', gap: '10px', fontSize: '15px' }}>{TICK} {tr('Har xariddan bonus ball')}</span>
          <span style={{ display: 'flex', gap: '10px', fontSize: '15px' }}>{TICK} {tr('Teri profilingiz — katalogda «sizga mos» belgisi')}</span>
        </div>
      </aside>
    </div>
  )
}
