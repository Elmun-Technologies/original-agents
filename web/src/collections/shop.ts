import type { CollectionConfig } from 'payload'

// Orders, payment transactions, promo codes. Personal data (name, phone, address) is admin-only:
// no public read; the order page reads one order server-side by number + secret token.
const adminOnly = { read: ({ req }: { req: { user?: unknown } }) => !!req.user }

export const ORDER_STATUS = [
  { value: 'new', label: 'Yangi (toʻlov kutilmoqda)' },
  { value: 'accepted', label: 'Qabul qilindi' },
  { value: 'assembling', label: 'Yigʻilmoqda' },
  { value: 'shipping', label: 'Yoʻlda' },
  { value: 'delivered', label: 'Yetkazildi' },
  { value: 'cancelled', label: 'Bekor qilindi' },
]

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: { useAsTitle: 'number', group: 'Savdo', defaultColumns: ['number', 'status', 'paymentStatus', 'total', 'createdAt'] },
  access: { ...adminOnly, create: () => false }, // created only by the server (lib/orders.ts)
  fields: [
    { name: 'number', type: 'text', required: true, unique: true, index: true },
    { name: 'token', type: 'text', required: true, admin: { hidden: true } },
    { name: 'lang', type: 'select', options: ['uz', 'ru'], defaultValue: 'uz' },
    { name: 'status', type: 'select', options: ORDER_STATUS, defaultValue: 'new', required: true, index: true },
    { name: 'paymentStatus', type: 'select', defaultValue: 'pending', required: true, index: true,
      options: [{ value: 'pending', label: 'Kutilmoqda' }, { value: 'paid', label: 'Toʻlandi' }, { value: 'cancelled', label: 'Bekor' }, { value: 'refund', label: 'Qaytarish kerak' }] },
    { name: 'payment', type: 'select', required: true, options: [{ value: 'click', label: 'Click' }, { value: 'payme', label: 'Payme' }, { value: 'card', label: 'Uzcard / Humo' }] },
    { name: 'paidAt', type: 'date' },
    {
      type: 'collapsible', label: 'Mijoz (shaxsiy maʼlumot)',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'phone', type: 'text', required: true, index: true },
        { name: 'telegramUpdates', type: 'checkbox', defaultValue: true },
      ],
    },
    {
      type: 'collapsible', label: 'Yetkazish',
      fields: [
        { name: 'delivery', type: 'select', required: true, options: [{ value: 'tashkent', label: 'Kuryer, Toshkent' }, { value: 'region', label: 'Viloyatlarga' }] },
        { name: 'city', type: 'text' },
        { name: 'address', type: 'text', required: true },
        { name: 'slot', type: 'text' },
        { name: 'comment', type: 'textarea' },
        { name: 'gift', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'items', type: 'array', required: true,
      fields: [
        { name: 'sku', type: 'text', required: true }, { name: 'slug', type: 'text' }, { name: 'brand', type: 'text' },
        { name: 'name', type: 'text', required: true }, { name: 'volume', type: 'text' }, { name: 'img', type: 'text' },
        { name: 'price', type: 'number', required: true }, { name: 'qty', type: 'number', required: true },
      ],
    },
    { name: 'subtotal', type: 'number', required: true },
    { name: 'discount', type: 'number', defaultValue: 0 },
    { name: 'discountLabel', type: 'text' },
    { name: 'deliveryFee', type: 'number', defaultValue: 0 },
    { name: 'giftFee', type: 'number', defaultValue: 0 },
    { name: 'total', type: 'number', required: true },
    { name: 'pointsUsed', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'pointsEarned', type: 'number', admin: { readOnly: true, description: 'Yetkazilganda hisoblanadi' } },
  ],
  hooks: {
    // bonus points are credited once, when a paid order becomes "delivered"
    beforeChange: [async ({ data, originalDoc, req, operation }) => {
      if (operation !== 'update' || data.status !== 'delivered' || originalDoc?.status === 'delivered' || originalDoc?.pointsEarned != null) return data
      if ((data.paymentStatus ?? originalDoc?.paymentStatus) !== 'paid') return data
      const { earnedFor } = await import('@/lib/loyalty')
      data.pointsEarned = await earnedFor(req.payload, { ...originalDoc, ...data })
      return data
    }],
  },
}

// One row per provider transaction (Click click_trans_id / Payme transaction id). Idempotency + Payme states.
export const Payments: CollectionConfig = {
  slug: 'payments',
  admin: { group: 'Savdo', defaultColumns: ['provider', 'providerId', 'order', 'state', 'amount', 'createdAt'] },
  access: { ...adminOnly, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'provider', type: 'select', required: true, options: ['click', 'payme'] },
    { name: 'providerId', type: 'text', required: true, unique: true, index: true },
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true },
    { name: 'amount', type: 'number', required: true, admin: { description: 'Click: soʻm, Payme: tiyin' } },
    { name: 'state', type: 'number', required: true, admin: { description: 'Payme: 1 yaratildi, 2 toʻlandi, -1/-2 bekor. Click: 0 prepare, 1 complete, -1 bekor' } },
    { name: 'createTime', type: 'number' },
    { name: 'performTime', type: 'number' },
    { name: 'cancelTime', type: 'number' },
    { name: 'reason', type: 'number' },
  ],
}

export const PromoCodes: CollectionConfig = {
  slug: 'promo-codes',
  admin: { useAsTitle: 'code', group: 'Savdo' },
  access: adminOnly,
  fields: [
    { name: 'code', type: 'text', required: true, unique: true, admin: { description: 'KATTA harflarda, masalan SALOM10' } },
    { name: 'type', type: 'select', required: true, defaultValue: 'percent', options: [{ value: 'percent', label: 'Foiz' }, { value: 'fixed', label: 'Summa (soʻm)' }] },
    { name: 'value', type: 'number', required: true },
    { name: 'note', type: 'text', localized: true, admin: { description: 'Savatda koʻrinadi: «birinchi buyurtmaga −10%»' } },
    { name: 'minTotal', type: 'number' },
    { name: 'firstOrderOnly', type: 'checkbox', defaultValue: false },
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'validTo', type: 'date' },
  ],
}

// "Kim uchun" pages (HANDOFF §8 Segment): who, hero text, a ready set (−10% when complete in the cart), grid, cautions, FAQ.
export const Segments: CollectionConfig = {
  slug: 'segments',
  admin: { useAsTitle: 'title', group: 'Sayt', defaultColumns: ['title', 'slug', 'order'] },
  access: { read: () => true },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'order', type: 'number', defaultValue: 0 },
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'tag', type: 'text', localized: true },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'imagePos', type: 'text', defaultValue: '50% 30%' },
    { name: 'h1', type: 'text', required: true, localized: true },
    { name: 'say', type: 'textarea', localized: true },
    { name: 'setName', type: 'text', localized: true },
    { name: 'setWhy', type: 'textarea', localized: true },
    { name: 'set', type: 'array', fields: [
      { name: 'step', type: 'text', localized: true }, { name: 'product', type: 'relationship', relationTo: 'products', required: true }, { name: 'why', type: 'text', localized: true }] },
    { name: 'gridTitle', type: 'text', localized: true },
    { name: 'grid', type: 'relationship', relationTo: 'products', hasMany: true },
    { name: 'exclude', type: 'select', hasMany: true, options: [{ value: 'pregnant', label: 'Homiladorlik' }, { value: 'teen', label: 'Oʻsmirlar' }],
      admin: { description: 'Shu belgili mahsulotlar bu sahifada umuman chiqmaydi (retinol, kuchli aktivlar)' } },
    { name: 'avoid', type: 'array', fields: [{ name: 'text', type: 'text', required: true, localized: true }] },
    { name: 'faq', type: 'array', fields: [{ name: 'q', type: 'text', required: true, localized: true }, { name: 'a', type: 'textarea', required: true, localized: true }] },
  ],
}

// Search log (p_spec.py): every query counted; "missed" = no real match (closest shown) — reviewed weekly
// to add synonyms or products. Popular found queries feed "Boshqalar hozir qidirmoqda".
export const SearchLog: CollectionConfig = {
  slug: 'search-log',
  admin: { useAsTitle: 'query', group: 'Sayt', defaultColumns: ['query', 'count', 'missed', 'updatedAt'], description: 'Qidiruv soʻrovlari. «missed» — mos mahsulot topilmagan.' },
  access: { read: ({ req }) => !!req.user, create: () => false },
  fields: [
    { name: 'query', type: 'text', required: true, unique: true, index: true },
    { name: 'count', type: 'number', defaultValue: 0 },
    { name: 'missed', type: 'checkbox', defaultValue: false, index: true },
  ],
}

// Legal and info pages (Ommaviy oferta, Maxfiylik …). Text comes from the owner/lawyer — not written by the site.
export const LegalPages: CollectionConfig = {
  slug: 'legal-pages',
  admin: { useAsTitle: 'title', group: 'Sayt' },
  access: { read: () => true },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, admin: { description: 'oferta, maxfiylik' } },
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'body', type: 'richText', localized: true },
  ],
}

export const ARTICLE_CATS = [
  { value: 'teri-turi', label: 'Teri turi' }, { value: 'tarkiblar', label: 'Tarkiblar' }, { value: 'rutina', label: 'Rutina' },
  { value: 'spf', label: 'SPF' }, { value: 'erkaklar', label: 'Erkaklar' }, { value: 'originallik', label: 'Originallik' },
]

// Journal (HANDOFF §8 Article): "answer first" — shortAnswer on top, then body, steps with products, ingredients, FAQ.
export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: { useAsTitle: 'title', group: 'Sayt', defaultColumns: ['title', 'category', 'publishedAt'] },
  access: { read: () => true },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'accent', type: 'text', localized: true, admin: { description: 'Sarlavhadagi kursiv qism (sarlavha ichidagi aynan shu soʻzlar)' } },
    { name: 'category', type: 'select', required: true, options: ARTICLE_CATS },
    { name: 'tag', type: 'text', localized: true, admin: { description: 'Maqola tepasidagi teg, masalan «Yogʻli teri»' } },
    { name: 'excerpt', type: 'textarea', localized: true },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'coverPos', type: 'text', defaultValue: '50% 50%' },
    { name: 'minutes', type: 'number', defaultValue: 4 },
    { name: 'featured', type: 'checkbox', defaultValue: false },
    { name: 'author', type: 'text', localized: true, admin: { description: 'Boʻsh boʻlsa — koʻrsatilmaydi' } },
    { name: 'reviewedBy', type: 'text', localized: true, admin: { description: 'Tekshirgan dermatolog (boʻsh boʻlsa — koʻrsatilmaydi)' } },
    { name: 'publishedAt', type: 'date' },
    { name: 'shortAnswer', type: 'textarea', localized: true },
    { name: 'sections', type: 'array', fields: [{ name: 'h', type: 'text', required: true, localized: true }, { name: 'text', type: 'textarea', localized: true, admin: { description: 'Paragraflar boʻsh qator bilan ajratiladi' } }] },
    { name: 'steps', type: 'array', fields: [{ name: 't', type: 'text', localized: true }, { name: 'd', type: 'text', localized: true }, { name: 'product', type: 'relationship', relationTo: 'products' }] },
    { name: 'ingredients', type: 'array', fields: [{ name: 'name', type: 'text', localized: true }, { name: 'd', type: 'text', localized: true }] },
    { name: 'faq', type: 'array', fields: [{ name: 'q', type: 'text', required: true, localized: true }, { name: 'a', type: 'textarea', required: true, localized: true }] },
  ],
}

export const Ingredients: CollectionConfig = {
  slug: 'ingredients',
  admin: { useAsTitle: 'name', group: 'Sayt' },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    { name: 'order', type: 'number', defaultValue: 0 },
    { name: 'does', type: 'text', localized: true }, { name: 'who', type: 'text', localized: true }, { name: 'care', type: 'text', localized: true },
  ],
}

// Gift certificates: issued when an order with a certificate is paid; redeemed in the promo field (balance).
export const GiftCards: CollectionConfig = {
  slug: 'gift-cards',
  admin: { useAsTitle: 'code', group: 'Savdo', defaultColumns: ['code', 'amount', 'balance', 'orderNumber', 'active'] },
  access: { read: ({ req }) => !!req.user, create: () => false },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true, index: true },
    { name: 'amount', type: 'number', required: true },
    { name: 'balance', type: 'number', required: true },
    { name: 'orderNumber', type: 'text', index: true, admin: { description: 'Sotib olingan buyurtma' } },
    { name: 'form', type: 'select', options: [{ value: 'tg', label: 'Telegramga' }, { value: 'card', label: 'Kartochkada' }] },
    { name: 'validTo', type: 'date', admin: { description: '12 oy' } },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}

// Customers: created on first SMS login. Personal data — admin-only, never public.
export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: { useAsTitle: 'phone', group: 'Savdo', defaultColumns: ['phone', 'name', 'createdAt'] },
  access: { read: ({ req }) => !!req.user, create: () => false },
  fields: [
    { name: 'phone', type: 'text', required: true, unique: true, index: true },
    { name: 'name', type: 'text' },
    { name: 'skin', type: 'text', admin: { description: 'Teri turi (dry/oily/combo/sens/normal)' } },
    { name: 'concerns', type: 'json' },
    { name: 'addresses', type: 'array', fields: [{ name: 'city', type: 'text' }, { name: 'address', type: 'text', required: true }] },
    { name: 'routine', type: 'json', admin: { description: 'Saqlangan rutina (konstruktordan)' } },
  ],
}

// One-time SMS codes (hashed). Hidden from the admin menu.
export const LoginCodes: CollectionConfig = {
  slug: 'login-codes',
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'phone', type: 'text', required: true, index: true },
    { name: 'hash', type: 'text', required: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'tries', type: 'number', defaultValue: 0 },
  ],
}
