// Consultant — design/screens/Consultant.jpg
import { notFound } from 'next/navigation'

import { ConsultantPage } from '@/components/pages/Consultant'
import { getStore, homeCards, payload } from '@/lib/catalog'
import { sessionPhone } from '@/lib/customer'
import { isLang, t } from '@/lib/i18n'
import { meta } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? meta(lang, '/maslahatchi', { title: t(lang, 'Maslahatchi'), description: t(lang, 'Bir necha savolga javob bering — teringizga mos parvarishni tanlab beramiz. Tibbiy tashxis emas.') }) : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const p = await payload()
  const [products, store, brands, phone] = await Promise.all([
    homeCards(lang), getStore(),
    p.find({ collection: 'brands', depth: 0, limit: 500, pagination: false, select: { slug: true, name: true } }), sessionPhone(),
  ])
  return <ConsultantPage lang={lang} products={products} brands={brands.docs.map((b) => ({ slug: b.slug, name: b.name }))} telegram={store.telegramBotUrl} hours={store.supportHours ?? ''} signedIn={!!phone} />
}
