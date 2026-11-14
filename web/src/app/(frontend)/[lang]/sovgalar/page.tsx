// Gifts — design/screens/Gifts.jpg
import { notFound } from 'next/navigation'

import { GiftsPage } from '@/components/pages/Gifts'
import { homeCards, payload } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'
import type { Media } from '@/payload-types'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? { title: `${t(lang, 'Sovgʻalar')} — Yeppo`, alternates: { canonical: `/${lang}/sovgalar` } } : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const p = await payload()
  const [cards, cert] = await Promise.all([
    homeCards(lang),
    p.find({ collection: 'products', where: { 'category.slug': { equals: 'sertifikatlar' } }, limit: 1, depth: 1 }),
  ])
  const c = cert.docs[0]
  const certSkus = Object.fromEntries((c?.variants ?? []).map((v) => [v.sku, { sku: v.sku, slug: c!.slug, img: (c!.images?.[0] as Media | undefined)?.url ?? '' }]))
  return <GiftsPage lang={lang} products={cards} certSkus={certSkus} />
}
