import 'server-only'

// All payment settings come from env (web/.env locally, Coolify on the server). Nothing here is secret by itself.
// PAYMENTS_MODE=mock (default until the merchant accounts exist): no real money, a test page "pays" by calling
// the same provider handlers with correctly signed requests. PAYMENTS_MODE=live: real Click / Payme.
export const paymentsMode = () => (process.env.PAYMENTS_MODE === 'live' ? 'live' : 'mock')

const MOCK_SECRET = 'mock-secret-not-for-production'
const need = (name: string) => {
  const v = process.env[name]
  if (v) return v
  if (paymentsMode() === 'mock') return MOCK_SECRET
  throw new Error(`${name} is not set`)
}

export const clickConfig = () => ({
  serviceId: process.env.CLICK_SERVICE_ID || '0',
  merchantId: process.env.CLICK_MERCHANT_ID || '0',
  secretKey: need('CLICK_SECRET_KEY'),
})

export const paymeConfig = () => ({
  merchantId: process.env.PAYME_MERCHANT_ID || 'mock-merchant',
  key: need('PAYME_KEY'),
  // test cabinet: https://checkout.test.paycom.uz — set PAYME_TEST=1 while testing with Payme's sandbox
  checkoutUrl: process.env.PAYME_TEST === '1' ? 'https://checkout.test.paycom.uz' : 'https://checkout.paycom.uz',
})

/** The site's public address — the one setting to change for the domain (yeppo.uz). */
export { siteUrl } from '@/lib/site'

/** Uzcard / Humo card payment goes through this provider's hosted page (both accept the cards). */
export const cardProvider = (): 'payme' | 'click' => (process.env.CARD_PROVIDER === 'click' ? 'click' : 'payme')
