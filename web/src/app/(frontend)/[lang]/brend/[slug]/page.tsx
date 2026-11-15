// Brand — design/screens/Brand.jpg
import { notFound } from 'next/navigation'

import { BrandPage } from '@/components/pages/Brand'
import { findCards, payload } from '@/lib/catalog'
import { isLang } from '@/lib/i18n'
import type { Media } from '@/payload-types'
import { meta } from '@/lib/seo'

type Props = { params: Promise<{ lang: string; slug: string }> }

async function load(lang: 'uz' | 'ru', slug: string) {
  const p = await payload()
  return (await p.find({ collection: 'brands', where: { slug: { equals: slug } }, locale: lang, depth: 1, limit: 1 })).docs[0]
}

export async function generateMetadata({ params }: Props) {
  const { lang, slug } = await params
  if (!isLang(lang)) return {}
  const b = await load(lang, slug)
  return b ? meta(lang, `/brend/${slug}`, { title: b.name, description: b.about ?? b.tagline }) : {}
}

export default async function Page({ params }: Props) {
  const { lang, slug } = await params
  if (!isLang(lang)) notFound()
  const b = await load(lang, slug)
  if (!b) notFound()
  const p = await payload()
  const [products, others] = await Promise.all([
    findCards(lang, { brand: { equals: b.id } }, 200, 'createdAt'),
    p.find({ collection: 'brands', where: { id: { not_equals: b.id }, slug: { not_equals: 'yeppo' } }, sort: 'order', limit: 12, depth: 0 }),
  ])
  return (
    <BrandPage lang={lang} products={products} others={others.docs.map((o) => ({ slug: o.slug, name: o.name }))}
      brand={{
        slug: b.slug, name: b.name, about: b.about ?? undefined, country: b.country ?? undefined, cover: (b.cover as Media | null)?.url ?? undefined,
        lines: (b.lines ?? []).map((l) => ({ name: l.name, keyword: l.keyword, color: l.color ?? '#E2DAD2', note: l.note ?? undefined, who: l.who ?? undefined })),
        faq: (b.faq ?? []).map((f) => ({ q: f.q, a: f.a })),
      }} />
  )
}
