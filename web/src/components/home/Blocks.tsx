'use client'
// Hits with tabs, weekly sale with timer, ready routine bundle (design/preview/Main.html sections 4, 5, 7).
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Icon } from '@/components/icons'
import { ProductCard } from '@/components/ProductCard'
import { useShop, type CardProduct } from '@/components/shop'
import { fmt, sum } from '@/lib/format'
import { href, t, type Lang } from '@/lib/i18n'

type Tabbed = CardProduct & { category: string }
const TABS: [string, string][] = [['all', 'Hammasi'], ['serum', 'Serumlar'], ['toner', 'Tonerlar'], ['spf', 'SPF']]

export function Hits({ lang, products }: { lang: Lang; products: Tabbed[] }) {
  const [tab, setTab] = useState('all')
  const tr = (s: string) => t(lang, s)
  const list = products.filter((p) => tab === 'all' || p.category === tab).slice(0, 5)
  return (
    <section className="wrap" style={{ marginTop: '40px' }} aria-labelledby="best-h">
      <div className="sec-h">
        <h2 id="best-h" className="h h2" style={{ fontSize: '40px' }}>{tr('Hozir eng koʻp')} <span className="serif">{tr('olinmoqda')}</span></h2>
        <div role="tablist" aria-label={tr('Toifa')} style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'pill dark' : 'pill ghost'} style={{ minHeight: '40px', fontSize: '14px' }} onClick={() => setTab(id)}>{tr(label)}</button>
          ))}
        </div>
      </div>
      <div className="pgrid">{list.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
        <Link href={href(lang, '/katalog/serum')} className="pill line" style={{ minHeight: '50px', padding: '0 28px' }}>{tr('Barcha mahsulotlar — katalogda')} <Icon name="right" size={16} /></Link>
      </div>
    </section>
  )
}

function left(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60]
}

/** Shown only while the sale banner is active and has products with a real discount. */
export function Sale({ lang, title, accent, endsAt, products }: { lang: Lang; title: string; accent?: string; endsAt: string; products: CardProduct[] }) {
  const tr = (s: string) => t(lang, s)
  const end = new Date(endsAt).getTime()
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  if (now !== null && now >= end) return null
  const parts = now === null ? null : left(end - now)
  const box = { display: 'inline-flex', flexDirection: 'column' as const, alignItems: 'center', minWidth: '56px', padding: '8px 0', borderRadius: '14px', background: 'rgba(255,255,255,.14)' }
  return (
    <section className="wrap" style={{ marginTop: '40px' }} aria-labelledby="deal-h">
      <div className="card pad-m" style={{ padding: '32px', background: '#A8475C', color: '#fff' }}>
        <div className="sec-h" style={{ marginBottom: '24px' }}>
          <div>
            <span style={{ font: '600 12px Inter, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: '#F9DCE1' }}>{tr('Faqat shu hafta')}</span>
            <h2 id="deal-h" className="h h2" style={{ fontSize: '40px', marginTop: '8px' }}>{title} {accent && <span className="serif">{accent}</span>}</h2>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} role="timer" aria-label={tr('Aksiya tugashiga')}>
            <span style={{ fontSize: '14px', marginRight: '6px', color: '#F9DCE1' }}>{tr('Tugashiga:')}</span>
            {(['kun', 'soat', 'daqiqa', 'soniya'] as const).map((l, i) => (
              <span key={l} style={box}>
                <b className="num" style={{ fontSize: '22px' }} suppressHydrationWarning>{parts ? (i ? String(parts[i]).padStart(2, '0') : parts[i]) : '–'}</b>
                <span style={{ fontSize: '11px', color: '#F9DCE1' }}>{tr(l)}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="pgrid" style={{ color: '#2A211E' }}>{products.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>
      </div>
    </section>
  )
}

/** Ready routine (section 7). Bundle price = sum −10% rounded to 1000; the struck price is the real sum of the 3 items.
 * Items go to the cart at their normal price; the bundle discount is applied by the server at checkout. */
export function Routine({ lang, products }: { lang: Lang; products: CardProduct[] }) {
  const tr = (s: string) => t(lang, s)
  const shop = useShop()
  const [added, setAdded] = useState(false)
  if (products.length < 3) return null
  const total = products.reduce((a, p) => a + p.price, 0)
  const bundle = Math.round((total * 0.9) / 1000) * 1000
  const steps = ['01 Toner', '02 Ampula', '03 SPF']
  return (
    <section className="wrap" style={{ marginTop: '40px' }} aria-labelledby="set-h">
      <div className="card pad-m" style={{ padding: '32px', display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span className="eyebrow">{tr('Tayyor rutina')}</span>
          <h2 id="set-h" className="h h2" style={{ fontSize: '36px', lineHeight: 1.08 }}>{tr('Qizarish va sezgir teri uchun')} <span className="serif">{tr('uchtalik')}</span></h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>{tr('Ertalab va kechqurun: toner → ampula → SPF. Alohida olgandan arzonroq.')}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px' }}>
            <span className="num" style={{ fontSize: '30px' }}>{fmt(bundle)} {sum(lang)}</span><span className="old" style={{ fontSize: '16px' }}>{fmt(total)}</span>
          </div>
          <span className="chip tag-sale" style={{ alignSelf: 'flex-start' }}>{tr('Tejaysiz:')} {fmt(total - bundle)} {sum(lang)}</span>
          <button className="pill dark" style={{ minHeight: '52px', alignSelf: 'flex-start', marginTop: '4px' }}
            onClick={() => { products.forEach((p) => shop.add(p)); setAdded(true) }}>
            {added ? tr('Savatga qoʻshildi ✓') : tr('Uchtasini savatga')}
          </button>
        </div>
        <div style={{ flex: '2 1 560px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {products.map((p, i) => (
            <Link key={p.slug} href={href(lang, `/mahsulot/${p.slug}`)} style={{ flex: '1 1 90px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px', textDecoration: 'none' }}>
              <span className="zoom" style={{ display: 'block', aspectRatio: '1/1', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
                <img className="ph" src={p.img} alt="" loading="lazy" /><span className="chip glass" style={{ position: 'absolute', top: '8px', left: '8px' }}>{tr(steps[i])}</span>
              </span>
              <span style={{ fontSize: '13px', lineHeight: 1.35 }}><b style={{ fontWeight: 600 }}>{p.brand}</b> {p.name}</span>
              <span className="num" style={{ fontSize: '15px' }}>{fmt(p.price)} {sum(lang)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/** FAQ accordion (section 12): one open at a time, first open by default. */
export function Faq({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState(0)
  return (
    <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column' }}>
      {items.map(([q, a], i) => (
        <div key={q} style={{ borderBottom: '1px solid #E2DAD2' }}>
          <button aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', minHeight: '56px', border: 'none', background: 'none', font: '600 16px Inter, sans-serif', color: '#2A211E', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
            {q}<span style={{ fontSize: '22px', fontWeight: 300 }}>{open === i ? '–' : '+'}</span>
          </button>
          {open === i && <p className="muted" style={{ margin: '0 0 16px', lineHeight: 1.6, fontSize: '15px' }}>{a}</p>}
        </div>
      ))}
    </div>
  )
}
