// Account — design/screens/Account.jpg
import { notFound } from 'next/navigation'

import { AccountPage } from '@/components/pages/Account'
import { kit } from '@/components/pages/kit'
import { isLang, t } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? { title: `${t(lang, 'Kabinet')} — Yeppo` } : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const cards: never[] = []
  const k = kit(lang, cards)
  return <AccountPage tr={k.tr} L={k.L} C={k.C} />
}
