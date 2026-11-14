// Search "understanding" (design/source/p_spec.py "Aqlli qidiruv"): typos, Cyrillic ↔ Latin, Russian ↔ Uzbek
// mean the same; the query is split into skin type, concern, product type, brand, price; ranking:
// match -> sold -> reviews -> in stock. Never empty (closest products + consultant).

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
}

/** lower case, Cyrillic -> Latin, Uzbek apostrophes unified, punctuation -> spaces. */
export function normalize(q: string) {
  return q.toLowerCase().replace(/[ʻʼ'`’‘]/g, '').split('').map((c) => CYR[c] ?? c).join('')
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// stems (already normalized/transliterated) -> meaning
const SKIN: [RegExp, string][] = [[/\b(quruq|suxo|suxa|suxuy|dry)/, 'dry'], [/\b(yogli|jirn|oily)/, 'oily'], [/\b(sezgir|chuvstv|sensit)/, 'sens'], [/\b(aralash|kombin|combo)/, 'combo'], [/\b(normal)/, 'normal']]
const TYPE: [RegExp, string][] = [
  [/\b(krem|cream)/, 'krem'], [/\b(serum|sivorot|syvorot|ampul|ampoule)/, 'serum'], [/\b(toner|tonik)/, 'toner'], [/\b(essen)/, 'essensiya'],
  [/\b(spf|sanskrin|quyosh|solnts|sunscreen|sun)/, 'spf'], [/\b(niqob|mask)/, 'niqoblar'], [/\b(tozal|umiv|penk|gel|ochish|cleans)/, 'tozalash'], [/\b(toplam|nabor|set)/, 'toplamlar'],
]
const CONCERN: [RegExp, string][] = [
  [/\b(toshma|husnbuzar|akne|acne|pryish|prish|qizar|krasn)/, 'acne'], [/\b(pora|por\b|pori)/, 'pores'], [/\b(dog|pigment|pyatn)/, 'pigment'],
  [/\b(ajin|morsh|wrinkl)/, 'wrinkles'], [/\b(xira|tuskl|dull)/, 'dull'], [/\b(quruqlik|suxost|tortish|styag)/, 'dryness'],
]

export type Understood = { skin?: string; type?: string; concern?: string; brand?: string; max?: number; min?: number; words: string[] }

/** "krem dlya suxoy koji" -> { skin: 'dry', type: 'krem' } … */
export function understand(q: string, brands: { slug: string; name: string }[]): Understood {
  const n = normalize(q)
  const out: Understood = { words: [] }
  out.skin = SKIN.find(([re]) => re.test(n))?.[1]
  out.type = TYPE.find(([re]) => re.test(n))?.[1]
  out.concern = CONCERN.find(([re]) => re.test(n))?.[1]
  if (out.skin === 'dry' && out.concern === 'dryness') out.concern = undefined // "quruq teri" is the skin type
  const b = brands.find((x) => n.includes(normalize(x.name)) || n.replace(/ /g, '').includes(normalize(x.name).replace(/ /g, '')))
  if (b) out.brand = b.slug
  const num = (s: string) => Number(s.replace(/\D/g, '')) * (/(ming|tis)/.test(s) ? 1000 : 1)
  const max = n.match(/(\d[\d ]*\d|\d)\s*(ming|tis)?\s*(gacha|do\b)/) ?? n.match(/\bdo\s*(\d[\d ]*\d|\d)\s*(ming|tis)?/)
  if (max) out.max = num(`${max[1]}${max[2] ? ' ming' : ''}`.trim())
  const min = n.match(/(\d[\d ]*\d|\d)\s*(ming|tis)?\s*dan\b/) ?? n.match(/\bot\s*(\d[\d ]*\d|\d)\s*(ming|tis)?/)
  if (min) out.min = num(`${min[1]}${min[2] ? ' ming' : ''}`.trim())
  const stop = new Set(['uchun', 'dlya', 'va', 'i', 'teri', 'koji', 'kojey', 'uchu', 'gacha', 'do', 'ot', 'dan', 'ming', 'tis', 'som', 'sum'])
  out.words = n.split(' ').filter((w) => w.length > 2 && !stop.has(w) && !/^\d+$/.test(w))
  return out
}

export type Searchable = { slug: string; name: string; brand: string; brandSlug: string; type?: string; category: string; skin: string[]; concerns: string[]; price: number; stock: number; sold: number; reviews: number }

/** Score > 0 = matches. Higher first; ties: sold, reviews, in stock. */
export function rank<T extends Searchable>(items: T[], u: Understood): { hits: T[]; closest: boolean } {
  const scored = items.map((p) => {
    if (u.max && p.price > u.max) return { p, s: -1 }
    if (u.min && p.price < u.min) return { p, s: -1 }
    let s = 0
    if (u.type) s += p.category === u.type ? 4 : -2
    if (u.skin) s += p.skin.includes(u.skin) ? 3 : u.skin === 'normal' ? 0 : -1
    if (u.concern) s += p.concerns.includes(u.concern) ? 3 : -1
    if (u.brand) s += p.brandSlug === u.brand ? 5 : -3
    const hay = normalize(`${p.brand} ${p.name} ${p.type ?? ''}`)
    for (const w of u.words) if (hay.includes(w) || (w.length > 4 && hay.includes(w.slice(0, -1)))) s += 2
    return { p, s }
  })
  const order = (a: { p: T; s: number }, b: { p: T; s: number }) => b.s - a.s || b.p.sold - a.p.sold || b.p.reviews - a.p.reviews || Number(b.p.stock > 0) - Number(a.p.stock > 0)
  const hits = scored.filter((x) => x.s > 0).sort(order).map((x) => x.p)
  if (hits.length) return { hits, closest: false }
  // never empty: the 4 nearest (best partial score, then popular)
  return { hits: scored.filter((x) => x.s > -1).sort(order).slice(0, 4).map((x) => x.p), closest: true }
}
