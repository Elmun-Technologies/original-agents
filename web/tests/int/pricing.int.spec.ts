import { describe, expect, it } from 'vitest'

import { normalizePhone, priceCart, suggestion, type Priced, type Promo } from '@/lib/pricing'

const P = (sku: string, price: number, o: Partial<Priced> = {}): [string, Priced] =>
  [sku, { sku, slug: sku, brand: 'B', name: sku, img: '', price, stock: 10, ...o }]
const products = new Map([P('amp', 245000, { old: 289000 }), P('revive', 219000), P('toner', 229000), P('spf', 149000, { old: 169000 }), P('gone', 99000, { stock: 0 }), P('two', 50000, { stock: 2 })])
const store = { freeDeliveryFrom: 300000, tashkentPrice: 25000, regionPrice: 35000, giftBoxPrice: 15000 }
const SALOM10: Promo = { code: 'SALOM10', type: 'percent', value: 10, firstOrderOnly: true }
const base = { products, store, now: new Date('2026-11-15') }

describe('cart pricing', () => {
  it('design example: amp + revive with SALOM10 = 418 000, free delivery', () => {
    const q = priceCart({ ...base, lines: [{ sku: 'amp', qty: 1 }, { sku: 'revive', qty: 1 }], promo: SALOM10, promoCode: 'SALOM10' })
    expect(q.subtotal).toBe(464000)
    expect(q.oldTotal).toBe(508000)
    expect(q.saleSaving).toBe(44000)
    expect(q.discount).toBe(46000)
    expect(q.deliveryFee).toBe(0)
    expect(q.total).toBe(418000)
  })
  it('delivery fee below the free threshold, region price for regions', () => {
    const one = { ...base, lines: [{ sku: 'spf', qty: 1 }] }
    expect(priceCart(one)).toMatchObject({ deliveryFee: 25000, freeLeft: 151000, total: 174000 })
    expect(priceCart({ ...one, delivery: 'region' }).deliveryFee).toBe(35000)
  })
  it('free delivery is judged after the discount', () => {
    const q = priceCart({ ...base, lines: [{ sku: 'toner', qty: 1 }, { sku: 'two', qty: 2 }], promo: { code: 'X', type: 'fixed', value: 30000 }, promoCode: 'X' })
    expect(q.subtotal).toBe(329000)
    expect(q.freeLeft).toBe(1000)
    expect(q.deliveryFee).toBe(25000)
  })
  it('gift box adds its price', () => expect(priceCart({ ...base, lines: [{ sku: 'amp', qty: 2 }], gift: true }).total).toBe(490000 + 15000))
  it('sold out and unknown SKUs are reported, quantities capped by stock and 1..9', () => {
    const q = priceCart({ ...base, lines: [{ sku: 'gone', qty: 1 }, { sku: 'nope', qty: 1 }, { sku: 'two', qty: 5 }, { sku: 'amp', qty: 99 }] })
    expect(q.missing).toEqual(['gone', 'nope'])
    expect(q.lines.find((l) => l.sku === 'two')).toMatchObject({ qty: 2, capped: true })
    expect(q.lines.find((l) => l.sku === 'amp')?.qty).toBe(9)
  })
  it('promo errors', () => {
    const lines = [{ sku: 'spf', qty: 1 }]
    expect(priceCart({ ...base, lines, promoCode: 'NOPE', promo: null }).promoError).toBe('not_found')
    expect(priceCart({ ...base, lines, promoCode: 'SALOM10', promo: SALOM10, isFirstOrder: false })).toMatchObject({ promoError: 'first_order', discount: 0 })
    expect(priceCart({ ...base, lines, promoCode: 'X', promo: { ...SALOM10, validTo: '2026-01-01' } }).promoError).toBe('expired')
    expect(priceCart({ ...base, lines, promoCode: 'X', promo: { ...SALOM10, minTotal: 500000 } }).promoError).toBe('min_total')
  })
  it('promo and routine bundle do not stack: the bigger one wins', () => {
    const lines = [{ sku: 'toner', qty: 1 }, { sku: 'amp', qty: 1 }, { sku: 'spf', qty: 1 }]
    const bundleOnly = priceCart({ ...base, lines, bundles: [['toner', 'amp', 'spf']] })
    expect(bundleOnly).toMatchObject({ discount: 62000, discountLabel: 'routine', total: 561000 }) // design: 561 000, −62 000
    const fixed = priceCart({ ...base, lines, bundles: [['toner', 'amp', 'spf']], promo: { code: 'BIG', type: 'fixed', value: 100000 }, promoCode: 'BIG' })
    expect(fixed).toMatchObject({ discount: 100000, discountLabel: 'BIG' })
  })
  it('several sets: the biggest complete one counts, incomplete ones do not', () => {
    const lines = [{ sku: 'amp', qty: 1 }, { sku: 'revive', qty: 1 }]
    expect(priceCart({ ...base, lines, bundles: [['amp', 'revive'], ['amp', 'revive', 'toner']] })).toMatchObject({ discount: 46000, discountLabel: 'routine' })
    expect(priceCart({ ...base, lines, bundles: [['amp', 'toner']] }).discount).toBe(0)
  })
  it('gift certificates: no discount on them, Telegram-only needs no delivery', () => {
    const products2 = new Map([...products, ['GC-300000-TG', { sku: 'GC-300000-TG', slug: 'gc', brand: 'Yeppo', name: 'Sertifikat', img: '', price: 300000, stock: 999, giftcard: true }]])
    const q = priceCart({ ...base, products: products2, lines: [{ sku: 'GC-300000-TG', qty: 1 }], promo: SALOM10, promoCode: 'SALOM10' })
    expect(q).toMatchObject({ discount: 0, deliveryFee: 0, total: 300000 })
    const mixed = priceCart({ ...base, products: products2, lines: [{ sku: 'GC-300000-TG', qty: 1 }, { sku: 'spf', qty: 1 }], promo: SALOM10, promoCode: 'SALOM10' })
    expect(mixed.discount).toBe(15000) // 10% of the SPF only
  })
  it('bonus points: capped by balance and max %, only when asked, never with a promo code', () => {
    const lines = [{ sku: 'amp', qty: 1 }, { sku: 'revive', qty: 1 }] // 464 000
    const points = { balance: 500000, maxPct: 20 }
    expect(priceCart({ ...base, lines, points })).toMatchObject({ pointsAvailable: 92800, pointsUsed: 0, total: 464000 })
    expect(priceCart({ ...base, lines, points, usePoints: true })).toMatchObject({ pointsUsed: 92800, total: 371200 })
    expect(priceCart({ ...base, lines, points: { balance: 5000, maxPct: 20 }, usePoints: true }).pointsUsed).toBe(5000)
    expect(priceCart({ ...base, lines, points, usePoints: true, promo: SALOM10, promoCode: 'SALOM10' })).toMatchObject({ pointsAvailable: 0, pointsUsed: 0, total: 418000 })
  })
  it('empty cart costs nothing', () => expect(priceCart({ ...base, lines: [] })).toMatchObject({ total: 0, deliveryFee: 0 }))
})

describe('suggestion', () => {
  const C = [{ sku: 'spf', price: 149000, category: 'spf', stock: 3 }, { sku: 'spf2', price: 99000, category: 'spf', stock: 0 }, { sku: 'toner', price: 229000, category: 'toner', stock: 3 }]
  it('serum without SPF -> one SPF within 40%', () => expect(suggestion(['serum'], C, 464000)?.item.sku).toBe('spf'))
  it('too expensive for the cart -> nothing', () => expect(suggestion(['serum'], C, 300000)).toBeNull())
  it('routine complete -> nothing', () => expect(suggestion(['serum', 'spf', 'toner'], C, 600000)).toBeNull())
})

describe('phone', () => {
  it.each([['+998 90 123 45 67', '998901234567'], ['90 123-45-67', '998901234567'], ['12345', null], ['+7 900 123 45 67', null]])('%s', (raw, want) =>
    expect(normalizePhone(raw)).toBe(want))
})
