// Routine — design/screens/Routine.jpg
import { notFound } from 'next/navigation'

import { RoutinePage } from '@/components/pages/Routine'
import { homeCards } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'
import { meta } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? meta(lang, '/rutina', { title: t(lang, 'Rutina'), description: t(lang, 'Oʻz rutinangizni yigʻing: har qadamga bitta vosita va mos kelmaydigan tarkiblar haqida ogohlantirish.') }) : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  return <RoutinePage lang={lang} products={await homeCards(lang)} />
}
