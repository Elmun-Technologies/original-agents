'use client'
// ProductCard (design/source/common.py: card()).
import Link from 'next/link'

import { fmt, sum } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'
import { Icon } from './icons'
import { useShop, type CardProduct } from './shop'

/** compact = phone card from design/source/p_mobile.py mcard(). */
export function ProductCard({ p, lang, compact = false }: { p: CardProduct; lang: Lang; compact?: boolean }) {
  const shop = useShop()
  const fav = shop.isFav(p.slug)
  const url = href(lang, `/mahsulot/${p.slug}`)
  const title = `${p.brand} ${p.name}`
  // Design: "★ 4,9 · 214 sharh · 55 ml". Without verified reviews the line keeps its place with type · volume.
  const meta = (p.reviews
    ? [`${String(p.rating?.toFixed(1)).replace('.', ',')} · ${tn(lang, '[N] sharh', p.reviews)}`, p.vol]
    : [p.type || t(lang, 'Yangi mahsulot'), p.vol]).filter(Boolean)
  if (compact) return (
    <div className="pc" style={{ padding: '8px' }}>
      <Link href={url} className="pimg" aria-label={title}><img className="ph" src={p.img} alt={title} loading="lazy" /></Link>
      {p.tags.length > 0 && (
        <span style={{ position: 'absolute', top: '14px', left: '14px', display: 'flex', gap: '4px' }}>
          {p.tags.map((tg) => <span key={tg.t} className={`chip ${tg.cls}`} style={{ fontSize: '11px', padding: '3px 8px' }}>{t(lang, tg.t)}</span>)}
        </span>
      )}
      <button className={`fav${fav ? ' on' : ''}`} style={{ top: '12px', right: '12px', width: '34px', height: '34px' }} aria-label={t(lang, 'Sevimlilarga')} aria-pressed={fav} onClick={() => shop.toggleFav(p.slug)}><Icon name="heart" size={16} /></button>
      <span style={{ padding: '8px 4px 0', display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
        <span style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}><b className="num" style={{ fontSize: '16px', fontWeight: 500 }}>{fmt(p.price)}</b>{p.old ? <span className="old" style={{ fontSize: '12px' }}>{fmt(p.old)}</span> : null}</span>
        <Link href={url} style={{ fontSize: '12px', lineHeight: 1.3, minHeight: '31px', textDecoration: 'none' }}><b style={{ fontWeight: 600 }}>{p.brand}</b> {p.name}</Link>
        <span className="muted" style={{ fontSize: '11px' }}>{p.reviews ? <span className="stars">★ </span> : null}{meta.join(' · ')}</span>
      </span>
      <button className="addbtn" style={{ marginTop: '8px', minHeight: '40px', fontSize: '13px' }} onClick={() => shop.add(p)}>{shop.inCart(p.sku) ? t(lang, 'Savatda ✓') : t(lang, 'Savatga')}</button>
    </div>
  )
  return (
    <div className="pc">
      <Link href={url} className="pimg zoom" aria-label={title}><img className="ph" src={p.img} alt={title} loading="lazy" /></Link>
      {p.tags.length > 0 && (
        <span style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '4px' }}>
          {p.tags.map((tg) => <span key={tg.t} className={`chip ${tg.cls}`}>{t(lang, tg.t)}</span>)}
        </span>
      )}
      <button className={`fav${fav ? ' on' : ''}`} aria-label={t(lang, 'Sevimlilarga')} aria-pressed={fav} onClick={() => shop.toggleFav(p.slug)}><Icon name="heart" size={18} /></button>
      <div style={{ padding: '12px 6px 0', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
          <span className="num" style={{ fontSize: '19px' }}>{fmt(p.price)} {sum(lang)}</span>
          {p.old ? <span className="old">{fmt(p.old)}</span> : null}
        </span>
        <Link href={url} style={{ textDecoration: 'none', fontSize: '14px', lineHeight: 1.35, minHeight: '38px' }}><b style={{ fontWeight: 600 }}>{p.brand}</b> {p.name}</Link>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }} className="muted">
          {p.reviews ? <span className="stars">★</span> : null}{meta.join(' · ')}
        </span>
      </div>
      <button className="addbtn" style={{ marginTop: '10px' }} onClick={() => shop.add(p)}>
        <Icon name="bag" size={16} /> {shop.inCart(p.sku) ? t(lang, 'Savatda ✓') : t(lang, 'Savatga')}
      </button>
    </div>
  )
}
