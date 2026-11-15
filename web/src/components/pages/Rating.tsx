'use client'
// Sales + Top-10 — design/preview/Rating.html (generated, then wired). Old price = real price within 30 days;
// Top-10 = units sold in paid orders over the last 30 days (catalog order while there are no sales).
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Icon } from '@/components/icons'
import { ProductCard } from '@/components/ProductCard'
import { useShop } from '@/components/shop'
import type { HomeCard } from '@/lib/catalog'
import { fmt, sum } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'

type Props = { lang: Lang; deals: HomeCard[]; top: (HomeCard & { need?: string })[]; bySales: boolean; endsAt?: string; promo?: { code: string; note?: string }; month: string }
const pct = (p: HomeCard) => (p.old ? Math.round((1 - p.price / p.old) * 100) : 0)

function Timer({ lang, endsAt }: { lang: Lang; endsAt: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const id = setInterval(tick, 1000); return () => clearInterval(id) }, [])
  const s = now === null ? 0 : Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000))
  const parts = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60]
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }} role="timer">
      <span style={{ fontSize: '14px', color: '#F6DEDA' }}>{t(lang, 'Tugashiga:')}</span>
      {(['kun', 'soat', 'daqiqa', 'soniya'] as const).map((l, i) => (
        <span key={l} style={{ minWidth: '56px', padding: '8px 10px', borderRadius: '14px', background: '#FBF3F1', color: '#A8475C', textAlign: 'center' }}>
          <b className="num" style={{ fontSize: '22px', display: 'block' }} suppressHydrationWarning>{now === null ? '–' : String(parts[i]).padStart(2, '0')}</b><span style={{ fontSize: '11px' }}>{t(lang, l)}</span>
        </span>
      ))}
    </div>
  )
}

export function RatingPage({ lang, deals, top, bySales, endsAt, promo, month }: Props) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const shop = useShop()
  const [dt, setDt] = useState(0)
  const [tt, setTt] = useState(0)
  const [copied, setCopied] = useState(false)
  const dealTabs: [string, (p: HomeCard) => boolean][] = [['Hammasi', () => true], ['−15% va koʻproq', (p) => pct(p) >= 15], ['Toʻplamlar', (p) => p.category === 'toplamlar'], ['SPF', (p) => p.category === 'spf']]
  const topTabs: [string, (p: HomeCard) => boolean][] = [['Hammasi', () => true], ['Serum va ampula', (p) => p.category === 'serum'], ['Toner va essensiya', (p) => ['toner', 'essensiya'].includes(p.category)], ['SPF va krem', (p) => ['spf', 'krem'].includes(p.category)]]
  const dl = deals.filter(dealTabs[dt][1])
  const tl = top.filter(topTabs[tt][1]).slice(0, 10)
  const sets = deals.filter((p) => p.category === 'toplamlar')
  const setMax = Math.max(0, ...sets.map(pct))
  return (
    <div className="wrap" style={{ marginTop: '16px' }}>
      <nav aria-label={tr('Yoʻl')} className="muted" style={{ fontSize: '13px', display: 'flex', gap: '8px' }}><Link href={L('/')} style={{ color: '#6B5F59' }}>{tr('Bosh sahifa')}</Link><span>/</span><span style={{ color: '#2A211E' }}>{tr('Aksiyalar')}</span></nav>
      <section style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '10px' }}>
        <div className="card pad-m" style={{ flex: '2 1 640px', padding: '36px', background: '#A8475C', color: '#FBF3F1', display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center', minHeight: '300px', position: 'relative', overflow: 'hidden' }}>
          {endsAt && <span className="chip" style={{ alignSelf: 'flex-start', background: 'rgba(251,243,241,.18)', color: '#FBF3F1' }}>{tr('Shu hafta')}</span>}
          <h1 className="h h1" style={{ fontSize: '52px', lineHeight: 1.02 }}>{tr('Aksiyalar.')}<br /><span className="serif" style={{ fontStyle: 'italic' }}>{tr('Faqat original')}</span>{tr(', faqat haqiqiy chegirma')}</h1>
          <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.6, maxWidth: '520px', color: '#F6DEDA' }}>{tr('Narxni oldin oshirib, keyin «chegirma» qilmaymiz. Har kartada eski narx — oxirgi 30 kundagi haqiqiy narx.')}</p>
          {endsAt && <Timer lang={lang} endsAt={endsAt} />}
        </div>
        <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {promo && (
            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#F5DCC9', flex: 1 }}>
              <span className="eyebrow" style={{ color: '#2A211E' }}>{tr('Birinchi xarid')}</span>
              <b className="h" style={{ fontSize: '26px' }}>{promo.code}{promo.note ? ` — ${promo.note}` : ''}</b>
              <span style={{ fontSize: '14px', lineHeight: 1.5 }}>{tr('Aksiyadagi narxga ham qoʻshiladi. Savatda kiriting.')}</span>
              <button className="pill dark" style={{ alignSelf: 'flex-start' }} onClick={() => { shop.setPromo(promo.code); navigator.clipboard?.writeText(promo.code).catch(() => {}); setCopied(true) }}>{copied ? tr('Savatga qoʻshildi ✓') : tr('Kodni nusxalash')}</button>
            </div>
          )}
          {sets.length > 0 && (
            <div className="card" style={{ padding: '24px', display: 'flex', gap: '14px', alignItems: 'center', flex: 1 }}>
              <img src={sets[0].img} alt="" style={{ width: '84px', height: '84px', borderRadius: '16px', objectFit: 'cover' }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><b style={{ fontWeight: 600 }}>{tn(lang, 'Toʻplamlar −[N]% gacha', setMax)}</b><span className="muted" style={{ fontSize: '13px' }}>{tr('Alohida olgandan arzonroq, sovgʻaga tayyor')}</span><a href="#deals" onClick={() => setDt(2)} style={{ fontSize: '14px', fontWeight: 600 }}>{tr('Koʻrish ›')}</a></span>
            </div>
          )}
        </div>
      </section>
      <section id="deals" style={{ marginTop: '32px' }} aria-labelledby="d-h">
        <div className="sec-h"><h2 id="d-h" className="h h2" style={{ fontSize: '34px' }}>{tr('Chegirmadagilar')} <span className="muted" style={{ fontSize: '20px' }}>{tn(lang, '[N] ta', dl.length)}</span></h2>
          <div role="tablist" className="hs" style={{ gap: '6px' }}>{dealTabs.map(([l], i) => <button key={l} role="tab" aria-selected={dt === i} className={dt === i ? 'pill dark' : 'pill ghost'} onClick={() => setDt(i)}>{tr(l)}</button>)}</div>
        </div>
        {dl.length ? <div className="pgrid">{dl.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div> : <p className="muted">{tr('Hozircha bu boʻlimda chegirma yoʻq.')}</p>}
      </section>
      <section id="top" className="card pad-m" style={{ marginTop: '40px', padding: '32px' }} aria-labelledby="t-h">
        <div className="sec-h" style={{ alignItems: 'flex-end' }}>
          <div><span className="eyebrow">Top-10 · {month}</span><h2 id="t-h" className="h h2" style={{ fontSize: '38px', marginTop: '6px' }}>{tr('Bu oy eng koʻp olinganlar')}</h2>
            {bySales && <p className="muted" style={{ margin: '6px 0 0', fontSize: '15px' }}>{tr('Reyting sotuvlar va qaytarilmagan buyurtmalar boʻyicha. Reklama joyi emas — sotib olib boʻlmaydi.')}</p>}</div>
          <div role="tablist" className="hs" style={{ gap: '6px' }}>{topTabs.map(([l], i) => <button key={l} role="tab" aria-selected={tt === i} className={tt === i ? 'pill dark' : 'pill ghost'} onClick={() => setTt(i)}>{tr(l)}</button>)}</div>
        </div>
        <ol style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'flex', flexDirection: 'column' }}>
          {tl.map((p, i) => (
            <li key={p.slug} data-g="top" style={{ display: 'grid', gap: '18px', alignItems: 'center', padding: '14px 0', borderTop: '1px solid #EFE9E3' }}>
              <span className="num" style={{ fontSize: '40px', color: '#A8475C' }}>{i + 1}</span>
              <Link href={L(`/mahsulot/${p.slug}`)} className="zoom" style={{ display: 'block', width: '88px', height: '88px', borderRadius: '16px', overflow: 'hidden' }}><img loading="lazy" decoding="async" className="ph" src={p.img} alt={`${p.brand} ${p.name}`} /></Link>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                <Link href={L(`/mahsulot/${p.slug}`)} style={{ textDecoration: 'none', fontSize: '16px' }}><b style={{ fontWeight: 600 }}>{p.brand}</b> {p.name}</Link>
                {p.need && <span className="muted" style={{ fontSize: '14px' }}>{p.need}</span>}
                <span style={{ fontSize: '12px' }} className="muted">{p.reviews ? <><span className="stars">★</span> {String(p.rating?.toFixed(1)).replace('.', ',')} · {tn(lang, '[N] sharh', p.reviews)} · </> : null}{p.type}</span>
              </span>
              <span style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}><span className="num" style={{ fontSize: '20px' }}>{fmt(p.price)} {sum(lang)}</span>{p.old && <span className="old">{fmt(p.old)}</span>}</span>
                <button className="pill dark" style={{ minHeight: '46px' }} onClick={() => shop.add(p)}><Icon name="bag" size={16} /> {shop.inCart(p.sku) ? tr('Savatda ✓') : tr('Savatga')}</button>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className="card pad-m" style={{ marginTop: '16px', padding: '28px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', background: '#F2D6D0' }}>
        <span style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', flex: 'none' }}><img loading="lazy" decoding="async" className="ph" src="/img/face-white.jpg" alt="" style={{ objectPosition: '50% 25%' }} /></span>
        <span style={{ flex: '1 1 420px', fontSize: '16px', lineHeight: 1.55 }}><b style={{ fontWeight: 600 }}>{tr('Top-10 hammaga ham mos emas.')}</b> {tr('Teringiz turini aytsangiz, roʻyxatdan aynan sizga mos 2–3 tasini ajratib beraman.')}</span>
        <Link href={L('/maslahatchi')} className="pill dark"><Icon name="spark" size={16} /> {tr('Menga moslarini koʻrsat')}</Link>
      </section>
    </div>
  )
}
