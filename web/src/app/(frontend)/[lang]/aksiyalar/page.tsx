// Sales + Top-10 — design/screens/Rating.jpg
import { notFound } from 'next/navigation'

import { RatingPage } from '@/components/pages/Rating'
import { homeCards, payload, salesBySku } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'
import { daysAgo } from '@/lib/format'
import { meta } from '@/lib/seo'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? meta(lang, '/aksiyalar', { title: t(lang, 'Aksiyalar'), description: t(lang, 'Koreys kosmetikasiga chegirmalar va eng koʻp sotilayotgan mahsulotlar.') }) : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const p = await payload()
  const [cards, sales, banners, promo, needs] = await Promise.all([
    homeCards(lang), salesBySku(daysAgo(30)),
    p.find({ collection: 'banners', where: { kind: { equals: 'sale' }, active: { equals: true } }, sort: 'order', limit: 1, locale: lang, depth: 0 }),
    p.find({ collection: 'promo-codes', where: { active: { equals: true }, firstOrderOnly: { equals: true } }, limit: 1, locale: lang, depth: 0, overrideAccess: true }),
    p.find({ collection: 'products', locale: lang, depth: 0, limit: 500, pagination: false, select: { slug: true, need: true } }),
  ])
  const need = new Map(needs.docs.map((d) => [d.slug, d.need ?? undefined]))
  const bySales = sales.size > 0
  const top = cards.map((c, i) => ({ ...c, need: need.get(c.slug), sold: sales.get(c.sku) ?? 0, i }))
    .sort((a, b) => b.sold - a.sold || a.i - b.i)
  const sale = banners.docs[0]
  const endsAt = sale?.endsAt && new Date(sale.endsAt) > new Date() ? sale.endsAt : undefined
  const month = new Date().toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { month: 'long', timeZone: 'Asia/Tashkent' })
  const pr = promo.docs[0]
  return <RatingPage lang={lang} deals={cards.filter((c) => c.old)} top={top} bySales={bySales} endsAt={endsAt} month={month}
    promo={pr ? { code: pr.code, note: pr.note ?? undefined } : undefined} />
}
