import type { MetadataRoute } from 'next'

import { payload } from '@/lib/catalog'
import { HELP_SLUGS } from '@/lib/help'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic' // reads the database (not available while the Docker image builds)

type Entry = MetadataRoute.Sitemap[number]
const STATIC = ['/', '/yuz-parvarishi', '/aksiyalar', '/brendlar', '/jurnal', '/sovgalar', '/rutina', '/bonus', '/maslahatchi', ...HELP_SLUGS.map((s) => `/yordam/${s}`)]

/** Every indexable page in both languages, each with its uz/ru alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl()
  const p = await payload()
  const entry = (path: string, lastModified?: string | Date, priority = 0.6): Entry[] => {
    const q = path === '/' ? '' : path
    const languages = { uz: `${site}/uz${q}`, ru: `${site}/ru${q}` }
    return (['uz', 'ru'] as const).map((l) => ({ url: languages[l], lastModified, priority, alternates: { languages } }))
  }
  const all = { depth: 0, limit: 1000, pagination: false } as const
  const [cats, products, brands, segments, articles] = await Promise.all([
    p.find({ collection: 'categories', ...all, select: { slug: true, parent: true, updatedAt: true } }),
    p.find({ collection: 'products', ...all, select: { slug: true, updatedAt: true } }),
    p.find({ collection: 'brands', ...all, where: { slug: { not_equals: 'yeppo' } }, select: { slug: true, updatedAt: true } }),
    p.find({ collection: 'segments', ...all, select: { slug: true, updatedAt: true } }),
    p.find({ collection: 'articles', ...all, select: { slug: true, updatedAt: true } }),
  ])
  return [
    ...STATIC.flatMap((s) => entry(s, undefined, s === '/' ? 1 : 0.7)),
    ...cats.docs.filter((c) => c.parent && c.slug !== 'sertifikatlar').flatMap((c) => entry(`/katalog/${c.slug}`, c.updatedAt, 0.8)),
    ...products.docs.flatMap((x) => entry(`/mahsulot/${x.slug}`, x.updatedAt, 0.9)),
    ...brands.docs.flatMap((x) => entry(`/brend/${x.slug}`, x.updatedAt, 0.6)),
    ...segments.docs.flatMap((x) => entry(`/kim-uchun/${x.slug}`, x.updatedAt, 0.6)),
    ...articles.docs.flatMap((x) => entry(`/jurnal/${x.slug}`, x.updatedAt, 0.5)),
  ]
}
