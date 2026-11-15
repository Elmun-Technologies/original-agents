import { getPayload, type Where } from 'payload'
import { cache } from 'react'

import config from '@/payload.config'
import type { Media, Product, Store } from '@/payload-types'
import type { CardProduct } from '@/components/shop'
import type { Lang } from './i18n'

export const payload = cache(async () => getPayload({ config: await config }))

export const getStore = cache(async (): Promise<Store> => (await payload()).findGlobal({ slug: 'store', depth: 1 }))

const DAY = 86_400_000

/** "Old price" = the highest real price of this SKU in the last 30 days, only if above today's (HANDOFF §5.3). */
export async function oldPrices(skus: string[]): Promise<Map<string, number>> {
  if (!skus.length) return new Map()
  const p = await payload()
  const res = await p.find({
    collection: 'price-history',
    where: { sku: { in: skus }, createdAt: { greater_than: new Date(Date.now() - 30 * DAY).toISOString() } },
    limit: 10_000,
    depth: 0,
    pagination: false,
  })
  const max = new Map<string, number>()
  for (const h of res.docs) max.set(h.sku, Math.max(max.get(h.sku) ?? 0, h.price))
  return max
}

/** Verified, approved reviews only: count, average, 5…1 distribution. */
export async function reviewStats(productIds: (number | string)[]) {
  const out = new Map<string, { count: number; avg: number; dist: number[] }>()
  if (!productIds.length) return out
  const p = await payload()
  const res = await p.find({ collection: 'reviews', where: { product: { in: productIds }, approved: { equals: true } }, depth: 0, limit: 100_000, pagination: false, select: { product: true, rating: true } })
  for (const r of res.docs) {
    const key = String(typeof r.product === 'object' ? r.product.id : r.product)
    const s = out.get(key) ?? { count: 0, avg: 0, dist: [0, 0, 0, 0, 0] }
    s.avg = (s.avg * s.count + r.rating) / (s.count + 1)
    s.count++
    s.dist[5 - r.rating]++
    out.set(key, s)
  }
  return out
}

const img = (m: unknown) => (m && typeof m === 'object' ? ((m as Media).url ?? '') : '')

export function discountPct(price: number, old?: number) {
  return old && old > price ? Math.round((1 - price / old) * 100) : 0
}

export async function toCards(products: Product[], lang: Lang): Promise<CardProduct[]> {
  // Variant yo'q mahsulot katalogda ko'rsatilmaydi va sahifani buzmasin ("sku" o'qishda crash bo'lmasin)
  const list = products.filter((pr) => Array.isArray(pr.variants) && pr.variants.length > 0)
  const first = list.map((pr) => pr.variants[0])
  const [olds, stats] = await Promise.all([oldPrices(first.map((v) => v.sku)), reviewStats(list.map((pr) => pr.id))])
  return list.map((pr, i) => {
    const v = first[i]
    const old = (olds.get(v.sku) ?? 0) > v.price ? olds.get(v.sku) : undefined
    const pct = discountPct(v.price, old)
    const tags: CardProduct['tags'] = []
    if (pr.tags?.includes('set')) tags.push({ t: 'Toʻplam', cls: 'tag-hit' })
    else if (pr.tags?.includes('hit')) tags.push({ t: 'Hit', cls: 'tag-hit' })
    if (pr.tags?.includes('new')) tags.push({ t: 'Yangi', cls: 'tag-new' })
    if (pct) tags.push({ t: `−${pct}%`, cls: 'tag-sale' })
    return {
      slug: pr.slug,
      sku: v.sku,
      brand: typeof pr.brand === 'object' ? pr.brand.name : '',
      name: pr.name,
      img: img(pr.images?.[0]),
      vol: v.volume ?? undefined,
      type: pr.type ?? undefined,
      price: v.price,
      old,
      tags,
      rating: stats.get(String(pr.id))?.avg,
      reviews: stats.get(String(pr.id))?.count,
    }
  })
}

export type HomeCard = CardProduct & { skin: string[]; concerns: string[]; category: string; stock: number }

/** Cards plus what the home blocks filter on (skin, concerns, category slug). */
export async function homeCards(lang: Lang): Promise<HomeCard[]> {
  const p = await payload()
  // ponytail: catalog order until there are sales; rank by orders (last 30 days) once orders exist
  const res = await p.find({ collection: 'products', where: { 'category.slug': { not_equals: 'sertifikatlar' } }, limit: 200, sort: 'createdAt', locale: lang, depth: 1 })
  const homeList = res.docs.filter((pr) => Array.isArray(pr.variants) && pr.variants.length > 0)
  const cards = await toCards(homeList, lang)
  return cards.map((c, i) => {
    const pr = homeList[i]
    return { ...c, skin: pr.skin ?? [], concerns: pr.concerns ?? [], category: typeof pr.category === 'object' ? pr.category.slug : '', stock: pr.variants.reduce((a, v) => a + (v.stock ?? 0), 0) }
  })
}

export async function findCards(lang: Lang, where: Where = {}, limit = 24, sort = '-createdAt') {
  const p = await payload()
  const res = await p.find({ collection: 'products', where: { and: [where, { 'category.slug': { not_equals: 'sertifikatlar' } }] }, limit, sort, locale: lang, depth: 1 })
  return toCards(res.docs, lang)
}

export type CatalogItem = HomeCard & { stock: number; brandSlug: string; createdAt: string; order: number }

const TYPE_PLURAL: Record<string, string> = {
  Ampula: 'Ampulalar', Serum: 'Serumlar', Essensiya: 'Essensiyalar', Toner: 'Tonerlar', Krem: 'Kremlar',
  SPF: 'SPF', Niqob: 'Niqoblar', Tozalovchi: 'Tozalovchilar', 'Toʻplam': 'Toʻplamlar',
}

/** Everything the catalog page needs for one category (filtering happens on the page, see lib/filters.ts). */
export async function catalogData(slug: string, lang: Lang) {
  const p = await payload()
  const cat = (await p.find({ collection: 'categories', where: { slug: { equals: slug } }, locale: lang, depth: 1, limit: 1 })).docs[0]
  if (!cat) return null
  const parent = cat.parent && typeof cat.parent === 'object' ? cat.parent : null
  const [siblings, children] = await Promise.all([
    parent ? p.find({ collection: 'categories', where: { parent: { equals: parent.id } }, sort: 'order', locale: lang, limit: 50, depth: 0 }) : null,
    p.find({ collection: 'categories', where: { parent: { equals: cat.id } }, locale: lang, limit: 50, depth: 0 }),
  ])
  const ids = [cat.id, ...children.docs.map((c) => c.id)]
  // ponytail: whole category in memory and filtered in JS — fine for hundreds of products; move to SQL if a category grows past ~2000
  const res = await p.find({ collection: 'products', where: { category: { in: ids } }, sort: 'createdAt', locale: lang, depth: 1, limit: 2000, pagination: false })
  const catList = res.docs.filter((pr) => Array.isArray(pr.variants) && pr.variants.length > 0)
  const cards = await toCards(catList, lang)
  const items: CatalogItem[] = cards.map((c, i) => {
    const pr = catList[i]
    const brand = typeof pr.brand === 'object' ? pr.brand : null
    return {
      ...c, skin: pr.skin ?? [], concerns: pr.concerns ?? [], category: typeof pr.category === 'object' ? pr.category.slug : '',
      stock: pr.variants.reduce((a, v) => a + (v.stock ?? 0), 0), brandSlug: brand?.slug ?? '', createdAt: pr.createdAt, order: i,
    }
  })
  // sub-category pills (design: Hammasi, Ampulalar, Serumlar, Essensiyalar, Tonerlar, SPF): product types inside
  // this category when there are several, then the sibling categories
  const typeOf = (pr: Product) => (pr.type && Object.entries(TYPE_PLURAL).find(([k]) => k === pr.type) ? pr.type : undefined)
  const uzTypes = await p.find({ collection: 'products', where: { category: { in: ids } }, locale: 'uz', depth: 0, limit: 2000, pagination: false, select: { type: true } })
  const types = [...new Set(uzTypes.docs.map((d) => typeOf(d as Product)).filter(Boolean))] as string[]
  const firstImg = (pred: (c: CatalogItem) => boolean) => items.find(pred)?.img
  const subs: { label: string; href: string; img?: string; type?: string }[] = types.length > 1
    ? types.map((ty) => ({ label: TYPE_PLURAL[ty], href: `/katalog/${slug}?tur=${encodeURIComponent(ty)}`, type: ty,
        img: items[uzTypes.docs.findIndex((d) => d.type === ty)]?.img }))
    : []
  const siblingCards = await Promise.all((siblings?.docs ?? []).filter((s) => s.id !== cat.id).map(async (s) => {
    const one = await p.find({ collection: 'products', where: { category: { equals: s.id } }, limit: 1, depth: 1, sort: 'createdAt' })
    const m = one.docs[0]?.images?.[0]
    return { label: s.short || s.title, href: `/katalog/${s.slug}`, img: m && typeof m === 'object' ? (m.url ?? undefined) : undefined }
  }))
  const brands = [...new Map(res.docs.flatMap((pr) => (typeof pr.brand === 'object' ? [[pr.brand.slug, pr.brand.name] as const] : []))).entries()]
  const prices = items.map((x) => x.price)
  return {
    cat, parent, items, subs, siblings: siblingCards, brands, allImg: firstImg(() => true),
    priceMin: prices.length ? Math.min(...prices) : 0, priceMax: prices.length ? Math.max(...prices) : 0,
  }
}

/** ml from "55 ml" / "10 × 24 ml" (null if not a volume) — for the per-ml price on the product page. */
export function millilitres(volume?: string | null): number | null {
  const m = (volume ?? '').replace(',', '.').match(/(?:(\d+)\s*[×x]\s*)?(\d+(?:\.\d+)?)\s*ml/i)
  return m ? (m[1] ? Number(m[1]) : 1) * Number(m[2]) : null
}

/** Everything the product page needs. */
export async function productData(slug: string, lang: Lang) {
  const p = await payload()
  const pr = (await p.find({ collection: 'products', where: { slug: { equals: slug } }, locale: lang, depth: 2, limit: 1 })).docs[0]
  if (!pr) return null
  const cat = typeof pr.category === 'object' ? pr.category : null
  const parent = cat?.parent && typeof cat.parent === 'object' ? cat.parent : null
  const brand = typeof pr.brand === 'object' ? pr.brand : null
  const olds = await oldPrices(pr.variants.map((v) => v.sku))
  const variants = pr.variants.map((v) => {
    const old = (olds.get(v.sku) ?? 0) > v.price ? olds.get(v.sku) : undefined
    const ml = millilitres(v.volume)
    return { sku: v.sku, volume: v.volume ?? '', price: v.price, old, stock: v.stock ?? 0, perMl: ml ? Math.round(v.price / ml) : null }
  })
  const images = (pr.images ?? []).flatMap((m) => (typeof m === 'object' && m.url ? [{ url: m.url, alt: m.alt, caption: m.caption ?? undefined }] : []))
  const [self] = await toCards([pr], lang)
  // "bought together": admin's choice, else routine logic — a toner and an SPF from other categories (design: amp + toner + SPF)
  let pairs = (pr.pairsWith ?? []).filter((x): x is Product => typeof x === 'object')
  const want = ['toner', 'spf'].filter((s) => s !== cat?.slug)
  const [rest, sim] = await Promise.all([
    pairs.length ? null : p.find({ collection: 'products', where: { 'category.slug': { in: want } }, locale: lang, depth: 1, limit: 20, sort: 'createdAt' }),
    p.find({ collection: 'products', where: { category: { equals: cat?.id ?? 0 }, slug: { not_equals: slug } }, locale: lang, depth: 1, limit: 5, sort: 'createdAt' }),
  ])
  if (rest) pairs = want.map((w) => rest.docs.find((d) => typeof d.category === 'object' && d.category.slug === w)).filter(Boolean) as Product[]
  let similar = sim.docs
  if (similar.length < 5) {
    const more = await p.find({ collection: 'products', where: { slug: { not_in: [slug, ...similar.map((d) => d.slug)] } }, locale: lang, depth: 1, limit: 5 - similar.length, sort: 'createdAt' })
    similar = [...similar, ...more.docs]
  }
  const [pairCards, similarCards, stats, reviews] = await Promise.all([
    toCards(pairs, lang), toCards(similar, lang), reviewStats([pr.id]),
    p.find({ collection: 'reviews', where: { product: { equals: pr.id }, approved: { equals: true } }, sort: '-createdAt', limit: 20, depth: 0 }),
  ])
  return { pr, cat, parent, brand, variants, images, self, pairs: pairCards, similar: similarCards, stats: stats.get(String(pr.id)), reviews: reviews.docs }
}

/** Units sold per SKU in paid, not refunded orders since `from` (Top-10 ranking). */
export async function salesBySku(from: Date) {
  const p = await payload()
  const res = await p.find({ collection: 'orders', where: { paymentStatus: { equals: 'paid' }, status: { not_equals: 'cancelled' }, paidAt: { greater_than: from.toISOString() } },
    depth: 0, limit: 10_000, pagination: false, overrideAccess: true, select: { items: true } })
  const out = new Map<string, number>()
  for (const o of res.docs) for (const it of o.items ?? []) out.set(it.sku, (out.get(it.sku) ?? 0) + it.qty)
  return out
}

/** category slug -> number of products in it (header menu: hide empty/missing categories, show counts) */
export const categoryCounts = cache(async (): Promise<Record<string, number>> => {
  const p = await payload()
  const [cats, products] = await Promise.all([
    p.find({ collection: 'categories', depth: 0, limit: 200, pagination: false, select: { slug: true } }),
    p.find({ collection: 'products', depth: 0, limit: 5000, pagination: false, select: { category: true } }),
  ])
  const byId = new Map(cats.docs.map((c) => [c.id, c.slug]))
  const out: Record<string, number> = Object.fromEntries(cats.docs.map((c) => [c.slug, 0]))
  for (const pr of products.docs) {
    const slug = byId.get(typeof pr.category === 'object' ? pr.category.id : pr.category)
    if (slug) out[slug]++
  }
  return out
})
