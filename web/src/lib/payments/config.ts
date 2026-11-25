import 'server-only'

import { integrations } from '@/lib/integrations'

// Payment settings come from the admin panel (Integratsiyalar), else from the server environment (lib/integrations.ts).
// Mode "mock" (default): no real money, a test page "pays" by calling the same provider handlers with correctly
// signed requests. Mode "live": real Click / Payme. "live" cannot be saved without complete keys (integrations-def.ts).
export const paymentsMode = async (): Promise<'mock' | 'live'> => ((await integrations()).paymentsMode === 'live' ? 'live' : 'mock')

const MOCK_SECRET = 'mock-secret-not-for-production'
const need = (value: unknown, name: string, live: boolean) => {
  if (typeof value === 'string' && value) return value
  if (!live) return MOCK_SECRET
  throw new Error(`${name} is not set`)
}

export async function clickConfig() {
  const v = await integrations()
  const live = v.paymentsMode === 'live'
  return {
    serviceId: (v.clickServiceId as string) || '0',
    merchantId: (v.clickMerchantId as string) || '0',
    secretKey: need(v.clickSecret, 'Click secret key', live),
  }
}

export async function paymeConfig() {
  const v = await integrations()
  return {
    merchantId: (v.paymeMerchantId as string) || 'mock-merchant',
    key: need(v.paymeKey, 'Payme key', v.paymentsMode === 'live'),
    // test cabinet: https://checkout.test.paycom.uz (the "Payme sinov kassasi" box in Integratsiyalar)
    checkoutUrl: v.paymeTest === true ? 'https://checkout.test.paycom.uz' : 'https://checkout.paycom.uz',
  }
}

/** The site's public address — the one setting to change for the domain (yeppo.uz). */
export { siteUrl } from '@/lib/site'

/** Uzcard / Humo card payment goes through this provider's hosted page (both accept the cards). */
export const cardProvider = async (): Promise<'payme' | 'click'> => ((await integrations()).cardProvider === 'click' ? 'click' : 'payme')
