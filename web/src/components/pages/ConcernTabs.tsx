'use client'
// "Nima bezovta qilyapti?" tabs (CategoryHub): concern -> advice + matching products (p_more1.py hub_js).
import { useState } from 'react'

import { ProductCard } from '@/components/ProductCard'
import type { HomeCard } from '@/lib/catalog'
import { t, type Lang } from '@/lib/i18n'

export const CONCERN_TABS: [string, string, string][] = [
  ['acne', 'Toshma va qizarish', 'Avval terini tinchlantiramiz: centella va choy daraxti. Kuchli kislotalar bilan shoshilmang.'],
  ['pores', 'Kengaygan poralar', 'Yengil teksturalar va niatsinamid. Yuvishni yumshoq tozalovchi bilan qiling.'],
  ['pigment', 'Pigment dogʻlar', 'Galactomyces va niatsinamid rangni asta tekislaydi. SPFsiz natija boʻlmaydi.'],
  ['dryness', 'Quruqlik', 'Namlikni qatlamlab beramiz: toner → essensiya → krem.'],
  ['wrinkles', 'Birinchi ajinlar', 'Tiklovchi serumlar va har kuni SPF — eng ishonchli boshlanish.'],
  ['dull', 'Xira rang', 'Ferment essensiyalar va yengil eksfoliatsiya.'],
]

export function ConcernTabs({ lang, products }: { lang: Lang; products: HomeCard[] }) {
  const tr = (s: string) => t(lang, s)
  const [i, setI] = useState(0)
  const [key, , note] = CONCERN_TABS[i]
  const list = products.filter((p) => p.concerns.includes(key)).slice(0, 4)
  return (
    <>
      <div role="tablist" className="hs" style={{ gap: '6px', margin: '14px 0 6px' }}>
        {CONCERN_TABS.map(([k, label], j) => <button key={k} role="tab" aria-selected={i === j} className={i === j ? 'pill dark' : 'pill ghost'} onClick={() => setI(j)}>{tr(label)}</button>)}
      </div>
      <p style={{ margin: '8px 0 16px', padding: '14px 16px', borderRadius: '16px', background: '#F6F3EF', fontSize: '15px', lineHeight: 1.55 }}>{tr(note)}</p>
      <div className="pgrid">{list.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>
      {list.length === 0 && <p className="muted">{tr('Bu muammo uchun mahsulotlar tez orada qoʻshiladi.')}</p>}
    </>
  )
}
