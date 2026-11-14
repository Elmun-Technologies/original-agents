import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import '../fonts.css'
import '../styles.css'
import { Footer, MobileTabBar, Toast } from '@/components/Footer'
import { Header } from '@/components/Header'
import { ShopProvider } from '@/components/shop'
import { getStore } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'

// Pages are rendered on first request (no DB during the Docker build) and refreshed every minute,
// so admin price/stock changes show up without a rebuild.
export const generateStaticParams = () => []
export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  if (!isLang(lang)) return {}
  return {
    title: t(lang, 'Yeppo — koreys kosmetikasi internet doʻkoni'),
    alternates: { languages: { uz: '/uz', ru: '/ru' } },
  }
}

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const store = await getStore()
  const info = { tashkentDays: store.tashkentDays, freeDeliveryFrom: store.freeDeliveryFrom, telegramUrl: store.telegramUrl }
  return (
    <html lang={lang}>
      <body>
        <ShopProvider>
          <Header lang={lang} store={info} />
          <main>{children}</main>
          <Footer lang={lang} telegramUrl={store.telegramUrl} />
          <MobileTabBar lang={lang} />
          <Toast lang={lang} />
        </ShopProvider>
      </body>
    </html>
  )
}
