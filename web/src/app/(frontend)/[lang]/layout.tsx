import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import '../fonts.css'
import '../styles.css'
import { Footer, MobileTabBar, Toast } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Tracker } from '@/components/Tracker'
import { ShopProvider } from '@/components/shop'
import { categoryCounts, getStore } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'
import { siteUrl } from '@/lib/site'

// Pages are rendered on first request (no DB during the Docker build) and refreshed every minute,
// so admin price/stock changes show up without a rebuild.
export const generateStaticParams = () => []
export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  if (!isLang(lang)) return {}
  return {
    // the site address: one setting, SITE_URL (lib/site.ts)
    metadataBase: new URL(siteUrl()),
    // defaults only; every page sets its own canonical + hreflang through lib/seo meta()
    title: t(lang, 'Yeppo — koreys kosmetikasi internet doʻkoni'),
    applicationName: 'Yeppo',
    formatDetection: { telephone: false },
    ...(process.env.SITE_NOINDEX === '1' || process.env.SITE_PASSWORD ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const [store, cats] = await Promise.all([getStore(), categoryCounts()])
  const info = { tashkentDays: store.tashkentDays, freeDeliveryFrom: store.freeDeliveryFrom, telegramUrl: store.telegramUrl }
  return (
    <html lang={lang}>
      <body>
        <ShopProvider>
          <Header lang={lang} store={info} cats={cats} />
          <main>{children}</main>
          <Footer lang={lang} telegramUrl={store.telegramUrl} />
          <MobileTabBar lang={lang} />
          <Toast lang={lang} />
          <Tracker />
        </ShopProvider>
      </body>
    </html>
  )
}
