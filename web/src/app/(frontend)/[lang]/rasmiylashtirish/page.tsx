// Checkout — design/screens/Checkout.jpg (+ Checkout.ru, TabletCheckout, MobileCheckout).
import { notFound } from 'next/navigation'

import { CheckoutView } from '@/components/checkout/Checkout'
import { getStore } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? { title: `${t(lang, 'Rasmiylashtirish')} — Yeppo`, robots: { index: false } } : {}
}

export default async function CheckoutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const s = await getStore()
  return <CheckoutView lang={lang} store={{ tashkentPrice: s.tashkentPrice, regionPrice: s.regionPrice, regionDays: s.regionDays, giftBoxPrice: s.giftBoxPrice, returnDays: s.returnDays, telegramUrl: s.telegramUrl }} />
}
