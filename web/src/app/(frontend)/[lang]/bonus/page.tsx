// Loyalty — design/screens/Loyalty.jpg
import { notFound } from 'next/navigation'

import { LoyaltyPage } from '@/components/pages/Loyalty'
import { payload } from '@/lib/catalog'
import { sessionPhone } from '@/lib/customer'
import { isLang, t } from '@/lib/i18n'
import { loyaltyOf } from '@/lib/loyalty'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? { title: `${t(lang, 'Bonus dasturi')} — Yeppo`, alternates: { canonical: `/${lang}/bonus` } } : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const p = await payload()
  const [store, phone] = await Promise.all([p.findGlobal({ slug: 'store', locale: lang, depth: 0 }), sessionPhone()])
  const l = store.loyalty
  const me = phone ? await loyaltyOf(p, phone, lang) : null
  return <LoyaltyPage lang={lang} d={{
    tiers: (l?.tiers ?? []).map((x) => ({ name: x.name, percent: x.percent, from: x.from ?? 0, perks: (x.perks ?? []).map((y) => y.text) })).sort((a, b) => a.from - b.from),
    maxUsePct: l?.maxUsePct, creditDays: l?.creditDays, expireMonths: l?.expireMonths,
    me: me ? { spent: me.spent, tier: me.tier?.name ?? null, balance: me.balance } : null,
  }} />
}
