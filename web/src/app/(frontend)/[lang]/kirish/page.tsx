// Login — design/screens/Login.jpg
import { notFound, redirect } from 'next/navigation'

import { LoginPage } from '@/components/pages/Login'
import { sessionPhone } from '@/lib/customer'
import { href, isLang, t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? { title: `${t(lang, 'Kirish')} — Yeppo`, robots: { index: false } } : {}
}

export default async function Page({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ next?: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const { next: n } = await searchParams
  const next = n && n.startsWith(`/${lang}/`) && !n.startsWith('//') ? n : href(lang, '/kabinet') // same-site only
  if (await sessionPhone()) redirect(next)
  return <LoginPage lang={lang} next={next} />
}
