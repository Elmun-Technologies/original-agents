// Journal — design/screens/Journal.jpg
import { notFound } from 'next/navigation'

import { JournalPage } from '@/components/pages/Journal'
import { ARTICLE_CATS } from '@/collections/shop'
import { getStore, payload } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'
import type { Media } from '@/payload-types'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? { title: `${t(lang, 'Jurnal')} — Yeppo`, alternates: { canonical: `/${lang}/jurnal` } } : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const p = await payload()
  const [arts, ings, store] = await Promise.all([
    p.find({ collection: 'articles', sort: '-publishedAt', locale: lang, depth: 1, limit: 200, pagination: false }),
    p.find({ collection: 'ingredients', sort: 'order', locale: lang, depth: 0, limit: 200, pagination: false }),
    getStore(),
  ])
  return (
    <JournalPage lang={lang} telegramUrl={store.telegramUrl}
      articles={arts.docs.map((a) => ({ slug: a.slug, title: a.title, excerpt: a.excerpt ?? undefined, category: a.category,
        catLabel: ARTICLE_CATS.find((c) => c.value === a.category)?.label ?? '', cover: (a.cover as Media | null)?.url ?? undefined,
        pos: a.coverPos ?? undefined, minutes: a.minutes ?? 4, featured: !!a.featured }))}
      ingredients={ings.docs.map((i) => ({ name: i.name, does: i.does ?? undefined, who: i.who ?? undefined, care: i.care ?? undefined }))} />
  )
}
