'use client'
// Routine builder — design/preview/Routine.html. One product per step from the real catalog; known conflicting
// actives (by product name) are flagged; the two main-step options are compared; the routine is saved in the browser.
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { CONCERNS, SKIN } from '@/collections/catalog'
import { useShop } from '@/components/shop'
import type { HomeCard } from '@/lib/catalog'
import { fmt, nowMs, sum } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'

export const ROUTINE_KEY = 'yeppo-routine'
type Step = [title: string, sub: string, cats: string[]]
const STEPS: Record<'am' | 'pm', Step[]> = {
  am: [['Tozalashdan keyin', 'Toner', ['toner', 'essensiya']], ['Asosiy vosita', 'Ampula / serum', ['serum']], ['Himoya', 'SPF — majburiy', ['spf']]],
  pm: [['Yuvish', 'Tozalash', ['tozalash']], ['Tozalashdan keyin', 'Toner', ['toner', 'essensiya']], ['Asosiy vosita', 'Ampula / serum', ['serum']], ['Namlash', 'Krem', ['krem']]],
}
// ponytail: actives detected from the product name; add an "actives" field to products when the catalog grows
const ACT: [string, RegExp][] = [['retinol', /retin/i], ['acid', /\b(aha|bha|pha|acid|peel|salicyl|glycol)/i], ['vitc', /vita?(min)?[ -]?c\b/i]]
const CONFLICT: [string, string, string][] = [
  ['retinol', 'acid', 'Retinol va kislotalarni bitta rutinada ishlatmang — terini qichitadi. Kunlarni almashtiring.'],
  ['vitc', 'acid', 'C vitamini va kislotalar birga terini achishtirishi mumkin. Birini ertalab, boshqasini kechqurun.'],
]
const label = (list: { value: string; label: { uz: string; ru: string } }[], lang: Lang, v: string) => list.find((x) => x.value === v)?.label[lang] ?? v

export function RoutinePage({ lang, products }: { lang: Lang; products: HomeCard[] }) {
  const tr = (s: string) => t(lang, s)
  const shop = useShop()
  const [tab, setTab] = useState<'am' | 'pm'>('am')
  const [pick, setPick] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read the browser copy after hydration
  useEffect(() => { try { setPick(JSON.parse(localStorage.getItem(ROUTINE_KEY) || '{}').pick ?? {}) } catch {} }, [])
  const steps = STEPS[tab].map(([h, sub, cats], i) => {
    const opts = products.filter((p) => cats.includes(p.category)).slice(0, 6)
    const key = `${tab}${i}`
    return { key, h, sub, opts, sel: opts.find((p) => p.slug === pick[key]) ?? opts[0] }
  }).filter((s) => s.opts.length)
  const chosen = steps.map((s) => s.sel!).filter(Boolean)
  const acts = new Set(chosen.flatMap((p) => ACT.filter(([, re]) => re.test(p.name)).map(([a]) => a)))
  const warns = CONFLICT.filter(([a, b]) => acts.has(a) && acts.has(b)).map(([, , w]) => w)
  if (tab === 'am' && acts.has('retinol')) warns.push('Retinolni faqat kechqurun ishlating.')
  const total = chosen.reduce((s, p) => s + p.price, 0)
  const main = steps.find((s) => s.opts.length > 1 && s.h === 'Asosiy vosita') ?? steps.find((s) => s.opts.length > 1)
  const cmp = main?.opts.slice(0, 2) ?? []
  const save = () => {
    const all = { ...pick, ...Object.fromEntries(steps.map((s) => [s.key, s.sel!.slug])) } // shown defaults count as chosen
    setPick(all)
    try { localStorage.setItem(ROUTINE_KEY, JSON.stringify({ pick: all, at: nowMs() })) } catch {}
    // signed in -> also on the account (401 when not signed in is fine: the browser copy stays)
    fetch('/api/account', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ routine: { pick: all } }) }).catch(() => {})
    setSaved(true)
  }
  const tick = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>
  return (
    <div className="wrap" style={{ marginTop: '20px' }}>
      <section className="sec-h" style={{ alignItems: 'flex-end' }}>
        <div><span className="eyebrow">{tr('Rutina konstruktori')}</span><h1 className="h h1" style={{ fontSize: '44px', marginTop: '6px' }}>{tr('Oʻz rutinangizni yigʻing')}</h1><p className="muted" style={{ margin: '8px 0 0', fontSize: '15px', maxWidth: '640px' }}>{tr('Har qadamga bitta vosita tanlang. Bir-biriga mos kelmaydigan tarkiblar boʻlsa — darhol ogohlantiraman.')}</p></div>
        <div role="tablist" style={{ display: 'flex', gap: '6px' }}>{([['am', 'Ertalab'], ['pm', 'Kechqurun']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'pill dark' : 'pill ghost'} onClick={() => setTab(k)}>{tr(l)}</button>)}</div>
      </section>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '20px', alignItems: 'flex-start' }}>
        <ol style={{ flex: '999 1 720px', minWidth: 0, listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {steps.map((s, i) => (
            <li key={s.key} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}><span className="num" style={{ fontSize: '26px', color: '#A8475C' }}>{String(i + 1).padStart(2, '0')}</span><b className="h" style={{ fontSize: '22px' }}>{tr(s.h)}</b><span className="muted" style={{ fontSize: '14px' }}>{tr(s.sub)}</span></span>
              <div role="radiogroup" aria-label={tr(s.h)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                {s.opts.map((p) => {
                  const on = p.slug === s.sel?.slug
                  return (
                    <button key={p.slug} role="radio" aria-checked={on} onClick={() => { setPick({ ...pick, [s.key]: p.slug }); setSaved(false) }} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px', borderRadius: '16px', border: `1.5px solid ${on ? '#2A211E' : '#E2DAD2'}`, background: on ? '#F6F3EF' : '#fff', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: '#2A211E', opacity: p.stock === 0 ? 0.55 : 1 }}>
                      <img src={p.img} alt="" style={{ width: '52px', height: '52px', borderRadius: '12px', objectFit: 'cover' }} />
                      <span style={{ flex: 1, fontSize: '13px', lineHeight: 1.35 }}><b style={{ fontWeight: 600 }}>{p.brand}</b> {p.name}<br /><span className="num" style={{ fontSize: '14px' }}>{fmt(p.price)} {sum(lang)}</span></span>
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ol>

        <aside style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '20px' }}>
          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <b className="h" style={{ fontSize: '22px' }}>{tr(tab === 'am' ? 'Ertalabki rutinangiz' : 'Kechki rutinangiz')}</b>
            {chosen.map((p, i) => <span key={p.slug} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px' }}><span className="num muted">{String(i + 1).padStart(2, '0')}</span><img src={p.img} alt="" style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'cover' }} /><span style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{p.brand}</b> {p.name}</span></span>)}
            {warns.length
              ? warns.map((w) => <span key={w} role="alert" style={{ padding: '12px 14px', borderRadius: '14px', background: '#F2D6D0', fontSize: '13px', lineHeight: 1.5, color: '#6B2433' }}>{tr(w)}</span>)
              : <span style={{ padding: '12px 14px', borderRadius: '14px', background: '#E8F0E4', fontSize: '13px', lineHeight: 1.5, color: '#2F3A2B' }}>{tick} {tn(lang, 'Tarkiblar bir-biriga mos. Taxminan [N] daqiqa.', chosen.length + 1)}</span>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid #EFE9E3', paddingTop: '12px' }}><span className="muted">{tr('Hammasi birga')}</span><span className="num" style={{ fontSize: '26px' }}>{fmt(total)} {sum(lang)}</span></div>
            <button className="pill dark" style={{ minHeight: '52px' }} onClick={() => chosen.filter((p) => p.stock > 0).forEach((p) => shop.add(p))}>{tr('Butun rutinani savatga')}</button>
            {saved ? <Link href={href(lang, '/kabinet')} className="pill line">{tr('Saqlandi ✓ Kabinetga oʻtish')}</Link> : <button className="pill line" onClick={save}>{tr('Kabinetga saqlash')}</button>}
          </div>
        </aside>
      </div>

      {cmp.length === 2 && (
        <section className="card pad-m" style={{ marginTop: '24px', padding: '28px' }} aria-labelledby="cmp-h">
          <h2 id="cmp-h" className="h h2" style={{ fontSize: '30px' }}>{tr('Ikkisidan qaysi biri? Solishtiramiz')}</h2>
          <div data-g="cmp" style={{ display: 'grid', marginTop: '18px', fontSize: '14px' }}>
            <span />
            {cmp.map((p) => <span key={p.slug} style={{ padding: '0 12px 14px', display: 'flex', gap: '12px', alignItems: 'center' }}><img src={p.img} alt="" style={{ width: '64px', height: '64px', borderRadius: '14px', objectFit: 'cover' }} /><span><b style={{ fontWeight: 600 }}>{p.brand}</b><br />{p.name}</span></span>)}
            {([
              ['Kimga', (p: HomeCard) => p.skin.map((s) => label(SKIN, lang, s)).join(', ') || '—'],
              ['Nimaga yordam beradi', (p: HomeCard) => p.concerns.map((c) => label(CONCERNS, lang, c)).join(', ') || '—'],
              ['Hajm', (p: HomeCard) => p.vol || '—'],
              ['Narx', (p: HomeCard) => `${fmt(p.price)} ${sum(lang)}`],
            ] as const).map(([h, f]) => [
              <span key={h} className="muted" style={{ padding: '12px 0', borderTop: '1px solid #EFE9E3' }}>{tr(h)}</span>,
              ...cmp.map((p) => <span key={h + p.slug} style={{ padding: '12px', borderTop: '1px solid #EFE9E3' }}>{f(p)}</span>),
            ])}
          </div>
        </section>
      )}
    </div>
  )
}
