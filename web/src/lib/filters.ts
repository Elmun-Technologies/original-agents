// Catalog filters (design/source/p_catalog.py). State lives in the URL so filtered pages can be shared and indexed.
export type Filters = {
  sale: boolean // aksiya=1
  tomorrow: boolean // ertaga=1  (in stock -> Tashkent next day)
  min?: number // dan
  max?: number // gacha
  skin: string[] // teri=dry,oily
  need: string[] // muammo=acne,sun
  brand: string[] // brend=slug,slug
  type?: string // tur=Ampula
  sort: 'pop' | 'new' | 'cheap' | 'exp' // tartib
  n: number // shown (24, 48 …)
}

export const PAGE = 24
const SORTS = ['pop', 'new', 'cheap', 'exp'] as const
const list = (v?: string | string[]) => (Array.isArray(v) ? v.join(',') : v || '').split(',').filter(Boolean)
const num = (v?: string | string[]) => {
  const n = Number(String(v ?? '').replace(/\D/g, ''))
  return n > 0 ? n : undefined
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const sort = String(sp.tartib ?? 'pop')
  return {
    sale: sp.aksiya === '1',
    tomorrow: sp.ertaga === '1',
    min: num(sp.dan),
    max: num(sp.gacha),
    skin: list(sp.teri),
    need: list(sp.muammo),
    brand: list(sp.brend),
    type: typeof sp.tur === 'string' && sp.tur ? sp.tur : undefined,
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as Filters['sort']) : 'pop',
    n: Math.min(Math.max(num(sp.n) ?? PAGE, PAGE), 480),
  }
}

/** Count of filters the visitor set (for the phone "Filtrlar · N" button). Sort and paging do not count. */
export const activeCount = (f: Filters) =>
  Number(f.sale) + Number(f.tomorrow) + Number(!!(f.min || f.max)) + f.skin.length + f.need.length + f.brand.length

export type Filterable = {
  price: number; old?: number; stock: number; skin: string[]; concerns: string[]; category: string
  brandSlug: string; type?: string; createdAt: string; order: number
}

// "Nima bezovta qiladi": concern keys, plus "sun" = the SPF category (as in the home picker)
const needMatch = (p: Filterable, need: string) => (need === 'sun' ? p.category === 'spf' : p.concerns.includes(need))

/** Within one group any value may match (OR); groups combine with AND. */
export function applyFilters<T extends Filterable>(items: T[], f: Filters): T[] {
  const out = items.filter((p) =>
    (!f.sale || (p.old ?? 0) > p.price) &&
    (!f.tomorrow || p.stock > 0) &&
    (!f.min || p.price >= f.min) &&
    (!f.max || p.price <= f.max) &&
    (!f.skin.length || f.skin.some((s) => p.skin.includes(s))) &&
    (!f.need.length || f.need.some((n) => needMatch(p, n))) &&
    (!f.brand.length || f.brand.includes(p.brandSlug)) &&
    (!f.type || p.type === f.type))
  const by: Record<Filters['sort'], (a: T, b: T) => number> = {
    // ponytail: "popular" = catalog order until there are orders; rank by 30-day sales then
    pop: (a, b) => a.order - b.order,
    new: (a, b) => b.createdAt.localeCompare(a.createdAt),
    cheap: (a, b) => a.price - b.price,
    exp: (a, b) => b.price - a.price,
  }
  // in-stock first, but out-of-stock items stay visible (design rule: never disappear)
  return out.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || by[f.sort](a, b))
}

/** URL for a changed filter set (keeps the order of keys stable; drops defaults). */
export function filterQuery(f: Filters): string {
  const q = new URLSearchParams()
  if (f.sale) q.set('aksiya', '1')
  if (f.tomorrow) q.set('ertaga', '1')
  if (f.min) q.set('dan', String(f.min))
  if (f.max) q.set('gacha', String(f.max))
  if (f.skin.length) q.set('teri', f.skin.join(','))
  if (f.need.length) q.set('muammo', f.need.join(','))
  if (f.brand.length) q.set('brend', f.brand.join(','))
  if (f.type) q.set('tur', f.type)
  if (f.sort !== 'pop') q.set('tartib', f.sort)
  if (f.n > PAGE) q.set('n', String(f.n))
  const s = q.toString()
  return s ? `?${s}` : ''
}
