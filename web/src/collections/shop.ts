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
  ],
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
