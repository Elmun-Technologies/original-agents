'use client'
// Favorites — design/preview/Favorites.html. Saved slugs live in the browser (shop context); ?s=a,b opens a shared gift list.
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ProductCard } from '@/components/ProductCard'
import { useShop } from '@/components/shop'
import type { HomeCard } from '@/lib/catalog'
import { fmt, sum } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'

const X = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
const GIFT = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="2"></rect><path d="M12 9v12M3 13h18M12 9c-2-4-6-4-6-1s6 1 6 1 6 2 6-1-4-3-6 1"></path></svg>
const BAG = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2L5 8z"></path><path d="M9 8a3 3 0 0 1 6 0"></path></svg>

export function FavoritesPage({ lang, products, telegram }: { lang: Lang; products: HomeCard[]; telegram: string }) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const shop = useShop()
  const [shared, setShared] = useState<string[] | null>(null)
  const [copied, setCopied] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the shared list is in the URL, known only in the browser
  useEffect(() => { const s = new URLSearchParams(location.search).get('s'); if (s) setShared(s.split(',').filter(Boolean)) }, [])
  const slugs = shared ?? shop.favs
  const list = slugs.map((s) => products.find((p) => p.slug === s)).filter((p): p is HomeCard => !!p)
  const cats = new Set(list.map((p) => p.category))
  const similar = products.filter((p) => !slugs.includes(p.slug) && cats.has(p.category)).concat(products.filter((p) => !slugs.includes(p.slug) && !cats.has(p.category))).slice(0, 5)
  const share = async () => {
    const url = `${location.origin}${L('/sevimlilar')}?s=${list.map((p) => p.slug).join(',')}`
    try { if (navigator.share) await navigator.share({ title: tr('Sovgʻa roʻyxatim'), url }); else { await navigator.clipboard.writeText(url); setCopied(true) } } catch {}
  }
  const chip = (p: HomeCard): [string, string, string] | null =>
    p.stock === 0 ? [tr('Tugab qoldi'), '#F0EBE5', '#6B5F59']
      : p.old ? [tn(lang, 'Aksiyada −[N]%', Math.round((1 - p.price / p.old) * 100)), '#F2D6D0', '#A8475C']
      : p.stock <= 3 ? [tn(lang, 'Faqat [N] dona qoldi', p.stock), '#F5DCC9', '#2A211E'] : null
  return (
    <div className="wrap" style={{ marginTop: '20px' }}>
      <section className="sec-h" style={{ alignItems: 'flex-end' }}>
        <div><h1 className="h h1" style={{ fontSize: '44px' }}>{tr(shared ? 'Sovgʻa roʻyxati' : 'Sevimlilar')} <span className="muted" style={{ fontSize: '22px' }}>{list.length || ''}</span></h1><p className="muted" style={{ margin: '6px 0 0', fontSize: '15px' }}>{tr(shared ? 'Doʻstingiz shu mahsulotlarni yoqtiradi.' : 'Shu qurilmada saqlanadi. Yurakchani bosib qoʻshasiz.')}</p></div>
        {list.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {!shared && <button className="pill line" onClick={share}>{GIFT} {copied ? tr('Havola nusxalandi ✓') : tr('Sovgʻa roʻyxati sifatida ulashish')}</button>}
            <button className="pill dark" onClick={() => list.filter((p) => p.stock > 0 && !shop.inCart(p.sku)).forEach((p) => shop.add(p))}>{BAG} {tr('Borlarini savatga')}</button>
          </div>
        )}
      </section>

      {list.length === 0 ? (
        <section className="card" style={{ marginTop: '18px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <b className="h" style={{ fontSize: '24px' }}>{tr('Hali hech narsa saqlanmagan')}</b>
          <span className="muted">{tr('Yoqqan mahsulotdagi yurakchani bosing — shu yerda paydo boʻladi.')}</span>
          <Link href={L('/yuz-parvarishi')} className="pill dark">{tr('Katalogga oʻtish')}</Link>
        </section>
      ) : (
        <section style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {list.map((p) => {
            const c = chip(p)
            return (
              <div key={p.slug} className="card" data-g="fav" style={{ padding: '14px', display: 'grid', gap: '20px', alignItems: 'center' }}>
                <Link href={L(`/mahsulot/${p.slug}`)} className="zoom" style={{ display: 'block', width: '120px', height: '120px', borderRadius: '18px', overflow: 'hidden' }}><img loading="lazy" decoding="async" className="ph" src={p.img} alt={`${p.brand} ${p.name}`} /></Link>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  {c && <span className="chip" style={{ alignSelf: 'flex-start', background: c[1], color: c[2] }}>{c[0]}</span>}
                  <Link href={L(`/mahsulot/${p.slug}`)} style={{ textDecoration: 'none', fontSize: '17px' }}><b style={{ fontWeight: 600 }}>{p.brand}</b> {p.name}</Link>
                  <span className="muted" style={{ fontSize: '13px' }}>{[p.type, p.vol].filter(Boolean).join(' · ')}{p.rating ? <> · <span className="stars">★</span> {p.rating.toFixed(1).replace('.', ',')}</> : null}</span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                  <span style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}><span className="num" style={{ fontSize: '22px' }}>{fmt(p.price)} {sum(lang)}</span>{p.old && <span className="old">{fmt(p.old)}</span>}</span>
                  <span style={{ display: 'flex', gap: '6px' }}>
                    {!shared && <button className="ib" aria-label={tr('Oʻchirish')} onClick={() => shop.toggleFav(p.slug)}>{X}</button>}
                    {p.stock > 0
                      ? <button className="pill dark" style={{ minHeight: '46px' }} onClick={() => shop.add(p)}>{shop.inCart(p.sku) ? tr('Savatda ✓') : tr('Savatga')}</button>
                      : <a className="pill line" style={{ minHeight: '46px' }} href={telegram} target="_blank" rel="noopener">{tr('Qachon kelishini soʻrash')}</a>}
                  </span>
                </span>
              </div>
            )
          })}
        </section>
      )}

      {similar.length > 0 && (
        <section style={{ marginTop: '32px' }} aria-labelledby="sim-h">
          <h2 id="sim-h" className="h h2" style={{ fontSize: '30px', marginBottom: '16px' }}>{tr(list.length ? 'Saqlaganlaringizga oʻxshash' : 'Koʻpchilik saqlaydi')}</h2>
          <div className="pgrid">{similar.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>
        </section>
      )}
    </div>
  )
}
