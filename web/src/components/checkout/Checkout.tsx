'use client'
// Checkout (design/preview/Checkout.html, p_checkout.py; phone step-by-step: p_mobile2.py "co").
// Card data is never asked here: payment happens on the Click / Payme page (HANDOFF §6).
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { useShop } from '@/components/shop'
import { fmt, sum } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'
import { PROMO_ERR } from './Cart'
import { useQuote } from './useQuote'

export type CheckoutStore = { tashkentPrice: number; regionPrice: number; regionDays: string; giftBoxPrice: number; returnDays: number; telegramUrl: string }

const TASHKENT = ['Yunusobod', 'Chilonzor', 'Mirzo Ulugʻbek', 'Mirobod', 'Yakkasaroy', 'Shayxontohur', 'Olmazor', 'Uchtepa', 'Yashnobod', 'Sergeli', 'Bektemir', 'Yangihayot']
const REGIONS = ['Toshkent viloyati', 'Andijon', 'Buxoro', 'Fargʻona', 'Jizzax', 'Xorazm', 'Namangan', 'Navoiy', 'Qashqadaryo', 'Qoraqalpogʻiston', 'Samarqand', 'Sirdaryo', 'Surxondaryo']
const SLOTS = ['09:00–12:00', '12:00–15:00', '15:00–18:00', '18:00–21:00']
const PAYS = [['click', 'Click', 'Ilova yoki karta orqali'], ['payme', 'Payme', 'Ilova yoki karta orqali'], ['card', 'Uzcard / Humo', 'Karta raqami toʻlov sahifasida']] as const
type Pay = (typeof PAYS)[number][0]

/** "+998 90 123 45 67" while typing. */
function maskPhone(raw: string) {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('998')) d = d.slice(3)
  d = d.slice(0, 9)
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean)
  return `+998${parts.length ? ' ' + parts.join(' ') : ''}`
}

const ERR: Record<string, string> = {
  name: 'Ismingizni yozing', phone: 'Telefon raqamini toʻliq yozing', address: 'Manzilni yozing', empty: 'Savat boʻsh',
  missing: 'Baʼzi mahsulotlar tugadi — savatni tekshiring', network: 'Internet bilan bogʻlanib boʻlmadi. Qayta urinib koʻring.',
}

export function CheckoutView({ lang, store }: { lang: Lang; store: CheckoutStore }) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const router = useRouter()
  const shop = useShop()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tg, setTg] = useState(true)
  const [delivery, setDelivery] = useState<'tashkent' | 'region'>('tashkent')
  const [city, setCity] = useState(TASHKENT[0])
  const [address, setAddress] = useState('')
  const [slot, setSlot] = useState(2)
  const [comment, setComment] = useState('')
  const [pay, setPay] = useState<Pay>('click')
  const [gift, setGift] = useState(false)
  const [usePoints, setUsePoints] = useState(false)
  const [step, setStep] = useState(0) // phone only
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const digits = phone.replace(/\D/g, '')
  const { data } = useQuote(lang, { delivery, gift, usePoints, phone: digits.length === 12 ? digits : undefined })
  const q = data?.quote
  const payName = PAYS.find((p) => p[0] === pay)![1]

  const check = (fields: string[]) => {
    const e: Record<string, string> = {}
    if (fields.includes('name') && !name.trim()) e.name = ERR.name
    if (fields.includes('phone') && digits.length !== 12) e.phone = ERR.phone
    if (fields.includes('address') && !address.trim()) e.address = ERR.address
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!check(['name', 'phone', 'address'])) return
    setSending(true)
    try {
      const r = await fetch('/api/shop/orders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lang, lines: shop.lines.map((l) => ({ sku: l.sku, qty: l.qty })), promo: shop.promo || undefined, name, phone, telegramUpdates: tg,
          delivery, city: delivery === 'tashkent' ? `Toshkent, ${city}` : city, address, slot: delivery === 'tashkent' ? SLOTS[slot] : undefined,
          comment, payment: pay, gift, usePoints, consent: true, // the button text states the offer is accepted (design)
        }),
      })
      const d = await r.json()
      if (!r.ok) { setErrors({ form: ERR[d.error] ?? (d.error?.startsWith('promo_') ? PROMO_ERR[d.error.slice(6) as keyof typeof PROMO_ERR] : 'Xatolik. Qayta urinib koʻring.') }); return }
      shop.clear()
      if (d.payUrl.startsWith('/')) router.push(d.payUrl)
      else window.location.href = d.payUrl
    } catch {
      setErrors({ form: ERR.network })
    } finally {
      setSending(false)
    }
  }

  const fee = (type: 'tashkent' | 'region') => (q && q.freeLeft === 0) ? tr('Bepul') : `${fmt(type === 'tashkent' ? store.tashkentPrice : store.regionPrice)} ${sum(lang)}`
  const radio = (on: boolean) => ({ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', padding: '14px 16px', borderRadius: '16px', border: `1.5px solid ${on ? '#2A211E' : '#E2DAD2'}`, background: on ? '#F6F3EF' : '#fff', cursor: 'pointer', textAlign: 'left' as const, font: 'inherit', color: '#2A211E', boxSizing: 'border-box' as const })
  const dot = (on: boolean) => <span style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1.5px solid #2A211E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: on ? '#2A211E' : 'transparent' }} /></span>
  const num = (n: number) => <span className="num" style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#2A211E', color: '#FBFAF7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flex: 'none' }}>{n}</span>
  const err = (k: string) => errors[k] && <span role="alert" style={{ color: '#A8475C', fontSize: '13px' }}>{tr(errors[k])}</span>
  const total = q ? `${fmt(q.total)} ${sum(lang)}` : '…'
  const payLabel = tn(lang, '[N] orqali [N] toʻlash', payName, total)

  const fields = {
    name: <label className="lbl">{tr('Ismingiz')}<input className="inp" autoComplete="name" placeholder={tr('Masalan, Malika')} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />{err('name')}</label>,
    phone: <label className="lbl">{tr('Telefon raqam')}<input className="inp" type="tel" autoComplete="tel" inputMode="tel" placeholder="+998 __ ___ __ __" value={phone} onFocus={() => !phone && setPhone('+998 ')} onChange={(e) => setPhone(maskPhone(e.target.value))} aria-invalid={!!errors.phone} />{err('phone')}</label>,
    tg: <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '14px', cursor: 'pointer' }}><input type="checkbox" checked={tg} onChange={() => setTg(!tg)} style={{ width: '18px', height: '18px', accentColor: '#2A211E', margin: 0 }} />{tr('Buyurtma holatini Telegram orqali yuboring')}</label>,
    city: <label className="lbl">{tr('Shahar / tuman')}<select className="inp" value={city} onChange={(e) => setCity(e.target.value)}>{(delivery === 'tashkent' ? TASHKENT.map((d) => [d, `Toshkent, ${d}`]) : REGIONS.map((r) => [r, r])).map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}</select></label>,
    address: <label className="lbl">{tr('Manzil')}<input className="inp" autoComplete="street-address" placeholder={tr('Koʻcha, uy, xonadon, moʻljal')} value={address} onChange={(e) => setAddress(e.target.value)} aria-invalid={!!errors.address} />{err('address')}</label>,
    comment: <label className="lbl">{tr('Kuryerga izoh (ixtiyoriy)')}<input className="inp" placeholder={tr('Masalan: domofon ishlamaydi, qoʻngʻiroq qiling')} value={comment} onChange={(e) => setComment(e.target.value)} /></label>,
  }
  const deliveryRadios = (
    <div role="radiogroup" aria-label={tr('Yetkazish usuli')} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {([['tashkent', 'Kuryer, Toshkent boʻylab', tr('Ertaga, siz tanlagan vaqtda')], ['region', 'Viloyatlarga', tn(lang, '[N] kun · pochta xizmati orqali', store.regionDays)]] as const).map(([id, title, sub]) => (
        <button key={id} role="radio" aria-checked={delivery === id} style={radio(delivery === id)} onClick={() => { setDelivery(id); setCity(id === 'tashkent' ? TASHKENT[0] : REGIONS[0]) }}>
          {dot(delivery === id)}<span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}><b style={{ fontWeight: 600, fontSize: '15px' }}>{tr(title)}</b><span className="muted" style={{ fontSize: '13px' }}>{sub}</span></span><span className="num" style={{ fontSize: '15px' }}>{fee(id)}</span>
        </button>
      ))}
    </div>
  )
  const payRadios = (compact: boolean) => (
    <div role="radiogroup" aria-label={tr('Toʻlov usuli')} style={compact ? { display: 'flex', flexDirection: 'column', gap: '10px' } : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
      {PAYS.map(([id, title, sub]) => (
        <button key={id} role="radio" aria-checked={pay === id} style={radio(pay === id)} onClick={() => setPay(id)}>
          {dot(pay === id)}<span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}><b style={{ fontWeight: 600, fontSize: '15px' }}>{title}</b><span className="muted" style={{ fontSize: '13px' }}>{tr(sub)}</span></span>
        </button>
      ))}
    </div>
  )
  const giftBox = (
    <label style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '14px 16px', borderRadius: '16px', background: '#F2D6D0', cursor: 'pointer' }}>
      <input type="checkbox" checked={gift} onChange={() => setGift(!gift)} style={{ width: '18px', height: '18px', accentColor: '#2A211E', margin: 0 }} />
      <Icon name="gift" /><span style={{ flex: 1, fontSize: '14px' }}><b style={{ fontWeight: 600 }}>{tr('Sovgʻa qutisiga solib beraylikmi?')}</b> {tr('Narxsiz chek va tabriknoma bilan')}</span><span className="num" style={{ fontSize: '15px' }}>+{fmt(store.giftBoxPrice)}</span>
    </label>
  )
  const summaryRows = q && (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">{tr('Mahsulotlar')}</span><span>{fmt(q.subtotal)} {sum(lang)}</span></div>
      {q.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">{q.discountLabel === 'routine' ? tr('Tayyor rutina') : `${tr('Promokod')} ${q.discountLabel}`}</span><span style={{ color: '#A8475C' }}>−{fmt(q.discount)} {sum(lang)}</span></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">{tr('Yetkazish')}</span><span>{q.deliveryFee ? `${fmt(q.deliveryFee)} ${sum(lang)}` : tr('Bepul')}</span></div>
      {q.giftFee > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">{tr('Sovgʻa qutisi')}</span><span>{fmt(q.giftFee)} {sum(lang)}</span></div>}
      {q.pointsAvailable > 0 && (
        <label style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={usePoints} onChange={() => setUsePoints(!usePoints)} style={{ width: '18px', height: '18px', accentColor: '#2A211E', margin: 0 }} />
          <span className="muted" style={{ flex: 1 }}>{tn(lang, 'Bonus ballar bilan toʻlash ([N] gacha)', fmt(q.pointsAvailable))}</span>
          {q.pointsUsed > 0 && <span style={{ color: '#A8475C' }}>−{fmt(q.pointsUsed)} {sum(lang)}</span>}
        </label>
      )}
    </>
  )
  const offer = (
    <span className="muted" style={{ fontSize: '12px', lineHeight: 1.5, textAlign: 'center' }}>
      {tr('Tugmani bosish bilan')} <Link href={L('/yordam/oferta')}>{tr('ommaviy oferta')}</Link> {tn(lang, 'shartlariga rozilik bildirasiz. Ochilmagan mahsulotni [N] kun ichida qaytarish mumkin.', store.returnDays)}
    </span>
  )

  if (q && q.lines.length === 0 && shop.lines.length === 0) return (
    <div className="wrap checkout-page" style={{ marginTop: '20px' }}>
      <div className="card" style={{ padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        <b className="h" style={{ fontSize: '28px' }}>{tr('Savat hozircha boʻsh')}</b>
        <Link href={L('/katalog/serum')} className="pill dark">{tr('Katalog')}</Link>
      </div>
    </div>
  )

  const phoneSteps = [
    <div key="c" style={{ padding: '18px', borderRadius: '22px', background: '#FBFAF7', display: 'flex', flexDirection: 'column', gap: '12px' }}><b className="h" style={{ fontSize: '20px' }}>{tr('Siz bilan qanday bogʻlanamiz?')}</b>{fields.name}{fields.phone}{fields.tg}</div>,
    <div key="a" style={{ padding: '18px', borderRadius: '22px', background: '#FBFAF7', display: 'flex', flexDirection: 'column', gap: '12px' }}><b className="h" style={{ fontSize: '20px' }}>{tr('Qayerga va qachon?')}</b>
      {deliveryRadios}{fields.city}{fields.address}
      {delivery === 'tashkent' && <><span className="lbl">{tr('Ertaga, qulay vaqt')}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>{SLOTS.map((s, i) => <button key={s} className={slot === i ? 'pill dark' : 'pill line'} style={{ minHeight: '44px', fontSize: '13px' }} onClick={() => setSlot(i)}>{s.replace(/:00/g, '')}</button>)}</div></>}
      {fields.comment}</div>,
    <div key="p" style={{ padding: '18px', borderRadius: '22px', background: '#FBFAF7', display: 'flex', flexDirection: 'column', gap: '10px' }}><b className="h" style={{ fontSize: '20px' }}>{tr('Qanday toʻlaysiz?')}</b>
      {payRadios(true)}{giftBox}<span className="muted" style={{ fontSize: '12px', display: 'flex', gap: '6px' }}><Icon name="shield" size={14} /> {tr('Karta maʼlumotini biz koʻrmaymiz')}</span>{offer}</div>,
  ]
  const nextPhone = () => {
    if (step === 0 && !check(['name', 'phone'])) return
    if (step === 1 && !check(['address'])) return
    if (step < 2) setStep(step + 1)
    else submit()
  }

  return (
    <div className="checkout-page">
      {/* own header (design: no catalog/search during checkout) */}
      <header className="d-only" style={{ background: '#FBFAF7', borderBottom: '1px solid #ECE6E0' }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', minHeight: '72px', flexWrap: 'wrap' }}>
          <Link href={L('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', font: "500 26px 'Inter Tight', sans-serif", letterSpacing: '-0.04em' }}><span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#E8B4B8', boxShadow: '8px 0 0 #2A211E' }} /><span style={{ marginLeft: '8px' }}>Yeppo</span></Link>
          <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', fontSize: '14px' }} className="muted hide-m"><Icon name="shield" size={16} /> {tr('Toʻlov Click va Payme sahifasida — karta maʼlumotingizni biz koʻrmaymiz')}</span>
          <a href={store.telegramUrl} className="pill line" style={{ minHeight: '42px' }}><Icon name="tg" size={16} /> {tr('Yordam kerakmi?')}</a>
        </div>
      </header>

      {/* phone: step by step */}
      <div className="m-only" style={{ flexDirection: 'column' }}>
        <div className="m-top" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {step > 0 ? <button className="ib" aria-label={tr('Orqaga')} onClick={() => setStep(step - 1)}><Icon name="left" size={22} /></button> : <Link href={L('/savat')} className="ib" aria-label={tr('Orqaga')}><Icon name="left" size={22} /></Link>}
          <b className="h" style={{ fontSize: '22px', flex: 1 }}>{tr('Rasmiylashtirish')}</b><span className="muted" style={{ fontSize: '13px' }}>{step + 1}/3</span>
        </div>
        <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>{[0, 1, 2].map((i) => <span key={i} style={{ height: '5px', borderRadius: '3px', background: i <= step ? '#2A211E' : '#DDD4CC' }} />)}</div>
          {phoneSteps[step]}
          {errors.form && <span role="alert" style={{ color: '#A8475C', fontSize: '14px' }}>{tr(errors.form)}</span>}
          {q && (
            <div style={{ padding: '16px', borderRadius: '22px', background: '#FBFAF7', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>{q.lines.slice(0, 4).map((l) => <img loading="lazy" decoding="async" key={l.sku} src={l.img} alt="" style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover' }} />)}<span className="muted" style={{ alignSelf: 'center', marginLeft: '4px' }}>{tn(lang, '[N] ta mahsulot', q.count)}</span></div>
              {summaryRows}
            </div>
          )}
        </div>
        <div className="m-bar">
          <span style={{ flex: 1 }}><span className="muted" style={{ fontSize: '12px' }}>{tr('Jami')}</span><br /><b className="num" style={{ fontSize: '20px', fontWeight: 500 }}>{total}</b></span>
          <button className="pill dark" style={{ minHeight: '52px' }} onClick={nextPhone} disabled={sending || !q}>{step < 2 ? tr('Davom etish') : tn(lang, '[N] orqali toʻlash', payName)}</button>
        </div>
      </div>

      {/* desktop / tablet */}
      <div className="wrap d-only" style={{ marginTop: '20px' }}>
        <Link href={L('/savat')} className="muted" style={{ fontSize: '14px' }}>{tr('‹ Savatga qaytish')}</Link>
        <h1 className="h h1" style={{ fontSize: '40px', marginTop: '8px' }}>{tr('Buyurtmani rasmiylashtiramiz')}</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: '15px' }}>{tr('Uch qadam, taxminan 1 daqiqa. Savol tugʻilsa — oʻng yuqoridagi tugma orqali yozing.')}</p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '20px', alignItems: 'flex-start' }}>
          <div style={{ flex: '999 1 640px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <section className="card pad-m" style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: '16px' }} aria-label={tr('Aloqa')}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>{num(1)}<h2 className="h" style={{ fontSize: '24px' }}>{tr('Siz bilan qanday bogʻlanamiz?')}</h2></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>{fields.name}{fields.phone}</div>
              {fields.tg}
            </section>
            <section className="card pad-m" style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: '16px' }} aria-label={tr('Yetkazish')}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>{num(2)}<h2 className="h" style={{ fontSize: '24px' }}>{tr('Qayerga va qachon olib boraylik?')}</h2></div>
              {deliveryRadios}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>{fields.city}{fields.address}</div>
              {delivery === 'tashkent' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><span className="lbl">{tr('Qulay vaqt')}</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{SLOTS.map((s, i) => <button key={s} className={slot === i ? 'pill dark' : 'pill line'} aria-pressed={slot === i} style={{ minHeight: '44px', fontSize: '14px' }} onClick={() => setSlot(i)}>{s}</button>)}</div>
                </div>
              )}
              {fields.comment}
            </section>
            <section className="card pad-m" style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: '16px' }} aria-label={tr('Toʻlov')}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>{num(3)}<h2 className="h" style={{ fontSize: '24px' }}>{tr('Qanday toʻlaysiz?')}</h2></div>
              {payRadios(false)}
              {giftBox}
            </section>
          </div>
          <aside className="card" style={{ flex: '1 1 360px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '20px' }} aria-label={tr('Buyurtmangiz')}>
            <b className="h" style={{ fontSize: '24px' }}>{tr('Buyurtmangiz')}</b>
            {q?.lines.map((l) => (
              <div key={l.sku} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ position: 'relative' }}><img loading="lazy" decoding="async" src={l.img} alt="" style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover' }} /><span className="badge" style={{ top: '-6px', right: '-6px' }}>{l.qty}</span></span>
                <span style={{ flex: 1, fontSize: '13px', lineHeight: 1.35 }}><b style={{ fontWeight: 600 }}>{l.brand}</b> {l.name}</span><span className="num" style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>{fmt(l.line)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #EFE9E3', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>{summaryRows}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid #EFE9E3', paddingTop: '12px' }}><b style={{ fontWeight: 600 }}>{tr('Jami')}</b><span className="num" style={{ fontSize: '30px' }}>{total}</span></div>
            {errors.form && <span role="alert" style={{ color: '#A8475C', fontSize: '14px' }}>{tr(errors.form)}</span>}
            <button className="pill dark" style={{ minHeight: '56px', fontSize: '16px' }} onClick={submit} disabled={sending || !q}>{sending ? tr('Yuborilmoqda…') : payLabel}</button>
            {offer}
          </aside>
        </div>
      </div>
    </div>
  )
}
