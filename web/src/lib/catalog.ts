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
async function oldPrices(skus: string[]): Promise<Map<string, number>> {
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

const img = (m: unknown) => (m && typeof m === 'object' ? ((m as Media).url ?? '') : '')

export function discountPct(price: number, old?: number) {
  return old && old > price ? Math.round((1 - price / old) * 100) : 0
}

export async function toCards(products: Product[], lang: Lang): Promise<CardProduct[]> {
  const first = products.map((pr) => pr.variants[0])
  const olds = await oldPrices(first.map((v) => v.sku))
  return products.map((pr, i) => {
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
    }
  })
}

export type HomeCard = CardProduct & { skin: string[]; concerns: string[]; category: string }

/** Cards plus what the home blocks filter on (skin, concerns, category slug). */
export async function homeCards(lang: Lang): Promise<HomeCard[]> {
  const p = await payload()
  // ponytail: catalog order until there are sales; rank by orders (last 30 days) once orders exist
  const res = await p.find({ collection: 'products', limit: 200, sort: 'createdAt', locale: lang, depth: 1 })
  const cards = await toCards(res.docs, lang)
  return cards.map((c, i) => {
    const pr = res.docs[i]
    return { ...c, skin: pr.skin ?? [], concerns: pr.concerns ?? [], category: typeof pr.category === 'object' ? pr.category.slug : '' }
  })
}

export async function findCards(lang: Lang, where: Where = {}, limit = 24, sort = '-createdAt') {
  const p = await payload()
  const res = await p.find({ collection: 'products', where, limit, sort, locale: lang, depth: 1 })
  return toCards(res.docs, lang)
}
