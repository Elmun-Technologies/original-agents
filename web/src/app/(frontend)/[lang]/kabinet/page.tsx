// Account — design/screens/Account.jpg. Signed-in customers only (SMS login).
import { notFound, redirect } from 'next/navigation'

import { AccountPage } from '@/components/pages/Account'
import { getStore, homeCards, payload } from '@/lib/catalog'
import { currentCustomer } from '@/lib/customer'
import { href, isLang, t } from '@/lib/i18n'
import { loyaltyOf } from '@/lib/loyalty'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return isLang(lang) ? { title: `${t(lang, 'Kabinet')} — Yeppo`, robots: { index: false } } : {}
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const c = await currentCustomer()
  if (!c) redirect(`${href(lang, '/kirish')}?next=${encodeURIComponent(href(lang, '/kabinet'))}`)
  const p = await payload()
  const [orders, loyal, store, products] = await Promise.all([
    p.find({ collection: 'orders', where: { phone: { equals: c.phone } }, sort: '-createdAt', limit: 50, depth: 0, overrideAccess: true }),
    loyaltyOf(p, c.phone, lang), getStore(), homeCards(lang),
  ])
  return (
    <AccountPage lang={lang} products={products} d={{
      phone: c.phone, name: c.name ?? '', skin: c.skin ?? '', concerns: (c.concerns as string[] | null) ?? [],
      addresses: (c.addresses ?? []).map((a) => ({ city: a.city ?? '', address: a.address })), routine: ((c.routine as { pick?: Record<string, string> } | null)?.pick) ?? null,
      orders: orders.docs.map((o) => ({ number: o.number, token: o.token, date: o.createdAt, status: o.status, paid: o.paymentStatus === 'paid', total: o.total,
        items: o.items.map((i) => ({ sku: i.sku, slug: i.slug ?? '', brand: i.brand ?? '', name: i.name, img: i.img ?? '', price: i.price, qty: i.qty })) })),
      points: loyal.on ? { balance: loyal.balance, tier: loyal.tier?.name ?? null, percent: loyal.tier?.percent ?? 0 } : null,
      telegram: store.telegramBotUrl,
    }} />
  )
}
