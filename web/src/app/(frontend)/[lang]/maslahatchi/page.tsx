// Consultant — design/screens/Consultant.jpg
import { notFound } from 'next/navigation'

import { ConsultantPage } from '@/components/pages/Consultant'
import { kit } from '@/components/pages/kit'
import { isLang, t } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? { title: `${t(lang, 'AI maslahatchi')} — Yeppo` } : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const cards: never[] = []
  const k = kit(lang, cards)
  return <ConsultantPage tr={k.tr} L={k.L} C={k.C} />
}
