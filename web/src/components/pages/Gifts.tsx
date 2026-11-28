'use client'
// Gifts — design/preview/Gifts.html + finder logic (who × budget) and gift certificates (GC-<amount>-TG|CARD).
import Link from 'next/link'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { ProductCard } from '@/components/ProductCard'
import { useShop } from '@/components/shop'
import type { HomeCard } from '@/lib/catalog'
import { fmt, sum } from '@/lib/format'
import { href, t, type Lang } from '@/lib/i18n'

// who -> categories that make a safe gift (p_more*.py WHO, generalised from product ids to categories)
const WHO: [string, string[], string][] = [
  ['Onamga', ['krem', 'essensiya', 'toplamlar', 'serum'], 'Onalar koʻpincha namlik va elastiklikka eʼtibor beradi. Jenshenli serum va yumshoq krem — xato qilmaysiz.'],
  ['Dugonamga', ['toplamlar', 'serum', 'niqoblar'], 'Teri turini bilmasangiz — hammaga mos keladiganlarini oldinga chiqardik.'],
  ['Opa-singlimga', ['toner', 'serum', 'niqoblar', 'spf'], 'Teri turini bilmasangiz — hammaga mos keladiganlarini oldinga chiqardik.'],
  ['Erkakka', ['serum', 'tozalash', 'spf', 'krem'], 'Erkaklar oddiylikni yoqtiradi: bitta yaxshi ampula va SPF — kifoya.'],
  ['Hamkasbga', ['niqoblar', 'spf', 'tozalash', 'serum'], 'Teri turini bilmasangiz — hammaga mos keladiganlarini oldinga chiqardik.'],
]
const BUD: [string, number, number][] = [['200 000 gacha', 0, 200000], ['200–500 ming', 200000, 500000], ['500 000 dan', 500000, 1e12]]
const AMOUNTS = [100000, 200000, 300000, 500000]

export function GiftsPage({ lang, products, certSkus }: { lang: Lang; products: HomeCard[]; certSkus: Record<string, { sku: string; slug: string; img: string }> }) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const shop = useShop()
  const [who, setWho] = useState(0)
  const [bud, setBud] = useState(1)
  const [amt, setAmt] = useState(300000)
  const [form, setForm] = useState<'TG' | 'CARD'>('TG')
  const [added, setAdded] = useState(false)
  const cats = WHO[who][1]
  const fit = products.filter((p) => cats.includes(p.category)).sort((a, b) => cats.indexOf(a.category) - cats.indexOf(b.category))
  let grid = fit.filter((p) => p.price >= BUD[bud][1] && p.price < BUD[bud][2])
  if (!grid.length) grid = fit
  const cert = certSkus[`GC-${amt}-${form}`]
  const addCert = () => {
    if (!cert) return
    shop.add({ sku: cert.sku, slug: cert.slug, brand: 'Yeppo', name: `${tr('Sovgʻa sertifikati')} ${fmt(amt)} ${sum(lang)} · ${form === 'TG' ? tr('Telegramga') : tr('Kartochkada')}`, img: cert.img, price: amt, tags: [] })
    setAdded(true)
  }
  return (
    <div className="wrap" style={{ marginTop: '16px' }}>
      <nav aria-label={tr('Yoʻl')} className="muted" style={{ fontSize: '13px', display: 'flex', gap: '8px' }}><Link href={L('/')} style={{ color: '#6B5F59' }}>{tr('Bosh sahifa')}</Link><span>/</span><span style={{ color: '#2A211E' }}>{tr('Sovgʻalar')}</span></nav>
      <section className="card" style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', minHeight: '360px', background: '#F5DCC9' }}>
        <div className="pad-m" style={{ flex: '1 1 520px', padding: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
          <span className="chip" style={{ alignSelf: 'flex-start', background: '#FBFAF7' }}><Icon name="gift" size={14} /> {tr('Sovgʻa qutisi bilan')}</span>
          <h1 className="h h1" style={{ fontSize: '50px', lineHeight: 1.04 }}>{tr('Sovgʻa tanlash qiyinmi?')} <span className="serif" style={{ fontStyle: 'italic' }}>{tr('Birga topamiz')}</span></h1>
          <p style={{ margin: 0, fontSize: '17px', lineHeight: 1.6, color: '#4A3F3A', maxWidth: '520px' }}>{tr('Kimga va qancha summaga — ikki narsani tanlang. Qadoqlab, narxsiz chek va tabriknoma bilan yetkazamiz.')}</p>
        </div>
        <div style={{ flex: '1 1 440px', minHeight: '360px', position: 'relative' }}><img className="ph" src="/img/p-flatlay-pink.jpg" alt={tr('Sovgʻa toʻplami')} style={{ position: 'absolute', inset: 0 }} /></div>
      </section>
      <section className="card pad-m" style={{ marginTop: '16px', padding: '28px' }} aria-labelledby="gf-h">
        <h2 id="gf-h" className="h h2" style={{ fontSize: '30px' }}>{tr('Sovgʻa topuvchi')}</h2>
        <div data-g="2" style={{ display: 'grid', gap: '24px', marginTop: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><span className="lbl">{tr('Kimga?')}</span><div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{WHO.map(([l], i) => <button key={l} className={who === i ? 'pill dark' : 'pill line'} aria-pressed={who === i} onClick={() => setWho(i)}>{tr(l)}</button>)}</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><span className="lbl">{tr('Byudjet')}</span><div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{BUD.map(([l], i) => <button key={l} className={bud === i ? 'pill dark' : 'pill line'} aria-pressed={bud === i} onClick={() => setBud(i)}>{tr(l)}</button>)}</div></div>
        </div>
        <p style={{ margin: '18px 0 16px', padding: '14px 16px', borderRadius: '16px', background: '#F6F3EF', fontSize: '15px', lineHeight: 1.55 }}>{tr(WHO[who][2])}</p>
        <div className="pgrid">{grid.slice(0, 4).map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>
      </section>
      <section style={{ marginTop: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div className="card pad-m" style={{ flex: '1 1 520px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }} aria-labelledby="gc-h">
          <h2 id="gc-h" className="h" style={{ fontSize: '26px' }}>{tr('Bilmasangiz — sertifikat bering')}</h2>
          <span className="muted" style={{ fontSize: '15px' }}>{tr('Oʻzi tanlaydi. 12 oy amal qiladi, Telegramga yoki chiroyli kartochkada yuboramiz.')}</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{AMOUNTS.map((a) => <button key={a} className={amt === a ? 'pill dark' : 'pill line'} aria-pressed={amt === a} onClick={() => { setAmt(a); setAdded(false) }}>{fmt(a)}</button>)}</div>
          <div style={{ display: 'flex', gap: '6px' }}>{([['TG', 'Telegramga'], ['CARD', 'Kartochkada']] as const).map(([k, l]) => <button key={k} className={form === k ? 'pill dark' : 'pill ghost'} aria-pressed={form === k} onClick={() => { setForm(k); setAdded(false) }}>{tr(l)}</button>)}</div>
          <button className="pill dark" style={{ alignSelf: 'flex-start', minHeight: '50px' }} onClick={addCert} disabled={!cert}>{added ? tr('Sertifikat savatda ✓') : tr('Sertifikatni savatga')}</button>
        </div>
        <div className="card" style={{ flex: '1 1 420px', minHeight: '280px', padding: '28px', background: '#2A211E', color: '#FBFAF7', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ font: "500 22px 'Inter Tight'", letterSpacing: '-0.04em' }}>Yeppo</span><span className="chip" style={{ background: 'rgba(251,250,247,.15)', color: '#FBFAF7' }}>{tr('Sovgʻa sertifikati')}</span></span>
          <span className="serif" style={{ fontSize: '28px', fontStyle: 'italic', color: '#F2D6D0' }}>{tr('Oʻzingizga yoqqanini tanlang')}</span>
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="num" style={{ fontSize: '44px' }}>{fmt(amt)} {sum(lang)}</span><span style={{ fontSize: '12px', color: '#B9ADA6' }}>{tr('Kod: XXXX-XXXX')}</span></span>
        </div>
      </section>
      <section style={{ marginTop: '32px' }} aria-labelledby="oc-h">
        <h2 id="oc-h" className="h h2" style={{ fontSize: '30px', marginBottom: '16px' }}>{tr('Bayramlar uchun')}</h2>
        <div data-g="3" style={{ display: 'grid', gap: '12px' }}>
          {([['8-mart', 'Onaga, opa-singilga, hamkasbga', 'face-gifts', 0], ['Tugʻilgan kun', 'Dugonaga tayyor toʻplamlar', 'pink-3', 1], ['Yangi yil', 'Qishki parvarish qutilari', 'flatlay', 0]] as const).map(([h, d, img, w]) => (
            <a key={h} href="#gf-h" onClick={() => setWho(w)} className="card zoom" style={{ textDecoration: 'none', overflow: 'hidden' }}>
              <span style={{ display: 'block', aspectRatio: '16/10', overflow: 'hidden' }}><img loading="lazy" decoding="async" className="ph" src={`/img/${img}.jpg`} alt="" style={{ objectPosition: '50% 25%' }} /></span>
              <span style={{ display: 'block', padding: '18px' }}><b style={{ fontWeight: 600, fontSize: '17px' }}>{tr(h)}</b><br /><span className="muted" style={{ fontSize: '14px' }}>{tr(d)}</span></span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
