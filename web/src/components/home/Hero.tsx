'use client'
// Promo slider + AI card + gift card (design/preview/Main.html, section 0).
import Link from 'next/link'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { href, t, type Lang } from '@/lib/i18n'

export type Slide = { tagShort?: string; titleShort?: string; ctaShort?: string; tag?: string; tagStyle?: string; title: string; text?: string; cta?: string; link?: string; img: string; pos?: string; bg?: string; alt: string }

export function Hero({ lang, slides, giftFrom }: { lang: Lang; slides: Slide[]; giftFrom: string }) {
  const [i, setI] = useState(0)
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const s = slides[i] ?? slides[0]
  return (
    <section className="wrap" style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }} aria-label={tr('Aksiyalar')}>
      {s && (
        <div className="card" style={{ flex: '999 1 640px', minWidth: 0, minHeight: '460px', background: s.bg || '#F2D6D0' }}>
          <img className="ph" src={s.img} alt={s.alt} style={{ position: 'absolute', right: 0, top: 0, width: '52%', height: '100%', objectFit: 'cover', objectPosition: s.pos || '50% 50%' }} />
          <div className="pad-m hero-txt" style={{ position: 'relative', width: '52%', minWidth: '300px', boxSizing: 'border-box', padding: '44px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '24px', minHeight: '460px' }}>
            {s.tag ? <span className={`chip ${s.tagStyle || 'tag-sale'}`} style={{ alignSelf: 'flex-start', height: '30px', fontSize: '13px' }}>{s.tag}</span> : <span />}
            <div>
              <h1 className="h h1" style={{ fontSize: '52px', lineHeight: 1.02 }}>{s.title}</h1>
              {s.text && <p style={{ fontSize: '17px', lineHeight: 1.55, margin: '16px 0 0', color: '#4A3F3A' }}>{s.text}</p>}
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {s.cta && <Link href={L(s.link || '/katalog/serum')} className="pill dark" style={{ minHeight: '52px', padding: '0 26px' }}>{s.cta} <Icon name="right" size={16} /></Link>}
              {slides.length > 1 && (
                <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                  {slides.map((_, j) => (
                    <button key={j} aria-label={`Banner ${j + 1}`} aria-current={i === j} onClick={() => setI(j)}
                      style={{ width: i === j ? '26px' : '8px', height: '8px', borderRadius: '999px', border: 'none', padding: 0, background: i === j ? '#2A211E' : 'rgba(42,33,30,.25)', cursor: 'pointer', transition: 'width .3s' }} />
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Link href={L('/maslahatchi')} className="card zoom" style={{ flex: 1, minHeight: '224px', textDecoration: 'none', background: '#2A211E', color: '#FBFAF7', display: 'flex' }}>
          <img src="/img/face-serum.jpg" alt="" style={{ position: 'absolute', right: 0, top: 0, width: '44%', height: '100%', objectFit: 'cover', objectPosition: '40% 30%' }} />
          <span style={{ position: 'relative', width: '60%', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px', boxSizing: 'border-box' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#F2D6D0' }}><Icon name="spark" size={15} /> {tr('AI maslahatchi')}</span>
            <span className="h" style={{ fontSize: '24px', lineHeight: 1.15 }}>{tr('Nima olishni bilmayapsizmi? Yozing — 1 daqiqada tanlab beraman')}</span>
            <span style={{ fontSize: '14px', textDecoration: 'underline' }}>{tr('Suhbatni boshlash')}</span>
          </span>
        </Link>
        <Link href={L('/sovgalar')} className="card zoom" style={{ flex: 1, minHeight: '224px', textDecoration: 'none', background: '#F2D6D0' }}>
          <img className="ph" src="/img/p-flatlay-pink.jpg" alt={tr('Serumlar toʻplami')} style={{ position: 'absolute', inset: 0 }} />
          <span className="glass" style={{ position: 'absolute', left: '12px', bottom: '12px', right: '12px', borderRadius: '16px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <b style={{ font: "600 17px 'Inter Tight', sans-serif" }}>{tr('Sovgʻa toʻplamlari')}</b>
              <span style={{ fontSize: '13px' }} className="muted">{tr('Qutida, tabriknoma bilan · 599 000 soʻmdan').replace('599 000', giftFrom)}</span>
            </span>
            <Icon name="right" size={18} />
          </span>
        </Link>
      </div>
    </section>
  )
}
