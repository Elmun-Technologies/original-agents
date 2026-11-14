'use client'
// Article — design/preview/Article.html + p_article.py: short answer first, steps with products, ingredients, FAQ, ToC, set.
import Link from 'next/link'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { useShop, type CardProduct } from '@/components/shop'
import { fmt, sum } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'

export type ArticleData = {
  slug: string; title: string; accent?: string; tag?: string; minutes: number; author?: string; reviewedBy?: string; date?: string; cover?: string; coverPos?: string
  shortAnswer?: string; sections: { h: string; text?: string }[]; steps: { t?: string; d?: string; p?: CardProduct }[]; ingredients: { name?: string; d?: string }[]
  faq: { q: string; a: string }[]; more: { slug: string; title: string; cover?: string }[]
}

function Title({ title, accent }: { title: string; accent?: string }) {
  const i = accent ? title.indexOf(accent) : -1
  if (i < 0 || !accent) return <>{title}</>
  return <>{title.slice(0, i)}<span className="serif" style={{ fontStyle: 'italic' }}>{accent}</span>{title.slice(i + accent.length)}</>
}

export function ArticlePage({ lang, a }: { lang: Lang; a: ArticleData }) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const shop = useShop()
  const [faq, setFaq] = useState(0)
  const [setAdded, setSetAdded] = useState(false)
  const set = a.steps.map((s) => s.p).filter((p): p is CardProduct => !!p)
  const setSum = set.reduce((x, p) => x + p.price, 0)
  const setNew = Math.round((setSum * 0.9) / 1000) * 1000
  const toc = [a.shortAnswer && ['qisqa', 'Qisqa javob'], ...a.sections.map((s, i) => [`s${i}`, s.h]), a.steps.length && ['steps', 'Qaysi tartibda surtiladi?'], a.ingredients.length && ['ing', 'Tarkiblar'], a.faq.length && ['faq', 'Savollar']].filter(Boolean) as [string, string][]
  const empty = !a.sections.length && !a.steps.length
  return (
    <div style={{ marginTop: '16px' }}>
      <div className="wrap"><nav aria-label={tr('Yoʻl')} className="muted" style={{ fontSize: '13px', display: 'flex', gap: '8px' }}><Link href={L('/')} style={{ color: '#6B5F59' }}>{tr('Bosh sahifa')}</Link><span>/</span><Link href={L('/jurnal')} style={{ color: '#6B5F59' }}>{tr('Jurnal')}</Link><span>/</span><span style={{ color: '#2A211E' }}>{a.tag ?? a.title}</span></nav></div>
      <article>
        <header className="wrap" style={{ maxWidth: '860px', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{a.tag && <span className="chip">{a.tag}</span>}<span className="chip">{tn(lang, '[N] daqiqa oʻqish', a.minutes)}</span></span>
          <h1 className="h h1" style={{ fontSize: '54px', lineHeight: 1.04 }}><Title title={a.title} accent={a.accent} /></h1>
          {(a.author || a.date) && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {a.author && <span style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#F5DCC9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: "500 18px 'Inter Tight'" }}>{a.author[0]}</span>}
              <span style={{ fontSize: '14px' }}>{a.author && <b style={{ fontWeight: 600 }}>{a.author}</b>}<br /><span className="muted">{[a.date, a.reviewedBy && `${tr('tekshirildi:')} ${a.reviewedBy}`].filter(Boolean).join(' · ')}</span></span>
            </div>
          )}
        </header>
        {a.cover && <div className="wrap" style={{ maxWidth: '1200px', marginTop: '24px' }}><div className="card" style={{ aspectRatio: '21/9', overflow: 'hidden' }}><img className="ph" src={a.cover} alt="" style={{ objectPosition: a.coverPos }} /></div></div>}
        <div className="wrap" style={{ maxWidth: '1200px', marginTop: '28px', display: 'flex', gap: '40px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '999 1 640px', minWidth: 0, maxWidth: '760px', fontSize: '18px', lineHeight: 1.7, color: '#3A302C' }}>
            {a.shortAnswer && (
              <section id="qisqa" className="card" style={{ padding: '24px', background: '#F2D6D0', fontSize: '16px', lineHeight: 1.6 }} aria-label={tr('Qisqa javob')}>
                <b style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>{tr('Qisqa javob')}</b>{a.shortAnswer}
              </section>
            )}
            {empty && <p className="muted" style={{ fontSize: '15px', marginTop: '20px' }}>{tr('Maqolaning toʻliq matni tayyorlanmoqda. Savol boʻlsa — maslahatchiga yozing.')}</p>}
            {a.sections.map((s, i) => (
              <div key={i} id={`s${i}`}>
                <h2 className="h" style={{ fontSize: '32px', margin: '36px 0 12px' }}>{s.h}</h2>
                {(s.text ?? '').split(/\n\s*\n/).filter(Boolean).map((p, j) => <p key={j} style={{ margin: '0 0 16px' }}>{p}</p>)}
              </div>
            ))}
            {a.steps.length > 0 && (
              <>
                <h2 id="steps" className="h" style={{ fontSize: '32px', margin: '36px 0 12px' }}>{tr('Qaysi tartibda surtiladi?')}</h2>
                <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {a.steps.map((s, i) => (
                    <li key={i} className="card" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', fontSize: '15px', lineHeight: 1.5, flexWrap: 'wrap' }}>
                      <span className="num" style={{ fontSize: '28px', color: '#A8475C', width: '36px' }}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={{ flex: '1 1 200px' }}><b style={{ fontWeight: 600 }}>{s.t}</b><br /><span className="muted">{s.d}</span></span>
                      {s.p && <><img src={s.p.img} alt="" style={{ width: '64px', height: '64px', borderRadius: '14px', objectFit: 'cover' }} />
                        <button className="pill line" style={{ minHeight: '42px', fontSize: '14px' }} onClick={() => shop.add(s.p!)}>{shop.inCart(s.p.sku) ? tr('Savatda ✓') : tr('Savatga')}</button></>}
                    </li>
                  ))}
                </ol>
              </>
            )}
            {a.ingredients.length > 0 && (
              <>
                <h2 id="ing" className="h" style={{ fontSize: '32px', margin: '36px 0 12px' }}>{tr('Qaysi tarkiblarni qidirish kerak?')}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '15px', lineHeight: 1.5 }}>
                  {a.ingredients.map((x) => <div key={x.name} className="card" style={{ padding: '18px' }}><b style={{ fontWeight: 600 }}>{x.name}</b><br /><span className="muted">{x.d}</span></div>)}
                </div>
              </>
            )}
            <div className="card" style={{ marginTop: '28px', padding: '22px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', background: '#2A211E', color: '#FBFAF7' }}>
              <span style={{ flex: '1 1 320px', fontSize: '16px', lineHeight: 1.5 }}>{tr('Teringiz aralashmi yoki yogʻlimi — ishonchingiz komil emasmi? 3 ta savolga javob bering, aniq aytaman.')}</span>
              <Link href={L('/maslahatchi')} className="pill" style={{ borderColor: 'rgba(251,250,247,.3)', color: '#FBFAF7' }}><Icon name="spark" size={16} /> {tr('Teri turimni aniqlash')}</Link>
            </div>
            {a.faq.length > 0 && (
              <>
                <h2 id="faq" className="h" style={{ fontSize: '32px', margin: '36px 0 12px' }}>{tr('Koʻp soʻraladigan savollar')}</h2>
                {a.faq.map((f, i) => (
                  <div key={f.q} style={{ borderTop: '1px solid #E2DAD2' }}>
                    <button onClick={() => setFaq(faq === i ? -1 : i)} aria-expanded={faq === i} style={{ width: '100%', border: 'none', background: 'none', padding: '18px 0', display: 'flex', justifyContent: 'space-between', gap: '16px', textAlign: 'left', cursor: 'pointer', font: 'inherit', fontSize: '17px', fontWeight: 600, color: '#2A211E' }}>{f.q}<span>{faq === i ? '−' : '+'}</span></button>
                    {faq === i && <p style={{ margin: '0 0 18px', fontSize: '16px' }} className="muted">{f.a}</p>}
                  </div>
                ))}
              </>
            )}
            <p className="muted" style={{ fontSize: '13px', marginTop: '24px' }}>{tr('Maqola umumiy maʼlumot uchun. Kuchli toshma yoki yalligʻlanish boʻlsa, dermatologga murojaat qiling.')}</p>
          </div>
          <aside style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '20px' }}>
            {toc.length > 1 && (
              <nav className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }} aria-label={tr('Mundarija')}>
                <b style={{ fontWeight: 600, fontSize: '15px' }}>{tr('Maqolada')}</b>
                {toc.map(([id, l]) => <a key={id} href={`#${id}`} style={{ textDecoration: 'none' }}>{tr(l)}</a>)}
              </nav>
            )}
            {set.length >= 2 && (
              <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <b style={{ fontWeight: 600 }}>{tr('Maqoladagi toʻplam')}</b>
                <img src={set[1]?.img ?? set[0].img} alt="" style={{ width: '100%', aspectRatio: '4/3', borderRadius: '16px', objectFit: 'cover' }} />
                <span style={{ fontSize: '14px' }}>{a.steps.filter((s) => s.p).map((s) => s.t).join(' + ')} · <b className="num">{fmt(setNew)} {sum(lang)}</b> <span className="old">{fmt(setSum)}</span></span>
                <button className="pill dark" onClick={() => { set.forEach((p) => shop.add(p)); setSetAdded(true) }}>{setAdded ? tr('Toʻplam savatda ✓') : tr('Toʻplamni savatga')}</button>
              </div>
            )}
          </aside>
        </div>
      </article>
      {a.more.length > 0 && (
        <section className="wrap" style={{ marginTop: '48px' }} aria-labelledby="more-h">
          <h2 id="more-h" className="h h2" style={{ fontSize: '30px', marginBottom: '16px' }}>{tr('Yana oʻqing')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
            {a.more.map((m) => <Link key={m.slug} href={L(`/jurnal/${m.slug}`)} className="card zoom" style={{ textDecoration: 'none', overflow: 'hidden' }}><span style={{ display: 'block', aspectRatio: '16/10', overflow: 'hidden' }}>{m.cover && <img className="ph" src={m.cover} alt="" />}</span><span style={{ display: 'block', padding: '18px', fontSize: '17px', fontWeight: 600 }}>{m.title}</span></Link>)}
          </div>
        </section>
      )}
    </div>
  )
}
