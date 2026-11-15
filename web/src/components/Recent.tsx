'use client'
// "Siz yaqinda koʻrgansiz" (design/preview/Catalog.html section 5). Kept in the browser only.
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { fmt, sum } from '@/lib/format'
import { href, t, type Lang } from '@/lib/i18n'
import type { CardProduct } from './shop'

const KEY = 'yeppo:recent:v1'
type Seen = Pick<CardProduct, 'slug' | 'brand' | 'name' | 'img' | 'price'>

/** Called by the product page: newest first, max 12. */
export function rememberView(p: Seen) {
  try {
    const list: Seen[] = JSON.parse(localStorage.getItem(KEY) || '[]')
    localStorage.setItem(KEY, JSON.stringify([p, ...list.filter((x) => x.slug !== p.slug)].slice(0, 12)))
  } catch {}
}

export function RememberView(p: Seen) {
  useEffect(() => rememberView(p), [p])
  return null
}

export function RecentlyViewed({ lang, exclude }: { lang: Lang; exclude?: string }) {
  const [list, setList] = useState<Seen[]>([])
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only data, read after mount
      setList((JSON.parse(localStorage.getItem(KEY) || '[]') as Seen[]).filter((x) => x.slug !== exclude))
    } catch {}
  }, [exclude])
  if (!list.length) return null
  return (
    <section style={{ marginTop: '40px' }} aria-labelledby="rv-h">
      <h2 id="rv-h" className="h" style={{ fontSize: '28px', marginBottom: '16px' }}>{t(lang, 'Siz yaqinda koʻrgansiz')}</h2>
      <div className="hs">
        {list.map((p) => (
          <Link key={p.slug} href={href(lang, `/mahsulot/${p.slug}`)} className="card" style={{ flex: 'none', width: '260px', padding: '8px', display: 'flex', gap: '12px', alignItems: 'center', textDecoration: 'none', borderRadius: '18px' }}>
            <img loading="lazy" decoding="async" src={p.img} alt="" style={{ width: '72px', height: '72px', borderRadius: '12px', objectFit: 'cover' }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', lineHeight: 1.3 }}>
              <span><b style={{ fontWeight: 600 }}>{p.brand}</b> {p.name}</span>
              <span className="num" style={{ fontSize: '15px' }}>{fmt(p.price)} {sum(lang)}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
