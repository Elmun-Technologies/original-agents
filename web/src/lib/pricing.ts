// Cart pricing — the only place money is computed (server side). The browser sends SKUs and quantities only.
// Rules (design/source/p_spec.py "Savat", HANDOFF §5.3): promo codes do not stack — the most favourable single
// discount wins (promo or ready-routine −10%); old price = real price within 30 days (comes in as `old`).

export type Priced = { giftcard?: boolean; sku: string; slug: string; brand: string; name: string; img: string; volume?: string; price: number; old?: number; stock: number }
export type Promo = { note?: string | null; code: string; type: 'percent' | 'fixed'; value: number; minTotal?: number | null; firstOrderOnly?: boolean | null; active?: boolean | null; validTo?: string | null }
export type Delivery = 'tashkent' | 'region'
export type StoreRules = { freeDeliveryFrom: number; tashkentPrice: number; regionPrice: number; giftBoxPrice: number }

export type CartInput = {
  lines: { sku: string; qty: number }[]
  products: Map<string, Priced>
  promo?: Promo | null
  promoCode?: string
  isFirstOrder?: boolean // unknown before checkout -> treated as allowed, checked again when the order is created
  bundles?: string[][] // ready sets (home routine, segment sets): −10% when a whole set is in the cart
  delivery?: Delivery
  gift?: boolean
  store: StoreRules
  now?: Date
  /** signed-in customer's bonus points (1 point = 1 soʻm); spent only when asked and never together with a promo code */
  points?: { balance: number; maxPct: number }
  usePoints?: boolean
}

export type CartLine = Priced & { qty: number; line: number; lineOld: number; capped: boolean }
export type Quote = {
  lines: CartLine[]
  missing: string[] // SKUs no longer sold
  count: number
  subtotal: number // current prices
  oldTotal: number // what it would cost at the real 30-day old prices
  saleSaving: number // oldTotal - subtotal
  discount: number
  discountLabel?: string // 'SALOM10' | 'routine'
  discountNote?: string
  promoError?: 'not_found' | 'inactive' | 'expired' | 'min_total' | 'first_order'
  delivery: Delivery
  deliveryFee: number
  freeLeft: number // how much more for free delivery
  giftFee: number
  pointsAvailable: number // how many could be spent on this cart (0 = none / promo used)
  pointsUsed: number
  total: number
}

const round1000 = (n: number) => Math.round(n / 1000) * 1000

export function promoDiscount(promo: Promo, subtotal: number) {
  return Math.min(subtotal, promo.type === 'percent' ? round1000((subtotal * promo.value) / 100) : promo.value)
}

export function checkPromo(promo: Promo | null | undefined, subtotal: number, isFirstOrder: boolean, now: Date): Quote['promoError'] {
  if (!promo) return 'not_found'
  if (promo.active === false) return 'inactive'
  if (promo.validTo && new Date(promo.validTo) < now) return 'expired'
  if (promo.minTotal && subtotal < promo.minTotal) return 'min_total'
  if (promo.firstOrderOnly && !isFirstOrder) return 'first_order'
  return undefined
}

export function priceCart(i: CartInput): Quote {
  const missing: string[] = []
  const lines: CartLine[] = []
  for (const { sku, qty } of i.lines) {
    const p = i.products.get(sku)
    if (!p) { missing.push(sku); continue }
    const want = Math.max(1, Math.min(9, Math.floor(qty)))
    const q = p.stock > 0 ? Math.min(want, p.stock) : 0
    if (q === 0) { missing.push(sku); continue }
    const old = p.old && p.old > p.price ? p.old : undefined
    lines.push({ ...p, old, qty: q, line: p.price * q, lineOld: (old ?? p.price) * q, capped: q < want })
  }
  const subtotal = lines.reduce((a, l) => a + l.line, 0)
  const oldTotal = lines.reduce((a, l) => a + l.lineOld, 0)
  // gift certificates are never discounted (no buying a 300 000 card for 270 000)
  const discountable = lines.filter((l) => !l.giftcard).reduce((a, l) => a + l.line, 0)

  // candidates: promo code, ready-routine bundle — the bigger one wins
  let discount = 0
  let discountLabel: string | undefined
  let discountNote: string | undefined
  let promoError: Quote['promoError']
  if (i.promoCode) {
    promoError = checkPromo(i.promo, discountable, i.isFirstOrder ?? true, i.now ?? new Date())
    if (!promoError && i.promo) { discount = promoDiscount(i.promo, discountable); discountLabel = i.promo.code; discountNote = i.promo.note ?? undefined }
  }
  for (const set of i.bundles ?? []) {
    if (set.length < 2 || !set.every((s) => lines.some((l) => l.sku === s))) continue
    const bundle = round1000(set.reduce((a, s) => a + (lines.find((l) => l.sku === s)?.price ?? 0), 0) * 0.1)
    if (bundle > discount) { discount = bundle; discountLabel = 'routine'; discountNote = undefined }
  }

  const promoUsed = !!discountLabel && discountLabel !== 'routine'
  const pointsAvailable = i.points && !promoUsed ? Math.max(0, Math.min(i.points.balance, Math.floor(((discountable - discount) * i.points.maxPct) / 100))) : 0
  const pointsUsed = i.usePoints ? pointsAvailable : 0

  const delivery = i.delivery ?? 'tashkent'
  const afterDiscount = subtotal - discount
  const freeLeft = Math.max(0, i.store.freeDeliveryFrom - afterDiscount)
  // only certificates sent to Telegram -> nothing to deliver
  const digitalOnly = lines.length > 0 && lines.every((l) => l.giftcard && l.sku.endsWith('-TG'))
  const deliveryFee = lines.length === 0 || freeLeft === 0 || digitalOnly ? 0 : delivery === 'tashkent' ? i.store.tashkentPrice : i.store.regionPrice
  const giftFee = i.gift && lines.length ? i.store.giftBoxPrice : 0
  return {
    lines, missing, count: lines.reduce((a, l) => a + l.qty, 0), subtotal, oldTotal, saleSaving: oldTotal - subtotal,
    discount, discountLabel, discountNote, promoError, delivery, deliveryFee, freeLeft, giftFee, pointsAvailable, pointsUsed, total: afterDiscount - pointsUsed + deliveryFee + giftFee,
  }
}

/** "Rutinangizni toʻldiradi": at most ONE suggestion, priced ≤ 40% of the cart (p_spec.py). */
export function suggestion<T extends { sku: string; price: number; category: string; stock: number }>(
  cartCategories: string[], candidates: T[], subtotal: number,
): { item: T; reason: 'spf' | 'toner' } | null {
  const has = (c: string) => cartCategories.includes(c)
  const treat = has('serum') || has('essensiya') || has('toner')
  const reason = treat && !has('spf') ? 'spf' : (has('serum') || has('essensiya')) && !has('toner') ? 'toner' : null
  if (!reason) return null
  const item = candidates
    .filter((c) => c.category === reason && c.stock > 0 && c.price <= subtotal * 0.4)
    .sort((a, b) => a.price - b.price)[0]
  return item ? { item, reason } : null
}

/** +998 XX XXX XX XX -> "998XXXXXXXXX" or null. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  const n = d.length === 9 ? `998${d}` : d
  return /^998\d{9}$/.test(n) ? n : null
}
