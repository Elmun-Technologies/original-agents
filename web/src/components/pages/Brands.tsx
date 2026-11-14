'use client'
// Brands A–Z — design/preview/Brands.html (generated, then wired to the brands collection).
import Link from 'next/link'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { href, t, tn, type Lang } from '@/lib/i18n'

export type BrandRow = { slug: string; name: string; tagline?: string; short?: string; cover?: string; featured: boolean; count: number }

export function BrandsPage({ lang, brands, telegramUrl }: { lang: Lang; brands: BrandRow[]; telegramUrl: string }) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const [letter, setLetter] = useState<string | null>(null)
  const first = (n: string) => n.trim()[0]?.toUpperCase() ?? '#'
  const letters = [...new Set(brands.map((b) => first(b.name)))].sort()
  const list = brands.filter((b) => !letter || first(b.name) === letter).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  const featured = brands.filter((b) => b.featured && b.cover).slice(0, 4)
  return (
    <div className="wrap" style={{ marginTop: '16px' }}>
      <nav aria-label={tr('Yoʻl')} className="muted" style={{ fontSize: '13px', display: 'flex', gap: '8px' }}><Link href={L('/')} style={{ color: '#6B5F59' }}>{tr('Bosh sahifa')}</Link><span>/</span><span style={{ color: '#2A211E' }}>{tr('Brendlar')}</span></nav>
      <section style={{ marginTop: '10px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 560px' }}><h1 className="h h1" style={{ fontSize: '52px' }}>{tr('Brendlar')}</h1><p style={{ margin: '10px 0 0', fontSize: '17px', lineHeight: 1.6, color: '#4A3F3A', maxWidth: '620px' }}>{tr('Faqat Koreyadan keltiriladigan brendlar. Har birining oʻz «yulduzi» bor — qisqacha yozib qoʻydik, qayerdan boshlashni bilasiz.')}</p></div>
        <span className="chip" style={{ minHeight: '40px', padding: '0 16px' }}><Icon name="shield" size={15} /> {tr('Barcha brendlar — rasmiy hujjatlar bilan')}</span>
      </section>
      {featured.length > 0 && (
        <section data-g="4" style={{ marginTop: '20px', display: 'grid', gap: '12px' }} aria-label={tr('Tanlangan brendlar')}>
          {featured.map((b) => (
            <Link key={b.slug} href={L(`/brend/${b.slug}`)} className="card zoom" style={{ textDecoration: 'none', minHeight: '300px', display: 'flex', alignItems: 'flex-end', color: '#FBFAF7' }}>
              <img className="ph" src={b.cover} alt="" style={{ position: 'absolute', inset: 0, objectPosition: '50% 50%' }} /><span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(42,33,30,.72))' }} />
              <span style={{ position: 'relative', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}><b className="h" style={{ fontSize: '26px' }}>{b.name}</b>{b.tagline && <span style={{ fontSize: '14px' }}>{b.tagline}</span>}</span>
            </Link>
          ))}
        </section>
      )}
      <section className="card pad-m" style={{ marginTop: '16px', padding: '28px' }} aria-labelledby="az-h">
        <div className="sec-h"><h2 id="az-h" className="h h2" style={{ fontSize: '30px' }}>{tr('A dan Z gacha')}</h2><span className="muted" style={{ fontSize: '14px' }}>{tn(lang, '[N] ta brend', brands.length)}</span></div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '14px 0 18px' }}>
          {[null, ...letters].map((l) => <button key={l ?? 'all'} className={letter === l ? 'pill dark' : 'pill ghost'} style={{ minWidth: '44px', minHeight: '44px', padding: '0 10px' }} aria-pressed={letter === l} onClick={() => setLetter(l)}>{l ?? tr('Hammasi')}</button>)}
        </div>
        <div data-g="3" style={{ display: 'grid', gap: '8px 24px' }}>
          {list.map((b) => (
            <Link key={b.slug} href={L(`/brend/${b.slug}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 0', borderTop: '1px solid #EFE9E3', textDecoration: 'none' }}>
              <span><b style={{ fontWeight: 600, fontSize: '16px' }}>{b.name}</b>{b.short && <><br /><span className="muted" style={{ fontSize: '13px' }}>{b.short}</span></>}</span>
              <span className="muted" style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{tn(lang, '[N] ta', b.count)} <Icon name="right" size={14} /></span>
            </Link>
          ))}
        </div>
      </section>
      <section className="card pad-m" style={{ marginTop: '16px', padding: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', background: '#F2D6D0' }}>
        <span style={{ flex: '1 1 420px', fontSize: '16px', lineHeight: 1.55 }}><b style={{ fontWeight: 600 }}>{tr('Kerakli brend roʻyxatda yoʻqmi?')}</b> {tr('Yozing — Koreyadan buyurtma bilan olib kelamiz va qachon kelishini aytamiz.')}</span>
        <a href={telegramUrl} className="pill dark"><Icon name="tg" size={17} /> {tr('Brendni soʻrash')}</a>
      </section>
    </div>
  )
}
