import type { CollectionConfig, GlobalConfig } from 'payload'

// Shared option lists (keys are stable; labels uz/ru).
export const SKIN = [
  { value: 'dry', label: { uz: 'Quruq', ru: 'Сухая' } },
  { value: 'oily', label: { uz: 'Yogʻli', ru: 'Жирная' } },
  { value: 'combo', label: { uz: 'Aralash', ru: 'Комбинированная' } },
  { value: 'sens', label: { uz: 'Sezgir', ru: 'Чувствительная' } },
  { value: 'normal', label: { uz: 'Normal', ru: 'Нормальная' } },
]
export const CONCERNS = [
  { value: 'acne', label: { uz: 'Toshma va qizarish', ru: 'Высыпания и покраснения' } },
  { value: 'pores', label: { uz: 'Kengaygan poralar', ru: 'Расширенные поры' } },
  { value: 'pigment', label: { uz: 'Pigment dogʻlar', ru: 'Пигментные пятна' } },
  { value: 'dryness', label: { uz: 'Quruqlik, tortishish', ru: 'Сухость, стянутость' } },
  { value: 'wrinkles', label: { uz: 'Birinchi ajinlar', ru: 'Первые морщины' } },
  { value: 'dull', label: { uz: 'Xira rang', ru: 'Тусклый цвет' } },
]
const NOT_FOR = [
  { value: 'pregnant', label: { uz: 'Homiladorlik', ru: 'Беременность' } },
  { value: 'teen', label: { uz: 'Oʻsmirlar', ru: 'Подростки' } },
]
const TAGS = [
  { value: 'hit', label: 'Hit' },
  { value: 'new', label: { uz: 'Yangi', ru: 'Новинка' } },
  { value: 'set', label: { uz: 'Toʻplam', ru: 'Набор' } },
]

const publicRead = { read: () => true }
const slug = { name: 'slug', type: 'text', required: true, unique: true, index: true } as const

export const Brands: CollectionConfig = {
  slug: 'brands',
  admin: { useAsTitle: 'name', group: 'Katalog' },
  access: publicRead,
  fields: [
    { name: 'name', type: 'text', required: true },
    slug,
    { name: 'about', type: 'textarea', localized: true },
    { name: 'featured', type: 'checkbox', defaultValue: false },
  ],
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { useAsTitle: 'title', group: 'Katalog' },
  access: publicRead,
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slug,
    { name: 'parent', type: 'relationship', relationTo: 'categories' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'order', type: 'number', defaultValue: 0 },
    { name: 'seoText', type: 'textarea', localized: true, admin: { description: '120–200 soʻz (SEO)' } },
  ],
}

export const Products: CollectionConfig = {
  slug: 'products',
  admin: { useAsTitle: 'name', group: 'Katalog', defaultColumns: ['name', 'brand', 'category', 'updatedAt'] },
  access: publicRead,
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Asl nomi (inglizcha)' } },
    slug,
    { name: 'brand', type: 'relationship', relationTo: 'brands', required: true },
    { name: 'category', type: 'relationship', relationTo: 'categories', required: true },
    { name: 'type', type: 'text', localized: true, admin: { description: 'Masalan: Serum, Toner, SPF' } },
    { name: 'need', type: 'text', localized: true, admin: { description: 'Bir qatorda: nima uchun (karta va tanlovchida)' } },
    { name: 'summary', type: 'textarea', localized: true },
    { name: 'description', type: 'richText', localized: true },
    { name: 'ingredients', type: 'richText', localized: true },
    { name: 'howTo', type: 'richText', localized: true },
    { name: 'skin', type: 'select', hasMany: true, options: SKIN },
    { name: 'concerns', type: 'select', hasMany: true, options: CONCERNS },
    { name: 'notFor', type: 'select', hasMany: true, options: NOT_FOR, admin: { description: 'Bu boʻlimlarda tavsiya qilinmaydi' } },
    { name: 'tags', type: 'select', hasMany: true, options: TAGS },
    { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
    {
      name: 'variants',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'volume', type: 'text' },
        { name: 'sku', type: 'text', required: true },
        { name: 'price', type: 'number', required: true, min: 0, admin: { description: 'soʻm' } },
        { name: 'stock', type: 'number', defaultValue: 0 },
      ],
    },
    {
      type: 'collapsible',
      label: 'Partiya va hujjatlar',
      fields: [
        { name: 'batch', type: 'text' },
        { name: 'expiresAt', type: 'date' },
        { name: 'certificate', type: 'upload', relationTo: 'media' },
      ],
    },
    { name: 'sample', type: 'checkbox', defaultValue: false, admin: { description: 'Namuna maʼlumot (ishga tushirishdan oldin almashtiring)' } },
  ],
  hooks: {
    // Old price must be a real past price (HANDOFF §5.3): every price change is logged.
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        const before = new Map<string, number>((previousDoc?.variants ?? []).map((v: any) => [v.sku, v.price]))
        for (const v of doc.variants ?? []) {
          if (before.get(v.sku) !== v.price) {
            await req.payload.create({ collection: 'price-history', data: { product: doc.id, sku: v.sku, price: v.price }, req })
          }
        }
      },
    ],
  },
}

export const PriceHistory: CollectionConfig = {
  slug: 'price-history',
  admin: { group: 'Katalog', defaultColumns: ['sku', 'price', 'createdAt'], description: 'Avtomatik: narx oʻzgarishlari. «Eski narx» shu yerdan (30 kun).' },
  access: { read: () => true, update: () => false },
  fields: [
    { name: 'product', type: 'relationship', relationTo: 'products', required: true, index: true },
    { name: 'sku', type: 'text', required: true, index: true },
    { name: 'price', type: 'number', required: true },
  ],
}

// Admin-managed shop values (design placeholders [N], [300 000] …). All marked as samples until the owner sets them.
export const Store: GlobalConfig = {
  slug: 'store',
  access: { read: () => true },
  admin: { group: 'Sozlamalar' },
  fields: [
    { name: 'freeDeliveryFrom', type: 'number', defaultValue: 300000, admin: { description: 'NAMUNA. Bepul yetkazish chegarasi, soʻm' } },
    { name: 'tashkentDays', type: 'number', defaultValue: 1, admin: { description: 'NAMUNA. Toshkent boʻylab, kun' } },
    { name: 'regionDays', type: 'text', defaultValue: '2–4', admin: { description: 'NAMUNA. Viloyatlarga, kun' } },
    { name: 'tashkentPrice', type: 'number', defaultValue: 25000, admin: { description: 'NAMUNA. Toshkent yetkazish narxi' } },
    { name: 'regionPrice', type: 'number', defaultValue: 35000, admin: { description: 'NAMUNA. Viloyat yetkazish narxi' } },
    { name: 'returnDays', type: 'number', defaultValue: 14, admin: { description: 'NAMUNA. Ochilmagan boʻlsa qaytarish, kun' } },
    { name: 'orderCutoff', type: 'text', defaultValue: '18:00', admin: { description: 'Shu vaqtgacha buyurtma — ertaga yetkaziladi' } },
    { name: 'telegramUrl', type: 'text', defaultValue: 'https://t.me/' },
    { name: 'telegramBotUrl', type: 'text', defaultValue: 'https://t.me/' },
    { name: 'phone', type: 'text' },
  ],
}
