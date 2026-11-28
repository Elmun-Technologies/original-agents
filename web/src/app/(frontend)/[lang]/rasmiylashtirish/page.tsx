// Checkout — design/screens/Checkout.jpg (+ Checkout.ru, TabletCheckout, MobileCheckout).
import { notFound } from 'next/navigation'

import { CheckoutView } from '@/components/checkout/Checkout'
import { getStore } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'
import { meta } from '@/lib/seo'
import { ORDERS_OFF_DEFAULT, siteState } from '@/lib/site-state'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? meta(lang, '/rasmiylashtirish', { title: t(lang, 'Rasmiylashtirish'), noindex: true }) : {}
}

export default async function CheckoutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const [s, site] = await Promise.all([getStore(), siteState()])
  // the owner stopped taking orders (admin → Sayt holati): the message instead of the form
  if (!site.ordersEnabled) {
    return (
      <main className="wrap" style={{ padding: '64px 16px', maxWidth: 640, textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>{t(lang, 'Rasmiylashtirish')}</h1>
        <p role="status" style={{ fontSize: 17, lineHeight: 1.5 }}>{site.ordersOffText[lang] || ORDERS_OFF_DEFAULT[lang]}</p>
        {s.telegramUrl && s.telegramUrl !== 'https://t.me/' && <p style={{ marginTop: 16 }}><a href={s.telegramUrl} target="_blank" rel="noreferrer">Telegram</a></p>}
      </main>
    )
  }
  return <CheckoutView lang={lang} store={{ tashkentPrice: s.tashkentPrice, regionPrice: s.regionPrice, regionDays: s.regionDays, giftBoxPrice: s.giftBoxPrice, returnDays: s.returnDays, telegramUrl: s.telegramUrl }} />
}
