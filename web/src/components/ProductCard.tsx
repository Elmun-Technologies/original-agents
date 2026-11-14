'use client'
// ProductCard (design/source/common.py: card()).
import Link from 'next/link'

import { fmt, sum } from '@/lib/format'
import { href, t, type Lang } from '@/lib/i18n'
import { Icon } from './icons'
import { useShop, type CardProduct } from './shop'

export function ProductCard({ p, lang }: { p: CardProduct; lang: Lang }) {
  const shop = useShop()
  const fav = shop.isFav(p.slug)
  const url = href(lang, `/mahsulot/${p.slug}`)
  const title = `${p.brand} ${p.name}`
  const meta = [
    p.reviews ? `${String(p.rating?.toFixed(1)).replace('.', ',')} · ${p.reviews} ${t(lang, 'sharh')}` : null,
    p.vol || null,
  ].filter(Boolean)
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
        {meta.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }} className="muted">
            {p.reviews ? <span className="stars">★</span> : null}{meta.join(' · ')}
          </span>
        )}
      </div>
      <button className="addbtn" style={{ marginTop: '10px' }} onClick={() => shop.add(p)}>
        <Icon name="bag" size={16} /> {shop.inCart(p.sku) ? t(lang, 'Savatda ✓') : t(lang, 'Savatga')}
      </button>
    </div>
  )
}
