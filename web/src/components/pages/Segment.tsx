'use client'
// "Kim uchun" — design/preview/Segment.html (generated, then wired to the segments collection).
import Link from 'next/link'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { ProductCard } from '@/components/ProductCard'
import { useShop, type CardProduct } from '@/components/shop'
import { fmt, sum } from '@/lib/format'
import { href, t, type Lang } from '@/lib/i18n'

export type SegTab = { slug: string; title: string; img?: string; pos?: string }
export type SegData = {
  slug: string; title: string; tag?: string; img?: string; pos?: string; h1: string; say?: string; setName?: string; setWhy?: string
  set: { step?: string; why?: string; p: CardProduct }[]; gridTitle?: string; grid: CardProduct[]; avoid: string[]; faq: { q: string; a: string }[]
}

export function SegmentPage({ lang, tabs, seg }: { lang: Lang; tabs: SegTab[]; seg: SegData }) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const shop = useShop()
  const [added, setAdded] = useState(false)
  const total = seg.set.reduce((a, x) => a + x.p.price, 0)
  const bundle = Math.round((total * 0.9) / 1000) * 1000
  return (
    <div className="wrap" style={{ marginTop: '16px' }}>
      <nav aria-label={tr('Yoʻl')} className="muted" style={{ fontSize: '13px', display: 'flex', gap: '8px' }}><Link href={L('/')} style={{ color: '#6B5F59' }}>{tr('Bosh sahifa')}</Link><span>/</span><span>{tr('Kim uchun')}</span><span>/</span><span style={{ color: '#2A211E' }}>{seg.title}</span></nav>
      <div role="tablist" aria-label={tr('Kim uchun')} className="hs" style={{ marginTop: '12px' }}>
        {tabs.map((tb) => (
          <Link key={tb.slug} href={L(`/kim-uchun/${tb.slug}`)} role="tab" aria-selected={tb.slug === seg.slug} className={tb.slug === seg.slug ? 'pill dark' : 'pill ghost'} style={{ minHeight: '52px', flex: 'none', paddingLeft: '6px', gap: '10px' }}>
            {tb.img && <img src={tb.img} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', objectPosition: tb.pos }} />}{tb.title}
          </Link>
        ))}
      </div>
      <section className="card" style={{ marginTop: '14px', minHeight: '340px', display: 'flex', flexWrap: 'wrap', background: '#F2D6D0' }} aria-labelledby="seg-h">
        <div className="pad-m" style={{ flex: '1 1 520px', padding: '36px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
          {seg.tag && <span className="chip" style={{ alignSelf: 'flex-start', background: '#FBFAF7' }}>{seg.tag}</span>}
          <h1 id="seg-h" className="h h1" style={{ fontSize: '46px', lineHeight: 1.05 }}>{seg.h1}</h1>
          {seg.say && <p style={{ margin: 0, fontSize: '17px', lineHeight: 1.6, color: '#4A3F3A', maxWidth: '560px' }}>{seg.say}</p>}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>{seg.set.length > 1 && <a href="#set" className="pill dark">{tr('Tayyor toʻplamni koʻrish')}</a>}<Link href={L('/maslahatchi')} className="pill">{tr('Maslahat soʻrash')}</Link></div>
        </div>
        {seg.img && <div style={{ flex: '1 1 420px', minHeight: '340px', position: 'relative' }}><img loading="lazy" decoding="async" className="ph" src={seg.img} alt="" style={{ position: 'absolute', inset: 0, objectPosition: seg.pos }} /></div>}
      </section>
      {seg.set.length > 1 && (
        <section id="set" className="card pad-m" style={{ marginTop: '16px', padding: '28px' }} aria-labelledby="set-h">
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span className="eyebrow">{tr('Tayyor toʻplam')}</span>
              <h2 id="set-h" className="h" style={{ fontSize: '30px', lineHeight: 1.1 }}>{seg.setName}</h2>
              {seg.setWhy && <span className="muted" style={{ fontSize: '14px', lineHeight: 1.5 }}>{seg.setWhy}</span>}
              <span style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}><span className="num" style={{ fontSize: '30px' }}>{fmt(bundle)} {sum(lang)}</span><span className="old" style={{ fontSize: '16px' }}>{fmt(total)}</span></span>
              <button className="pill dark" style={{ alignSelf: 'flex-start', minHeight: '50px' }} onClick={() => { seg.set.forEach((x) => shop.add(x.p)); setAdded(true) }}>{added ? tr('Savatga qoʻshildi ✓') : tr('Toʻplamni savatga · −10%')}</button>
            </div>
            <ol style={{ flex: '2 1 520px', listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              {seg.set.map((x) => (
                <li key={x.p.sku}><Link href={L(`/mahsulot/${x.p.slug}`)} style={{ display: 'flex', flexDirection: 'column', gap: '8px', textDecoration: 'none' }}>
                  <span className="zoom" style={{ display: 'block', aspectRatio: '1/1', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}><img loading="lazy" decoding="async" className="ph" src={x.p.img} alt="" />{x.step && <span className="chip glass" style={{ position: 'absolute', top: '8px', left: '8px' }}>{x.step}</span>}</span>
                  <span style={{ fontSize: '13px', lineHeight: 1.35 }}><b style={{ fontWeight: 600 }}>{x.p.brand}</b> {x.p.name}</span>
                  {x.why && <span className="muted" style={{ fontSize: '12px' }}>{x.why}</span>}
                </Link></li>
              ))}
            </ol>
          </div>
        </section>
      )}
      {seg.grid.length > 0 && (
        <section style={{ marginTop: '32px' }} aria-labelledby="g-h">
          <div className="sec-h"><h2 id="g-h" className="h h2" style={{ fontSize: '34px' }}>{seg.gridTitle}</h2><Link href={L('/yuz-parvarishi')} className="pill line">{tr('Katalogda filtrlash')} <Icon name="right" size={16} /></Link></div>
          <div className="pgrid">{seg.grid.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>
        </section>
      )}
      <section style={{ marginTop: '32px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {seg.avoid.length > 0 && (
          <div className="card pad-m" style={{ flex: '1 1 420px', padding: '28px', background: '#2A211E', color: '#FBFAF7', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <b className="h" style={{ fontSize: '24px' }}>{tr('Bir narsadan ehtiyot boʻling')}</b>
            {seg.avoid.map((a) => <span key={a} style={{ display: 'flex', gap: '10px', lineHeight: 1.55, fontSize: '15px', color: '#E9E1DC' }}><span style={{ color: '#F2D6D0' }}>—</span>{a}</span>)}
            <span style={{ fontSize: '12px', color: '#B9ADA6', marginTop: 'auto' }}>{tr('Bu umumiy maslahat. Muammo kuchli boʻlsa — dermatologga murojaat qiling.')}</span>
          </div>
        )}
        {seg.faq.length > 0 && (
          <div className="card pad-m" style={{ flex: '1 1 420px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <b className="h" style={{ fontSize: '24px', marginBottom: '8px' }}>{tr('Koʻp soʻrashadi')}</b>
            {seg.faq.map((f) => <div key={f.q} style={{ padding: '12px 0', borderTop: '1px solid #EFE9E3' }}><b style={{ fontWeight: 600, fontSize: '15px' }}>{f.q}</b><p className="muted" style={{ margin: '6px 0 0', lineHeight: 1.55, fontSize: '14px' }}>{f.a}</p></div>)}
          </div>
        )}
      </section>
    </div>
  )
}
