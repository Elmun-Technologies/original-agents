// Favorites — design/screens/Favorites.jpg
import { notFound } from 'next/navigation'

import { FavoritesPage } from '@/components/pages/Favorites'
import { kit } from '@/components/pages/kit'
import { findCards } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? { title: `${t(lang, 'Sevimlilar')} — Yeppo` } : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const cards = await findCards(lang, {}, 12, 'createdAt')
  const k = kit(lang, cards)
  return <FavoritesPage tr={k.tr} L={k.L} C={k.C} />
}
