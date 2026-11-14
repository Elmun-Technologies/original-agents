'use client'
// Phone-only home top (design/screens/MobileHome.jpg, source p_mobile.py "home"). Shown ≤600 px instead of the
// desktop hero/guarantees/categories/picker/hits/segments.
import Link from 'next/link'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { ProductCard } from '@/components/ProductCard'
import type { CardProduct } from '@/components/shop'
import { href, t, type Lang } from '@/lib/i18n'
import type { Slide } from './Hero'

const CATS: [string, string, string][] = [
  ['Serumlar', '/katalog/serum', 'p-boj-glow'], ['SPF', '/katalog/spf', 'spf-missha'], ['Tozalash', '/katalog/tozalash', 'gel'],
  ['Niqoblar', '/katalog/niqoblar', 'sheet-mask'], ['Kremlar', '/katalog/krem', 'cream-smear'], ['Toʻplamlar', '/katalog/toplamlar', 'p-flatlay-pink'],
]
const SEGS: [string, string][] = [['Erkaklar', 'erkaklar'], ['18–25', '18-25'], ['25–35', '25-35'], ['35+', '35'], ['Boʻlajak onalar', 'onalar']]

export function MobileHome({ lang, slides, hits, cutoff }: { lang: Lang; slides: Slide[]; hits: CardProduct[]; cutoff: string }) {
  const [i, setI] = useState(0)
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const s = slides[i] ?? slides[0]
  const chip = { padding: '12px', borderRadius: '16px', background: '#FBFAF7', display: 'flex', gap: '8px', alignItems: 'center' }
  return (
    <div className="m-only" style={{ padding: '0 16px', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', padding: '10px 14px', borderRadius: '14px', background: '#E8F0E4', color: '#2F3A2B' }}>
        <Icon name="truck" size={16} /> {tr('Toshkent: bugun 18:00 gacha — ertaga uyingizda').replace('18:00', cutoff)}
      </div>
      {s && (
        <Link href={L(s.link || '/aksiyalar')} style={{ display: 'block', position: 'relative', height: '220px', borderRadius: '24px', overflow: 'hidden', textDecoration: 'none' }}>
          <img className="ph" src={s.img} alt="" style={{ position: 'absolute', inset: 0, objectPosition: s.pos }} />
          <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(42,33,30,.62), rgba(42,33,30,0) 75%)' }} />
          <span style={{ position: 'absolute', left: '18px', top: '18px', bottom: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#FBFAF7', maxWidth: '220px' }}>
            {s.tag ? <span className="chip" style={{ alignSelf: 'flex-start', background: 'rgba(251,250,247,.2)', color: '#FBFAF7' }}>{s.tagShort || s.tag}</span> : <span />}
            <b className="h" style={{ fontSize: '26px', lineHeight: 1.05 }}>{s.titleShort || s.title}</b>
            <span style={{ fontSize: '13px' }}>{s.ctaShort || s.cta} ›</span>
          </span>
        </Link>
      )}
      {slides.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '-8px' }}>
          {slides.map((_, j) => (
            <button key={j} aria-label={`Banner ${j + 1}`} aria-current={i === j} onClick={() => setI(j)}
              style={{ width: i === j ? '22px' : '6px', height: '6px', borderRadius: '3px', border: 'none', padding: 0, background: i === j ? '#2A211E' : '#CFC5BD' }} />
          ))}
        </div>
      )}
      <div className="hs" style={{ gap: '12px', margin: '0 -16px', padding: '0 16px' }}>
        {CATS.map(([label, p, img]) => (
          <Link key={label} href={L(p)} style={{ flex: 'none', width: '68px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '11px', textAlign: 'center' }}>
            <span style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden' }}><img className="ph" src={`/img/${img}.jpg`} alt="" /></span>{tr(label)}
          </Link>
        ))}
      </div>
      <Link href={L('/maslahatchi')} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '16px', borderRadius: '22px', background: '#2A211E', color: '#FBFAF7', textDecoration: 'none' }}>
        <span style={{ width: '46px', height: '46px', borderRadius: '50%', overflow: 'hidden', flex: 'none' }}><img className="ph" src="/img/face-white.jpg" alt="" style={{ objectPosition: '50% 25%' }} /></span>
        <span style={{ flex: 1, fontSize: '14px', lineHeight: 1.4 }}><b style={{ fontWeight: 600 }}>{tr('Nima olishni bilmayapsizmi?')}</b><br /><span style={{ color: '#D9CFC9' }}>{tr('3 ta savol — va tanlab beraman')}</span></span>
        <Icon name="right" size={20} />
      </Link>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
          <b className="h" style={{ fontSize: '22px' }}>{tr('Hozir koʻp olinmoqda')}</b><Link href={L('/aksiyalar#top')} style={{ fontSize: '13px' }}>{tr('Top-10 ›')}</Link>
        </div>
        <div className="hs" style={{ gap: '10px', margin: '0 -16px', padding: '0 16px' }}>
          {hits.map((p) => <div key={p.slug} style={{ flex: 'none', width: '168px' }}><ProductCard p={p} lang={lang} compact /></div>)}
        </div>
      </div>
      <div style={{ padding: '18px', borderRadius: '22px', background: '#F2D6D0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <b className="h" style={{ fontSize: '20px' }}>{tr('Kimga tanlaysiz?')}</b>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {SEGS.map(([label, slug]) => <Link key={slug} href={L(`/kim-uchun/${slug}`)} className="pill" style={{ minHeight: '38px', fontSize: '13px', background: '#FBFAF7' }}>{tr(label)}</Link>)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
        <span style={chip}><Icon name="shield" size={18} /> {tr('Faqat original')}</span>
        <span style={chip}><Icon name="card" size={18} /> Click · Payme</span>
      </div>
    </div>
  )
}
