// Favorites — design/screens/Favorites.jpg
import { notFound } from 'next/navigation'

import { FavoritesPage } from '@/components/pages/Favorites'
import { getStore, homeCards } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? { title: `${t(lang, 'Sevimlilar')} — Yeppo`, robots: { index: false } } : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const [products, store] = await Promise.all([homeCards(lang), getStore()])
  return <FavoritesPage lang={lang} products={products} telegram={store.telegramBotUrl} />
}
