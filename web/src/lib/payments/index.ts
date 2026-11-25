import 'server-only'

import type { Order } from '@/payload-types'
import { clickPayUrl, clickReturnUrl } from './click'
import { cardProvider, paymentsMode } from './config'
import { paymePayUrl } from './payme'

export const providerOf = async (method: Order['payment']): Promise<'click' | 'payme'> => (method === 'card' ? await cardProvider() : method)

/** Where the customer goes to pay. Mock mode: our test page (no money). Live: the provider's hosted page. */
export async function payUrl(o: Pick<Order, 'number' | 'token' | 'total' | 'payment' | 'lang'>) {
  const lang = o.lang ?? 'uz'
  const provider = await providerOf(o.payment)
  if ((await paymentsMode()) === 'mock') return `/${lang}/tolov/sinov?o=${o.number}&t=${o.token}&p=${provider}`
  const back = clickReturnUrl(lang, o.number, o.token)
  return provider === 'click' ? await clickPayUrl(o.number, o.total, back) : await paymePayUrl(o.number, o.total, back, lang)
}
