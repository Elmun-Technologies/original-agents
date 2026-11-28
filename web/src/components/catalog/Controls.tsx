'use client'
// Catalog controls (design/preview/Catalog.html + p_mobile.py "cat"/"sheet"). Every change rewrites the URL;
// the server page filters (lib/filters.ts), so links are shareable and the grid stays server-rendered.
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { Icon } from '@/components/icons'
import { activeCount, filterQuery, parseFilters, PAGE, type Filters } from '@/lib/filters'
import { fmt } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'

const SKINS: [string, string][] = [['dry', 'Quruq'], ['oily', 'Yogʻli'], ['combo', 'Aralash'], ['sens', 'Sezgir'], ['normal', 'Normal']]
const NEEDS: [string, string][] = [['acne', 'Qizarish'], ['dryness', 'Quruqlik'], ['dull', 'Xira rang'], ['pores', 'Poralar'], ['sun', 'Quyosh']]
const SORTS: [Filters['sort'], string][] = [['pop', 'Mashhur'], ['new', 'Yangi'], ['cheap', 'Arzonroq'], ['exp', 'Qimmatroq']]

function useFilters() {
  const sp = useSearchParams()
  const path = usePathname()
  const router = useRouter()
  const [pending, start] = useTransition()
  // optimistic: controls change at once, the grid follows when the server answers
  const query = sp.toString()
  const [optimistic, setOptimistic] = useState<{ q: string; f: Filters } | null>(null)
  const f = optimistic && optimistic.q === query ? optimistic.f : parseFilters(Object.fromEntries(sp.entries()))
  const go = (next: Partial<Filters>) => {
    const nf = { ...f, n: PAGE, ...next }
    setOptimistic({ q: query, f: nf })
    start(() => router.replace(path + filterQuery(nf), { scroll: false }))
  }
  const toggle = (key: 'skin' | 'need' | 'brand', v: string) => go({ [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] })
  const reset = () => go({ sale: false, tomorrow: false, min: undefined, max: undefined, skin: [], need: [], brand: [], type: f.type })
  return { f, go, toggle, reset, pending }
}

const box = { width: '18px', height: '18px', accentColor: '#2A211E', margin: 0 }
const row = { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '38px', fontSize: '14px', cursor: 'pointer' }

/** Pink "which one?" bar with skin quick-pick (desktop/tablet). */
export function SkinBar({ lang }: { lang: Lang }) {
  const { f, go } = useFilters()
  const tr = (s: string) => t(lang, s)
  return (
    <div className="card d-only" style={{ marginTop: '14px', padding: '14px 18px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', background: '#F2D6D0' }}>
      <span style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flex: 'none' }}><img loading="lazy" decoding="async" className="ph" src="/img/face-controls.jpg" alt="" style={{ objectPosition: '50% 25%' }} /></span>
      <span style={{ flex: '1 1 260px', fontSize: '15px', lineHeight: 1.45 }}><b style={{ fontWeight: 600 }}>{tr('Qaysi birini olishni bilmayapsizmi?')}</b> {tr('Teringizni tanlang — mos mahsulotlarni yuqoriga chiqaraman.')}</span>
      <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {SKINS.map(([id, label]) => {
          const on = f.skin.length === 1 && f.skin[0] === id
          return <button key={id} className={on ? 'pill dark' : 'pill ghost'} aria-pressed={on} style={{ minHeight: '40px', fontSize: '14px' }} onClick={() => go({ skin: on ? [] : [id] })}>{tr(label)}</button>
        })}
      </span>
    </div>
  )
}

type ShellProps = { lang: Lang; brands: (readonly [string, string])[]; priceMin: number; priceMax: number; total: number; children: React.ReactNode }

/** Sidebar + toolbar + grid slot (desktop/tablet). On ≤860 the sidebar opens with the «Filtrlar» button. */
export function CatalogShell({ lang, brands, priceMin, priceMax, total, children }: ShellProps) {
  const { f, go, toggle, reset, pending } = useFilters()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const tr = (s: string) => t(lang, s)
  const chips: { t: string; remove: () => void }[] = [
    ...f.skin.map((s) => ({ t: `${tr('Teri: ')}${tr(SKINS.find((x) => x[0] === s)?.[1] ?? s)}`, remove: () => toggle('skin', s) })),
    ...f.need.map((n) => ({ t: tr(NEEDS.find((x) => x[0] === n)?.[1] ?? n), remove: () => toggle('need', n) })),
    ...f.brand.map((b) => ({ t: brands.find((x) => x[0] === b)?.[1] ?? b, remove: () => toggle('brand', b) })),
    ...(f.sale ? [{ t: tr('Aksiyada'), remove: () => go({ sale: false }) }] : []),
    ...(f.tomorrow ? [{ t: tr('Ertaga yetkaziladi'), remove: () => go({ tomorrow: false }) }] : []),
    ...(f.min || f.max ? [{ t: `${f.min ? fmt(f.min) : '0'} – ${f.max ? fmt(f.max) : '∞'}`, remove: () => go({ min: undefined, max: undefined }) }] : []),
  ]
  const priceInput = (key: 'min' | 'max', label: string, ph: number) => (
    <label className="lbl" style={{ flex: 1 }}>{tr(label)}
      <input className="inp" inputMode="numeric" placeholder={fmt(ph)} defaultValue={f[key] ? fmt(f[key]!) : ''} key={`${key}-${f[key]}`} style={{ height: '44px' }}
        onBlur={(e) => { const v = Number(e.target.value.replace(/\D/g, '')) || undefined; if (v !== f[key]) go({ [key]: v }) }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </label>
  )
  return (
    <div className="d-only" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px', alignItems: 'flex-start' }}>
      <aside aria-label={tr('Filtrlar')} style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '4px' }} className={open ? 'side-open' : 'hide-m side'}>
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '4px', borderRadius: '20px' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '44px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>{tr('Faqat aksiyadagilar')} <input type="checkbox" checked={f.sale} onChange={() => go({ sale: !f.sale })} style={{ width: '18px', height: '18px', accentColor: '#A8475C' }} /></label>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '44px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', borderTop: '1px solid #EFE9E3' }}>{tr('Ertaga yetkaziladi')} <input type="checkbox" checked={f.tomorrow} onChange={() => go({ tomorrow: !f.tomorrow })} style={{ width: '18px', height: '18px', accentColor: '#2A211E' }} /></label>
        </div>
        <div className="card" style={{ padding: '18px 20px', borderRadius: '20px' }}>
          <b style={{ fontSize: '15px', fontWeight: 600 }}>{tr('Narx, soʻm')}</b>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>{priceInput('min', 'dan', priceMin)}{priceInput('max', 'gacha', priceMax)}</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
            <button className="chip" style={{ border: 'none', cursor: 'pointer' }} onClick={() => go({ min: undefined, max: 200000 })}>{tr('200 000 gacha')}</button>
            <button className="chip" style={{ border: 'none', cursor: 'pointer' }} onClick={() => go({ min: 200000, max: 300000 })}>{tr('200–300 ming')}</button>
            <button className="chip" style={{ border: 'none', cursor: 'pointer' }} onClick={() => go({ min: 300000, max: undefined })}>{tr('300 000 dan')}</button>
          </div>
        </div>
        <fieldset className="card" style={{ padding: '18px 20px', border: 'none', margin: 0, borderRadius: '20px' }}>
          <legend className="sr">{tr('Teri turi')}</legend><b style={{ fontSize: '15px', fontWeight: 600 }}>{tr('Teri turi')}</b>
          {SKINS.map(([id, label]) => <label key={id} style={row}><input type="checkbox" checked={f.skin.includes(id)} onChange={() => toggle('skin', id)} style={box} />{tr(label)}</label>)}
        </fieldset>
        <fieldset className="card" style={{ padding: '18px 20px', border: 'none', margin: 0, borderRadius: '20px' }}>
          <legend className="sr">{tr('Muammo')}</legend><b style={{ fontSize: '15px', fontWeight: 600 }}>{tr('Nima bezovta qiladi')}</b>
          {NEEDS.map(([id, label]) => <label key={id} style={row}><input type="checkbox" checked={f.need.includes(id)} onChange={() => toggle('need', id)} style={box} />{tr(label)}</label>)}
        </fieldset>
        {brands.length > 0 && (
          <fieldset className="card" style={{ padding: '18px 20px', border: 'none', margin: 0, borderRadius: '20px' }}>
            <legend className="sr">{tr('Brend')}</legend><b style={{ fontSize: '15px', fontWeight: 600 }}>{tr('Brend')}</b>
            <input className="inp" placeholder={tr('Brendni qidirish')} aria-label={tr('Brendni qidirish')} value={q} onChange={(e) => setQ(e.target.value)} style={{ height: '40px', margin: '10px 0 4px', fontSize: '14px' }} />
            {brands.filter(([, name]) => name.toLowerCase().includes(q.trim().toLowerCase())).map(([slug, name]) => (
              <label key={slug} style={row}><input type="checkbox" checked={f.brand.includes(slug)} onChange={() => toggle('brand', slug)} style={box} />{name}</label>
            ))}
          </fieldset>
        )}
      </aside>

      <section aria-label={tr('Mahsulotlar')} aria-busy={pending} style={{ flex: '999 1 640px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {chips.map((c) => <button key={c.t} className="chip" style={{ height: '34px', border: 'none', cursor: 'pointer', background: '#2A211E', color: '#FBFAF7', fontSize: '13px' }} onClick={c.remove} aria-label={`${tr('Olib tashlash:')} ${c.t}`}>{c.t} ✕</button>)}
            {chips.length > 0 && <button className="chip" style={{ height: '34px', border: 'none', cursor: 'pointer', background: 'none', textDecoration: 'underline' }} onClick={reset}>{tr('Hammasini tozalash')}</button>}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
            <button className="pill dark show-m" style={{ minHeight: '42px' }} aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="grid" size={16} /> {open ? tr('Filtrlarni yopish') : tr('Filtrlar')}</button>
            <div role="radiogroup" aria-label={tr('Saralash')} className="hs" style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '999px', background: '#FBFAF7', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
              {SORTS.map(([id, label]) => <button key={id} role="radio" aria-checked={f.sort === id} className={f.sort === id ? 'pill dark' : 'pill ghost'} style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px' }} onClick={() => go({ sort: id })}>{tr(label)}</button>)}
            </div>
          </div>
        </div>
        <div style={{ opacity: pending ? 0.55 : 1, transition: 'opacity .2s' }}>{children}</div>
        {total === 0 && (
          <div className="card" style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <b className="h" style={{ fontSize: '26px' }}>{tr('Bunday mahsulot hozircha yoʻq')}</b>
            <span className="muted">{tr('Filtrlarni biroz kengaytiring — yoki bizga yozing, olib kelishimiz mumkin.')}</span>
            <button className="pill dark" onClick={reset}>{tr('Filtrlarni tozalash')}</button>
          </div>
        )}
        {total > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
            <span className="muted" style={{ fontSize: '14px' }}>{tn(lang, '[N] tadan [N] tasi koʻrsatildi', total, Math.min(total, f.n))}</span>
            {total > f.n && <button className="pill line" style={{ minHeight: '50px', padding: '0 32px' }} onClick={() => go({ n: f.n + PAGE })}>{tn(lang, 'Yana [N] ta koʻrsatish', Math.min(PAGE, total - f.n))}</button>}
          </div>
        )}
      </section>
    </div>
  )
}

/** Phone top bar + skin strip + Filtrlar/sort + bottom sheet (MobileCatalog.jpg). */
export function PhoneCatalogTop({ lang, title, total, back }: { lang: Lang; title: string; total: number; back: string }) {
  const { f, go, toggle } = useFilters()
  const [sheet, setSheet] = useState(false)
  const tr = (s: string) => t(lang, s)
  useEffect(() => {
    if (!sheet) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [sheet])
  const skins: [string | null, string][] = [[null, 'Hammasi'], ['dry', 'Quruq'], ['oily', 'Yogʻli'], ['combo', 'Aralash'], ['sens', 'Sezgir']]
  const n = f.need.length + Number(f.sale)
  const skinName = f.skin.length === 1 ? SKINS.find((s) => s[0] === f.skin[0])?.[1] : undefined
  const sortIdx = SORTS.findIndex((s) => s[0] === f.sort)
  return (
    <>
      <div className="m-top m-only" style={{ flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Link href={href(lang, back)} className="ib" aria-label={tr('Orqaga')}><Icon name="left" size={22} /></Link>
          <h1 className="h" style={{ fontSize: '22px', flex: 1, fontWeight: 500 }}>{title}</h1>
          <Link href={href(lang, '/qidiruv')} className="ib" aria-label={tr('Qidiruv')}><Icon name="search" size={20} /></Link>
        </div>
        <div className="hs" style={{ gap: '6px', margin: '0 -16px', padding: '0 16px' }}>
          {skins.map(([id, label]) => {
            const on = id === null ? f.skin.length === 0 : f.skin.length === 1 && f.skin[0] === id
            return <button key={label} className={on ? 'pill dark' : 'pill'} aria-pressed={on} style={{ minHeight: '38px', fontSize: '13px', flex: 'none' }} onClick={() => go({ skin: id ? [id] : [] })}>{tr(label)}</button>
          })}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="pill line" style={{ flex: 1, minHeight: '40px', fontSize: '13px' }} onClick={() => setSheet(true)}><Icon name="grid" size={16} /> {tr('Filtrlar')}{n ? ` · ${n}` : ''}</button>
          <button className="pill line" style={{ flex: 1, minHeight: '40px', fontSize: '13px' }} onClick={() => go({ sort: SORTS[(sortIdx + 1) % SORTS.length][0] })}>↕ {tr(SORTS[sortIdx][1])}</button>
        </div>
      </div>
      <div className="m-only" style={{ padding: '4px 16px 0' }}>
        <span className="muted" style={{ fontSize: '13px' }}>{tn(lang, '[N] ta mahsulot', total)}{skinName ? (lang === 'ru' ? ` · для кожи: ${tr(skinName).toLowerCase()}` : ` · ${tr(skinName).toLowerCase()} teri uchun`) : ''}</span>
      </div>
      {sheet && (
        <div className="m-only" style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,30,.4)' }} onClick={() => setSheet(false)} />
          <div role="dialog" aria-modal="true" aria-label={tr('Filtrlar')} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#FBFAF7', borderRadius: '28px 28px 0 0', padding: '12px 20px 30px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ width: '40px', height: '5px', borderRadius: '3px', background: '#D8CFC8', alignSelf: 'center' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b className="h" style={{ fontSize: '22px' }}>{tr('Filtrlar')}</b><button className="ib" aria-label={tr('Yopish')} onClick={() => setSheet(false)}><Icon name="x" size={20} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span className="lbl">{tr('Nima bezovta qiladi?')}</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {NEEDS.map(([id, label]) => <button key={id} className={f.need.includes(id) ? 'pill dark' : 'pill line'} style={{ minHeight: '38px', fontSize: '13px' }} onClick={() => toggle('need', id)}>{tr(label)}</button>)}
              </div>
            </div>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15px' }}>{tr('Faqat chegirmadagilar')}<input type="checkbox" checked={f.sale} onChange={() => go({ sale: !f.sale })} style={{ width: '22px', height: '22px', accentColor: '#2A211E' }} /></label>
            <button className="pill dark" style={{ minHeight: '52px' }} onClick={() => setSheet(false)}>{tn(lang, '[N] ta mahsulotni koʻrsatish', total)}</button>
          </div>
        </div>
      )}
    </>
  )
}
