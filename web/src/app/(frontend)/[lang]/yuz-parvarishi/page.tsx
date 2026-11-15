// Face care hub — design/screens/CategoryHub.jpg
import { notFound } from 'next/navigation'

import { CategoryHubPage } from '@/components/pages/CategoryHub'
import { ConcernTabs } from '@/components/pages/ConcernTabs'
import { kit } from '@/components/pages/kit'
import { homeCards } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'
import { meta } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? meta(lang, '/yuz-parvarishi', { title: t(lang, 'Yuz parvarishi'), description: t(lang, 'Yuz parvarishi: serumlar, tonerlar, kremlar, SPF va niqoblar — teri turi va muammo boʻyicha tanlang.') }) : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const cards = await homeCards(lang)
  // ponytail: "most bought in this section" = catalog order until there are orders
  const k = kit(lang, cards.filter((c) => c.category !== 'toplamlar'))
  return <CategoryHubPage tr={k.tr} L={k.L} C={k.C} tabs={<ConcernTabs lang={lang} products={cards} />} />
}
