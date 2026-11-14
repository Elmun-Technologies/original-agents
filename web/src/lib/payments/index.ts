import 'server-only'

import type { Order } from '@/payload-types'
import { clickPayUrl, clickReturnUrl } from './click'
import { cardProvider, paymentsMode } from './config'
import { paymePayUrl } from './payme'

export const providerOf = (method: Order['payment']): 'click' | 'payme' => (method === 'card' ? cardProvider() : method)

/** Where the customer goes to pay. Mock mode: our test page (no money). Live: the provider's hosted page. */
export function payUrl(o: Pick<Order, 'number' | 'token' | 'total' | 'payment' | 'lang'>) {
  const lang = o.lang ?? 'uz'
  const provider = providerOf(o.payment)
  if (paymentsMode() === 'mock') return `/${lang}/tolov/sinov?o=${o.number}&t=${o.token}&p=${provider}`
  const back = clickReturnUrl(lang, o.number, o.token)
  return provider === 'click' ? clickPayUrl(o.number, o.total, back) : paymePayUrl(o.number, o.total, back, lang)
}
