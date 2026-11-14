// Cart — design/screens/Cart.jpg (+ Cart.ru, MobileCart).
import { notFound } from 'next/navigation'

import { CartView } from '@/components/checkout/Cart'
import { isLang, t } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? { title: `${t(lang, 'Savat')} — Yeppo`, robots: { index: false } } : {}
}

export default async function CartPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  return <CartView lang={lang} />
}
