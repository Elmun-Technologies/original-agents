'use client'
// Conversational picker: skin type -> concern -> 3 products (design/preview/Main.html section 3, p_main.py logic).
import Link from 'next/link'
import { useState } from 'react'

import { ProductCard } from '@/components/ProductCard'
import type { CardProduct } from '@/components/shop'
import { href, t, type Lang } from '@/lib/i18n'

export type PickProduct = CardProduct & { skin: string[]; concerns: string[]; category: string }

const SKINS: [string, string][] = [['dry', 'Quruq'], ['oily', 'Yogʻli'], ['combo', 'Aralash'], ['sens', 'Sezgir'], ['normal', 'Bilmayman']]
// need -> how products are matched (concern key or category slug)
const NEEDS: [string, string, (p: PickProduct) => boolean][] = [
  ['calm', 'Qizarish', (p) => p.concerns.includes('acne')],
  ['hyd', 'Quruqlik', (p) => p.concerns.includes('dryness')],
  ['bright', 'Xira rang', (p) => p.concerns.includes('dull')],
  ['pore', 'Poralar', (p) => p.concerns.includes('pores')],
  ['sun', 'Quyoshdan himoya', (p) => p.category === 'spf'],
]
const DEFAULT_NEED: Record<string, string> = { dry: 'hyd', oily: 'pore', combo: 'pore', sens: 'calm', normal: 'bright' }

/** Matching products first (skin fits, then any skin), always 3 if the catalog has them — never empty. */
export function pick(products: PickProduct[], skin: string, need: string): PickProduct[] {
  const match = NEEDS.find((n) => n[0] === need)![2]
  const fitsSkin = (p: PickProduct) => skin === 'normal' || p.skin.includes(skin)
  const ranked = [
    ...products.filter((p) => match(p) && fitsSkin(p)),
    ...products.filter((p) => match(p) && !fitsSkin(p)),
    ...products.filter((p) => !match(p) && fitsSkin(p)),
  ]
  return [...new Map(ranked.map((p) => [p.slug, p])).values()].slice(0, 3)
}

export function Chooser({ lang, products }: { lang: Lang; products: PickProduct[] }) {
  const [skin, setSkin] = useState('sens')
  const [need, setNeed] = useState<string | null>(null)
  const tr = (s: string) => t(lang, s)
  const needKey = need || DEFAULT_NEED[skin]
  const skinName = tr(SKINS.find((s) => s[0] === skin)![1])
  const say = skin === 'normal'
    ? tr('Hechqisi yoʻq, koʻpchilik bilmaydi. Unda ayting: nima koʻproq bezovta qiladi?')
    : lang === 'ru' ? `${skinName} кожа — понятно. Теперь скажите: что беспокоит больше всего?`
      : `${skinName} teri — tushunarli. Endi ayting: nima koʻproq bezovta qiladi?`
  const btn = { minHeight: '40px', fontSize: '14px' }
  const bubble = { background: '#F0EBE5', borderRadius: '4px 18px 18px 18px', padding: '14px 16px', fontSize: '15px', lineHeight: 1.5 }
  return (
    <section className="wrap" style={{ marginTop: '36px' }} aria-labelledby="pick-h">
      <div className="card pad-m" style={{ padding: '32px', background: '#FBFAF7' }}>
        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', flex: 'none', background: '#F2D6D0' }}><img className="ph" src="/img/face-touch.jpg" alt="" style={{ objectPosition: '50% 25%' }} /></span>
              <div style={bubble}>
                <b id="pick-h" style={{ fontWeight: 600 }}>{tr('Salom! Keling, birga tanlaymiz.')}</b><br />{tr('Teringiz qanaqa? Bittasini bosing — pastda sizga mos mahsulotlar chiqadi.')}
              </div>
            </div>
            <div className="chooser-opts" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingLeft: '56px' }}>
              {SKINS.map(([id, label]) => (
                <button key={id} className={skin === id ? 'pill dark' : 'pill line'} aria-pressed={skin === id} style={btn} onClick={() => { setSkin(id); setNeed(null) }}>{tr(label)}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ width: '44px', flex: 'none' }} />
              <div style={bubble} aria-live="polite">{say}</div>
            </div>
            <div className="chooser-opts" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingLeft: '56px' }}>
              {NEEDS.map(([id, label]) => (
                <button key={id} className={needKey === id ? 'pill dark' : 'pill line'} aria-pressed={needKey === id} style={btn} onClick={() => setNeed(id)}>{tr(label)}</button>
              ))}
            </div>
            <Link href={href(lang, '/maslahatchi')} className="muted chooser-opts" style={{ paddingLeft: '56px', fontSize: '14px' }}>{tr('Aniqroq tanlash kerakmi? AI maslahatchi bilan gaplashing →')}</Link>
          </div>
          <div style={{ flex: '2 1 600px', minWidth: 0 }}>
            <div className="pgrid">{pick(products, skin, needKey).map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
