// Search — design/screens/Search.jpg (+ MobileSearch). Server-side understanding + ranking (lib/search.ts).
import { notFound } from 'next/navigation'

import { SearchPage } from '@/components/pages/Search'
import { homeCards, payload, salesBySku } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'
import { normalize, rank, understand } from '@/lib/search'
import { daysAgo } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: true } }

const SKIN: Record<string, string> = { dry: 'Quruq teri', oily: 'Yogʻli teri', combo: 'Aralash teri', sens: 'Sezgir teri', normal: 'Normal teri' }
const CONCERN: Record<string, string> = { acne: 'Toshma va qizarish', pores: 'Kengaygan poralar', pigment: 'Pigment dogʻlar', dryness: 'Quruqlik', wrinkles: 'Birinchi ajinlar', dull: 'Xira rang' }

export default async function Page({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ q?: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const q = String((await searchParams).q ?? '').slice(0, 120).trim()
  const p = await payload()
  const [cards, brands, cats, sales, popular] = await Promise.all([
    homeCards(lang),
    p.find({ collection: 'brands', depth: 0, limit: 500, pagination: false, select: { slug: true, name: true } }),
    p.find({ collection: 'categories', locale: lang, depth: 0, limit: 100, pagination: false, select: { slug: true, title: true } }),
    salesBySku(daysAgo(30)),
    p.find({ collection: 'search-log', where: { missed: { equals: false } }, sort: '-count', limit: 5, depth: 0, overrideAccess: true }),
  ])
  const items = cards.map((c) => ({ ...c, brandSlug: brands.docs.find((b) => b.name === c.brand)?.slug ?? '', stock: 1, sold: sales.get(c.sku) ?? 0, reviews: c.reviews ?? 0 }))
  const u = understand(q, brands.docs)
  const { hits, closest } = q ? rank(items, u) : { hits: [], closest: false }
  if (q) {
    // count the query (normalized); best effort, never blocks the page
    const key = normalize(q)
    try {
      const row = (await p.find({ collection: 'search-log', where: { query: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
      if (row) await p.update({ collection: 'search-log', id: row.id, overrideAccess: true, data: { count: (row.count ?? 0) + 1, missed: closest } })
      else await p.create({ collection: 'search-log', overrideAccess: true, data: { query: key, count: 1, missed: closest } })
    } catch {}
  }
  const tr = (s: string) => t(lang, s)
  const brandName = u.brand && brands.docs.find((b) => b.slug === u.brand)?.name
  const typeTitle = u.type && cats.docs.find((c) => c.slug === u.type)?.title
  const chips = [u.skin && tr(SKIN[u.skin]), u.concern && tr(CONCERN[u.concern]), typeTitle, brandName, u.max && `≤ ${u.max.toLocaleString('ru-RU')}`].filter(Boolean) as string[]
  const byCat = new Map<string, number>()
  for (const h of hits) byCat.set(h.category, (byCat.get(h.category) ?? 0) + 1)
  const catRows = [...byCat.entries()].map(([slug, n]) => ({ slug, n, title: cats.docs.find((c) => c.slug === slug)?.title ?? slug })).filter((c) => c.slug)
  return <SearchPage lang={lang} q={q} chips={chips} hits={hits.slice(0, 24)} closest={closest} popular={popular.docs.map((d) => d.query)} cats={closest ? [] : catRows} />
}
