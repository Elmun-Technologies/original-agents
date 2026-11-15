// Cart — design/screens/Cart.jpg (+ Cart.ru, MobileCart).
import { notFound } from 'next/navigation'

import { CartView } from '@/components/checkout/Cart'
import { isLang, t } from '@/lib/i18n'
import { meta } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? meta(lang, '/savat', { title: t(lang, 'Savat'), noindex: true }) : {}
}

export default async function CartPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  return <CartView lang={lang} />
}
