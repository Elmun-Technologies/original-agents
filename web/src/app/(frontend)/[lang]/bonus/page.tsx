// Loyalty — design/screens/Loyalty.jpg
import { notFound } from 'next/navigation'

import { LoyaltyPage } from '@/components/pages/Loyalty'
import { kit } from '@/components/pages/kit'
import { isLang, t } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? { title: `${t(lang, 'Bonus dasturi')} — Yeppo` } : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const cards: never[] = []
  const k = kit(lang, cards)
  return <LoyaltyPage tr={k.tr} L={k.L} C={k.C} />
}
