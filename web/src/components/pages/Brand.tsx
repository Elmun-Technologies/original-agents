'use client'
// Brand page — design/preview/Brand.html (generated, then wired to the brand + its products).
import Link from 'next/link'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { ProductCard } from '@/components/ProductCard'
import type { CardProduct } from '@/components/shop'
import { href, t, tn, type Lang } from '@/lib/i18n'

export type BrandData = {
  slug: string; name: string; about?: string; country?: string; cover?: string
  lines: { name: string; keyword: string; color: string; note?: string; who?: string }[]
  faq: { q: string; a: string }[]
}

export function BrandPage({ lang, brand, products, others, minMonths }: { lang: Lang; brand: BrandData; products: CardProduct[]; others: { slug: string; name: string }[]; minMonths?: number }) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const [line, setLine] = useState(-1)
  const kw = line >= 0 ? brand.lines[line].keyword.toLowerCase() : ''
  const list = products.filter((p) => !kw || p.name.toLowerCase().includes(kw))
  const lineCard = (on: boolean) => ({ padding: '22px', textAlign: 'left' as const, cursor: 'pointer', font: 'inherit', color: '#2A211E', border: `1.5px solid ${on ? '#2A211E' : 'transparent'}`, background: on ? '#FBFAF7' : '#F6F3EF', display: 'flex', flexDirection: 'column' as const, gap: '8px' })
  return (
    <div className="wrap" style={{ marginTop: '16px' }}>
      <nav aria-label={tr('Yoʻl')} className="muted" style={{ fontSize: '13px', display: 'flex', gap: '8px' }}><Link href={L('/')} style={{ color: '#6B5F59' }}>{tr('Bosh sahifa')}</Link><span>/</span><Link href={L('/brendlar')} style={{ color: '#6B5F59' }}>{tr('Brendlar')}</Link><span>/</span><span style={{ color: '#2A211E' }}>{brand.name}</span></nav>
      <section className="card" style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', minHeight: '380px' }}>
        <div className="pad-m" style={{ flex: '1 1 520px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
          <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{brand.country && <span className="chip">{brand.country}</span>}<span className="chip"><Icon name="shield" size={13} /> {tr('Rasmiy yetkazib beruvchidan')}</span></span>
          <h1 className="h h1" style={{ fontSize: '64px', lineHeight: 1 }}>{brand.name}</h1>
          {brand.about && <p style={{ margin: 0, fontSize: '17px', lineHeight: 1.6, color: '#4A3F3A', maxWidth: '540px' }}>{brand.about}</p>}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {brand.lines.length > 0 && <a href="#lines" className="pill dark">{tr('Liniyani tanlash')}</a>}
            <a href="#all" className={brand.lines.length ? 'pill' : 'pill dark'}>{tn(lang, 'Barcha [N] mahsulot', products.length)}</a>
          </div>
        </div>
        {brand.cover && <div style={{ flex: '1 1 460px', minHeight: '380px', position: 'relative' }}><img className="ph" src={brand.cover} alt={brand.name} style={{ position: 'absolute', inset: 0 }} /></div>}
      </section>
      <section style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }} aria-label={tr('Kafolatlar')}>
        <div className="card" style={{ padding: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}><Icon name="shield" /><span style={{ fontSize: '14px', lineHeight: 1.5 }}><b style={{ fontWeight: 600 }}>{tr('Original ekanini tekshiring')}</b><br /><span className="muted">{tr('Har qutida partiya raqami — sertifikatni mahsulot sahifasida koʻrasiz')}</span></span></div>
        <div className="card" style={{ padding: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}><Icon name="truck" /><span style={{ fontSize: '14px', lineHeight: 1.5 }}><b style={{ fontWeight: 600 }}>{tr('Toshkent omboridan')}</b><br /><span className="muted">{tr('Bugun buyurtma — ertaga uyingizda')}</span></span></div>
        {minMonths ? <div className="card" style={{ padding: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}><Icon name="ret" /><span style={{ fontSize: '14px', lineHeight: 1.5 }}><b style={{ fontWeight: 600 }}>{tr('Yaroqlilik muddati')}</b><br /><span className="muted">{tn(lang, 'Kamida [N] oy qolgan mahsulotlarni yuboramiz', minMonths)}</span></span></div> : null}
      </section>
      {brand.lines.length > 0 && (
        <section id="lines" style={{ marginTop: '36px' }} aria-labelledby="l-h">
          <h2 id="l-h" className="h h2" style={{ fontSize: '34px' }}>{tr('Qaysi liniya sizga?')}</h2>
          <p className="muted" style={{ margin: '6px 0 16px', fontSize: '15px' }}>{tr('Rangli qopqoqlar bejiz emas: har biri boshqa muammo uchun.')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            <button aria-pressed={line < 0} className="card" style={lineCard(line < 0)} onClick={() => setLine(-1)}>
              <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#E2DAD2' }} /><b className="h" style={{ fontSize: '22px' }}>{tr('Barchasi')}</b>
              <span style={{ fontSize: '14px', lineHeight: 1.5 }}>{tr('Brenddagi hamma mahsulotlar bir joyda.')}</span><span className="muted" style={{ fontSize: '13px' }}>{tr('Kimga: koʻrib chiqmoqchi boʻlganlarga')}</span>
            </button>
            {brand.lines.map((l, i) => (
              <button key={l.keyword} aria-pressed={line === i} className="card" style={lineCard(line === i)} onClick={() => setLine(i)}>
                <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: l.color }} /><b className="h" style={{ fontSize: '22px' }}>{l.name}</b>
                {l.note && <span style={{ fontSize: '14px', lineHeight: 1.5 }}>{l.note}</span>}{l.who && <span className="muted" style={{ fontSize: '13px' }}>{l.who}</span>}
              </button>
            ))}
          </div>
        </section>
      )}
      <section id="all" style={{ marginTop: '32px' }} aria-labelledby="a-h">
        <div className="sec-h"><h2 id="a-h" className="h h2" style={{ fontSize: '30px' }}>{tn(lang, 'Barcha [N] mahsulotlari', brand.name)}</h2><span className="muted" style={{ fontSize: '14px' }}>{tn(lang, '[N] ta mahsulot', list.length)}</span></div>
        <div className="pgrid">{list.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>
      </section>
      <section style={{ marginTop: '32px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {brand.faq.length > 0 && (
          <div className="card pad-m" style={{ flex: '1 1 420px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <b className="h" style={{ fontSize: '24px', marginBottom: '8px' }}>{tn(lang, '[N] haqida koʻp soʻrashadi', brand.name)}</b>
            {brand.faq.map((f) => <div key={f.q} style={{ padding: '12px 0', borderTop: '1px solid #EFE9E3' }}><b style={{ fontWeight: 600, fontSize: '15px' }}>{f.q}</b><p className="muted" style={{ margin: '6px 0 0', lineHeight: 1.55, fontSize: '14px' }}>{f.a}</p></div>)}
          </div>
        )}
        <div className="card pad-m" style={{ flex: '1 1 420px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <b className="h" style={{ fontSize: '24px' }}>{tr('Boshqa brendlar')}</b>
          <div data-g="2" style={{ display: 'grid', gap: '8px' }}>
            {others.slice(0, 5).map((o) => <Link key={o.slug} href={L(`/brend/${o.slug}`)} className="pill line" style={{ justifyContent: 'space-between' }}>{o.name} <Icon name="right" size={16} /></Link>)}
            <Link href={L('/brendlar')} className="pill line" style={{ justifyContent: 'space-between' }}>{tr('Barcha brendlar')} <Icon name="right" size={16} /></Link>
          </div>
        </div>
      </section>
    </div>
  )
}
