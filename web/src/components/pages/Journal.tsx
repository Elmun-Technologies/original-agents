'use client'
// Journal — design/preview/Journal.html + p_more2.py (wired to articles + ingredients).
import Link from 'next/link'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { href, t, tn, type Lang } from '@/lib/i18n'

export type ArticleCard = { slug: string; title: string; excerpt?: string; category: string; catLabel: string; cover?: string; pos?: string; minutes: number; featured: boolean }
export type Ingredient = { name: string; does?: string; who?: string; care?: string }
const CATS: [string, string][] = [['', 'Hammasi'], ['teri-turi', 'Teri turi'], ['tarkiblar', 'Tarkiblar'], ['rutina', 'Rutina'], ['spf', 'SPF'], ['erkaklar', 'Erkaklar']]

export function JournalPage({ lang, articles, ingredients, telegramUrl }: { lang: Lang; articles: ArticleCard[]; ingredients: Ingredient[]; telegramUrl: string }) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const [cat, setCat] = useState('')
  const [ing, setIng] = useState(Math.min(1, ingredients.length - 1))
  const feat = articles.find((a) => a.featured)
  const list = articles.filter((a) => a !== feat && (!cat || a.category === cat))
  const cur = ingredients[ing]
  return (
    <div className="wrap" style={{ marginTop: '16px' }}>
      <nav aria-label={tr('Yoʻl')} className="muted" style={{ fontSize: '13px', display: 'flex', gap: '8px' }}><Link href={L('/')} style={{ color: '#6B5F59' }}>{tr('Bosh sahifa')}</Link><span>/</span><span style={{ color: '#2A211E' }}>{tr('Jurnal')}</span></nav>
      <section style={{ marginTop: '10px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 560px' }}><h1 className="h h1" style={{ fontSize: '52px' }}>{tr('Jurnal')}</h1><p style={{ margin: '10px 0 0', fontSize: '17px', lineHeight: 1.6, color: '#4A3F3A', maxWidth: '620px' }}>{tr('Kosmetologlarimiz oddiy tilda yozadi: nimani, qachon va nega surtish kerak. Reklama emas — har maqola oxirida mahsulot shart emas.')}</p></div>
        <a href={telegramUrl} className="pill line"><Icon name="tg" size={17} /> {tr('Yangi maqolalar Telegramda')}</a>
      </section>
      {feat && (
        <Link href={L(`/jurnal/${feat.slug}`)} className="card zoom" style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', textDecoration: 'none', minHeight: '380px' }}>
          <span style={{ flex: '1 1 560px', minHeight: '380px', position: 'relative', display: 'block' }}>{feat.cover && <img className="ph" src={feat.cover} alt="" style={{ position: 'absolute', inset: 0, objectPosition: feat.pos }} />}</span>
          <span className="pad-m" style={{ flex: '1 1 420px', padding: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
            <span style={{ display: 'flex', gap: '6px' }}><span className="chip">{tr('Tanlov')}</span><span className="chip">{tn(lang, '[N] daqiqa', feat.minutes)}</span></span>
            <b className="h" style={{ fontSize: '36px', lineHeight: 1.08 }}>{feat.title}</b>
            {feat.excerpt && <span className="muted" style={{ fontSize: '16px', lineHeight: 1.55 }}>{feat.excerpt}</span>}
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{tr('Oʻqish ›')}</span>
          </span>
        </Link>
      )}
      <section style={{ marginTop: '28px' }} aria-labelledby="all-h">
        <div className="sec-h"><h2 id="all-h" className="h h2" style={{ fontSize: '30px' }}>{tr('Barcha maqolalar')}</h2>
          <div role="tablist" className="hs" style={{ gap: '6px' }}>{CATS.map(([k, l]) => <button key={k} role="tab" aria-selected={cat === k} className={cat === k ? 'pill dark' : 'pill ghost'} onClick={() => setCat(k)}>{tr(l)}</button>)}</div>
        </div>
        <div data-g="3" style={{ display: 'grid', gap: '12px' }}>
          {list.map((a) => (
            <Link key={a.slug} href={L(`/jurnal/${a.slug}`)} className="card zoom" style={{ textDecoration: 'none', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <span style={{ display: 'block', aspectRatio: '16/10', overflow: 'hidden' }}>{a.cover && <img className="ph" src={a.cover} alt="" style={{ objectPosition: a.pos }} />}</span>
              <span style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ display: 'flex', gap: '6px' }}><span className="chip">{tr(a.catLabel)}</span><span className="chip">{tn(lang, '[N] daqiqa', a.minutes)}</span></span>
                <b style={{ fontWeight: 600, fontSize: '18px', lineHeight: 1.3 }}>{a.title}</b>
                {a.excerpt && <span className="muted" style={{ fontSize: '14px', lineHeight: 1.5 }}>{a.excerpt}</span>}
              </span>
            </Link>
          ))}
        </div>
        {list.length === 0 && <p className="muted">{tr('Bu mavzuda maqolalar tez orada.')}</p>}
      </section>
      {cur && (
        <section id="lugat" className="card pad-m" style={{ marginTop: '16px', padding: '28px' }} aria-labelledby="ing-h">
          <div className="sec-h"><div><span className="eyebrow">{tr('Ingredientlar lugʻati')}</span><h2 id="ing-h" className="h h2" style={{ fontSize: '30px', marginTop: '6px' }}>{tr('Tarkibda nima yozilgan?')}</h2></div></div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>{ingredients.map((x, i) => <button key={x.name} className={ing === i ? 'pill dark' : 'pill line'} onClick={() => setIng(i)}>{x.name}</button>)}</div>
          <div data-g="3" style={{ marginTop: '16px', padding: '18px 20px', borderRadius: '18px', background: '#F6F3EF', display: 'grid', gap: '20px', fontSize: '14px', lineHeight: 1.55 }}>
            <span><span className="muted">{tr('Nima qiladi')}</span><br /><b style={{ fontWeight: 600 }}>{cur.does}</b></span>
            <span><span className="muted">{tr('Kimga mos')}</span><br /><b style={{ fontWeight: 600 }}>{cur.who}</b></span>
            <span><span className="muted">{tr('Ehtiyot boʻling')}</span><br /><b style={{ fontWeight: 600 }}>{cur.care}</b></span>
          </div>
        </section>
      )}
    </div>
  )
}
