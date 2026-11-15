'use client'
// Search — design/preview/Search.html (generated, then wired). Results come from the server (lib/search.ts).
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { ProductCard } from '@/components/ProductCard'
import type { CardProduct } from '@/components/shop'
import { href, t, tn, type Lang } from '@/lib/i18n'

const EXAMPLES = ['quruq teri uchun krem', 'yuzim yogʻlanadi', 'SPF yopishqoq boʻlmasin', 'sovgʻa onamga']

export function SearchPage({ lang, q, chips, hits, closest, popular, cats }: {
  lang: Lang; q: string; chips: string[]; hits: CardProduct[]; closest: boolean; popular: string[]; cats: { slug: string; title: string; n: number }[]
}) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const router = useRouter()
  const [value, setValue] = useState(q)
  const go = (v: string) => router.push(L(`/qidiruv?q=${encodeURIComponent(v)}`))
  return (
    <div className="wrap" style={{ marginTop: '20px' }}>
      {/* phone: own top bar instead of the site header (design: MobileSearch) */}
      <div className="m-top m-only" style={{ flexDirection: 'column', gap: '10px', margin: '-20px -12px 0' }}>
        <form role="search" onSubmit={(e) => { e.preventDefault(); if (value.trim()) go(value.trim()) }} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button type="button" className="ib" aria-label={tr('Orqaga')} onClick={() => (history.length > 1 ? router.back() : router.push(L('/')))}><Icon name="left" /></button>
          <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', height: '48px', padding: '0 8px 0 16px', borderRadius: '999px', background: '#FBFAF7', border: '1.5px solid #2A211E', minWidth: 0 }}>
            <Icon name="search" size={18} />
            <input name="q" value={value} onChange={(e) => setValue(e.target.value)} placeholder={tr('Krem, SPF yoki muammoni yozing')} aria-label={tr('Qidiruv soʻrovi')} enterKeyHint="search" autoFocus={!q} style={{ border: 'none', background: 'transparent', font: '500 16px Inter, sans-serif', color: '#2A211E', flex: 1, minWidth: 0, outline: 'none' }} />
            {value && <button type="button" className="ib" style={{ width: '36px', height: '36px' }} aria-label={tr('Tozalash')} onClick={() => setValue('')}><Icon name="x" size={16} /></button>}
          </span>
        </form>
        {q && chips.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', overflowX: 'auto', fontSize: '13px' }}>
            <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', color: '#A8475C', fontWeight: 600, whiteSpace: 'nowrap' }}><Icon name="spark" size={14} /> {tr('Tushundim:')}</span>
            {chips.map((c) => <span key={c} className="chip" style={{ background: '#F2D6D0' }}>{c}</span>)}
          </div>
        )}
      </div>
      <section className="card pad-m hide-m" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }} aria-label={tr('Qidiruv')}>
        <form role="search" onSubmit={(e) => { e.preventDefault(); if (value.trim()) go(value.trim()) }} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 6px 6px 20px', borderRadius: '999px', background: '#fff', border: '1.5px solid #2A211E' }}>
          <Icon name="search" />
          <input className="inp" name="q" value={value} onChange={(e) => setValue(e.target.value)} placeholder={tr('Masalan: quruq teri uchun krem, SPF, centella…')} aria-label={tr('Qidiruv soʻrovi')} autoFocus={!q} style={{ border: 'none', background: 'transparent', fontSize: '20px', padding: '10px 0', flex: 1, minHeight: 0, minWidth: 0 }} />
          {value && <button type="button" className="ib" aria-label={tr('Tozalash')} onClick={() => setValue('')}><Icon name="x" /></button>}
          <button className="pill dark" style={{ minHeight: '50px' }}>{tr('Qidirish')}</button>
        </form>
        {q && chips.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', fontSize: '14px' }}>
            <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', color: '#A8475C', fontWeight: 600 }}><Icon name="spark" size={15} /> {tr('Tushundim:')}</span>
            {chips.map((c) => <span key={c} className="chip" style={{ background: '#F2D6D0' }}>{c}</span>)}
            {!closest && <span className="muted">{tn(lang, '— shunga mos [N] ta mahsulot topdim', hits.length)}</span>}
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: '13px', alignSelf: 'center', marginRight: '4px' }}>{tr('Boshqacha soʻrab koʻring:')}</span>
          {EXAMPLES.map((e) => <button key={e} className={tr(e) === q ? 'pill dark' : 'pill line'} style={{ minHeight: '38px', fontSize: '13px' }} onClick={() => { setValue(tr(e)); go(tr(e)) }}>{tr(e)}</button>)}
        </div>
      </section>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px', alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 720px', minWidth: 0 }}>
          {q ? (
            <>
              <div className="sec-h" style={{ marginBottom: '12px' }} data-m="search-h">
                <h1 className="h" style={{ fontSize: '26px' }}>{closest ? tn(lang, '«[N]» boʻyicha aniq mos mahsulot topilmadi — eng yaqinlari', q) : tn(lang, '«[N]» boʻyicha', q)}</h1>
                {!closest && <span className="muted" style={{ fontSize: '14px' }}>{tr('Avval eng mos kelganlar')}</span>}
              </div>
              <div className="pgrid">{hits.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>
            </>
          ) : (
            <>
              <h1 className="h" style={{ fontSize: '26px' }}>{tr('Nima qidiryapsiz?')}</h1>
              <div className="m-only" style={{ flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                {EXAMPLES.map((e) => <button key={e} className="pill line" style={{ minHeight: '40px', fontSize: '14px' }} onClick={() => { setValue(tr(e)); go(tr(e)) }}>{tr(e)}</button>)}
              </div>
            </>
          )}
        </div>
        <aside style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {popular.length > 0 && (
            <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <b style={{ fontWeight: 600 }}>{tr('Boshqalar hozir qidirmoqda')}</b>
              {popular.map((p, i) => <button key={p} onClick={() => { setValue(p); go(p) }} style={{ border: 'none', background: 'none', padding: '6px 0', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: '#2A211E', display: 'flex', gap: '10px', alignItems: 'center', fontSize: '14px' }}><span className="num muted" style={{ width: '18px' }}>{i + 1}</span>{p}</button>)}
            </div>
          )}
          {cats.length > 0 && (
            <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <b style={{ fontWeight: 600 }}>{tr('Kategoriyalarda')}</b>
              {cats.map((c) => <Link key={c.slug} href={L(`/katalog/${c.slug}`)} style={{ display: 'flex', justifyContent: 'space-between', textDecoration: 'none', fontSize: '14px', padding: '4px 0' }}>{c.title}<span className="muted">{c.n}</span></Link>)}
            </div>
          )}
          <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#2A211E', color: '#FBFAF7' }}>
            <b style={{ fontWeight: 600, fontSize: '17px' }}>{tr('Aniq nima kerakligini bilmayapsizmi?')}</b>
            <span style={{ fontSize: '14px', lineHeight: 1.5, color: '#E9E1DC' }}>{tr('Muammoni oʻz soʻzingiz bilan yozing — 3 ta savol beraman va tanlab beraman.')}</span>
            <Link href={L('/maslahatchi')} className="pill" style={{ alignSelf: 'flex-start', borderColor: 'rgba(251,250,247,.3)', color: '#FBFAF7' }}><Icon name="spark" size={16} /> {tr('Maslahatchiga yozish')}</Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
