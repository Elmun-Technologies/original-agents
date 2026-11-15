// Help — design/screens/Help.jpg; /yordam/oferta and /yordam/maxfiylik show the legal pages from the admin.
import { RichText } from '@payloadcms/richtext-lexical/react'
import { notFound } from 'next/navigation'

import { HelpPage } from '@/components/pages/Help'
import { HELP_SLUGS } from '@/lib/help'
import { getStore, payload } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'

type Props = { params: Promise<{ lang: string; bolim: string }> }

export async function generateMetadata({ params }: Props) {
  const { lang, bolim } = await params
  return isLang(lang) ? { title: `${t(lang, 'Yordam')} — Yeppo`, alternates: { canonical: `/${lang}/yordam/${bolim}` } } : {}
}

export default async function Page({ params }: Props) {
  const { lang, bolim } = await params
  if (!isLang(lang)) notFound()
  if (!(HELP_SLUGS as readonly string[]).includes(bolim)) {
    const doc = (await (await payload()).find({ collection: 'legal-pages', where: { slug: { equals: bolim } }, locale: lang, limit: 1 })).docs[0]
    if (!doc) notFound()
    return (
      <div className="wrap" style={{ marginTop: '20px' }}>
        <article className="card pad-m rich" style={{ padding: '36px', maxWidth: '880px', lineHeight: 1.7 }}>
          <h1 className="h h1" style={{ fontSize: '40px', marginBottom: '16px' }}>{doc.title}</h1>
          {doc.body ? <RichText data={doc.body} /> : <p className="muted">{t(lang, 'Matn tez orada eʼlon qilinadi.')}</p>}
        </article>
      </div>
    )
  }
  const s = await getStore()
  return (
    <HelpPage lang={lang} active={bolim} store={{
      tashkentPrice: s.tashkentPrice, regionPrice: s.regionPrice, regionDays: s.regionDays, freeDeliveryFrom: s.freeDeliveryFrom, returnDays: s.returnDays,
      orderCutoff: s.orderCutoff, refundDays: s.refundDays ?? '3–5', minShelfMonths: s.minShelfMonths ?? 6, pickupAddress: s.pickupAddress ?? undefined,
      pickupHours: s.pickupHours ?? '', supportHours: s.supportHours ?? '', phone: s.phone ?? undefined, email: s.email ?? undefined,
      telegramUrl: s.telegramUrl, telegramHandle: s.telegramHandle ?? undefined, cashOnDelivery: !!s.cashOnDelivery,
    }} />
  )
}
