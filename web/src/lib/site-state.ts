import 'server-only'

import { payload } from '@/lib/catalog'
import { resolveSite, type SiteResolved } from './site-state-def'

// The site's open/closed state and whether it takes orders (admin → Sayt holati), with the server environment as
// the fallback. Cached for a few seconds: every page asks.
export type SiteState = SiteResolved & { ordersOffText: { uz: string; ru: string } }

let cache: { at: number; v: SiteState } | null = null
const TTL = 5_000
export const invalidateSiteState = () => { cache = null }

export async function siteState(fresh = false): Promise<SiteState> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.v
  let mode: unknown, orders: unknown
  const text = { uz: '', ru: '' }
  try {
    const p = await payload()
    const uz = (await p.findGlobal({ slug: 'site-state', depth: 0, locale: 'uz', overrideAccess: true })) as unknown as Record<string, unknown>
    mode = uz.mode; orders = uz.ordersEnabled; text.uz = String(uz.ordersOffText ?? '')
    const ru = (await p.findGlobal({ slug: 'site-state', depth: 0, locale: 'ru', fallbackLocale: false, overrideAccess: true })) as unknown as Record<string, unknown>
    text.ru = String(ru.ordersOffText ?? '')
  } catch (e) {
    // build time or the table is not there yet: the server environment decides
    console.warn('site-state: using environment only —', (e as Error).message.split('\n')[0])
  }
  const v: SiteState = { ...resolveSite(mode, orders, process.env), ordersOffText: text }
  cache = { at: Date.now(), v }
  return v
}

/** hidden from search engines (closed test site or noindex) */
export const isSiteClosed = async () => (await siteState()).noindex

export const ORDERS_OFF_DEFAULT = {
  uz: 'Buyurtma qabul qilish vaqtincha toʻxtatilgan. Tez orada qayta ochamiz.',
  ru: 'Приём заказов временно приостановлен. Скоро откроемся снова.',
}
