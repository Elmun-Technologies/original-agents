// Article — design/screens/Article.jpg ("answer first"; schema.org Article + FAQPage).
import { notFound } from 'next/navigation'

import { ArticlePage } from '@/components/pages/Article'
import { payload, toCards } from '@/lib/catalog'
import { isLang } from '@/lib/i18n'
import { siteUrl } from '@/lib/payments/config'
import type { Media, Product } from '@/payload-types'
import { meta } from '@/lib/seo'

type Props = { params: Promise<{ lang: string; slug: string }> }
const load = async (lang: 'uz' | 'ru', slug: string) =>
  (await (await payload()).find({ collection: 'articles', where: { slug: { equals: slug } }, locale: lang, depth: 2, limit: 1 })).docs[0]

export async function generateMetadata({ params }: Props) {
  const { lang, slug } = await params
  if (!isLang(lang)) return {}
  const a = await load(lang, slug)
  return a ? meta(lang, `/jurnal/${slug}`, { title: a.seoTitle || a.title, description: a.seoDescription || a.shortAnswer || a.excerpt, type: 'article', image: typeof a.cover === 'object' ? a.cover?.url : undefined }) : {}
}

export default async function Page({ params }: Props) {
  const { lang, slug } = await params
  if (!isLang(lang)) notFound()
  const a = await load(lang, slug)
  if (!a) notFound()
  const p = await payload()
  const steps = a.steps ?? []
  const prods = steps.map((s) => s.product).filter((x): x is Product => typeof x === 'object' && !!x)
  const [cards, more] = await Promise.all([
    toCards(prods, lang),
    p.find({ collection: 'articles', where: { slug: { not_equals: slug } }, sort: '-publishedAt', locale: lang, depth: 1, limit: 3 }),
  ])
  const card = (x: unknown) => (x && typeof x === 'object' ? cards.find((c) => c.slug === (x as Product).slug) : undefined)
  const date = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined
  const site = siteUrl()
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.shortAnswer ?? a.excerpt ?? undefined, datePublished: a.publishedAt ?? undefined,
      image: (a.cover as Media | null)?.url ? site + (a.cover as Media).url : undefined, inLanguage: lang, ...(a.author ? { author: { '@type': 'Person', name: a.author } } : {}) },
    ...((a.faq ?? []).length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: a.faq!.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
  ]
  return (
    <>
      <ArticlePage lang={lang} a={{
        slug: a.slug, title: a.title, accent: a.accent ?? undefined, tag: a.tag ?? undefined, minutes: a.minutes ?? 4, author: a.author ?? undefined,
        reviewedBy: a.reviewedBy ?? undefined, date, cover: (a.cover as Media | null)?.url ?? undefined, coverPos: a.coverPos ?? undefined,
        shortAnswer: a.shortAnswer ?? undefined, sections: (a.sections ?? []).map((s) => ({ h: s.h, text: s.text ?? undefined })),
        steps: steps.map((s) => ({ t: s.t ?? undefined, d: s.d ?? undefined, p: card(s.product) })),
        ingredients: (a.ingredients ?? []).map((x) => ({ name: x.name ?? undefined, d: x.d ?? undefined })), faq: (a.faq ?? []).map((f) => ({ q: f.q, a: f.a })),
        more: more.docs.map((m) => ({ slug: m.slug, title: m.title, cover: (m.cover as Media | null)?.url ?? undefined })),
      }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
    </>
  )
}
