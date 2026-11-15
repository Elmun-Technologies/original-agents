// Brands A–Z — design/screens/Brands.jpg
import { notFound } from 'next/navigation'

import { BrandsPage } from '@/components/pages/Brands'
import { getStore, payload } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'
import type { Media } from '@/payload-types'
import { meta } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? meta(lang, '/brendlar', { title: t(lang, 'Brendlar'), description: t(lang, 'Koreys kosmetikasi brendlari A–Z: original mahsulotlar, partiya hujjatlari bilan.') }) : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const p = await payload()
  const [brands, products, store] = await Promise.all([
    p.find({ collection: 'brands', where: { slug: { not_equals: 'yeppo' } }, locale: lang, depth: 1, limit: 500, sort: 'order', pagination: false }),
    p.find({ collection: 'products', depth: 0, limit: 5000, pagination: false, select: { brand: true } }),
    getStore(),
  ])
  const count = new Map<string, number>()
  for (const pr of products.docs) count.set(String(pr.brand), (count.get(String(pr.brand)) ?? 0) + 1)
  const rows = brands.docs.map((b) => ({
    slug: b.slug, name: b.name, tagline: b.tagline ?? undefined, short: b.short ?? undefined, featured: !!b.featured,
    cover: (b.cover as Media | null)?.url ?? undefined, count: count.get(String(b.id)) ?? 0,
  }))
  return <BrandsPage lang={lang} brands={rows} telegramUrl={store.telegramUrl} />
}
