import type { CollectionConfig, GlobalConfig } from 'payload'

import { costField } from './finance'

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
    { name: 'tagline', type: 'text', localized: true, admin: { description: 'Katta kartochka: «Sezgir teri uchun centella»' } },
    { name: 'short', type: 'text', localized: true, admin: { description: 'A–Z roʻyxat: «Madagaskar centellasi»' } },
    { name: 'about', type: 'textarea', localized: true },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { description: 'Brendlar sahifasining yuqorisida (4 ta)' } },
    { name: 'country', type: 'text', localized: true, defaultValue: 'Janubiy Koreya' },
    {
      name: 'lines', type: 'array', admin: { description: '«Qaysi liniya sizga?» — kalit soʻz mahsulot nomida qidiriladi' },
      fields: [
        { name: 'name', type: 'text', required: true, localized: true },
        { name: 'keyword', type: 'text', required: true, admin: { description: 'Masalan: Hyalu-Cica' } },
        { name: 'color', type: 'text', defaultValue: '#E2DAD2' },
        { name: 'note', type: 'text', localized: true },
        { name: 'who', type: 'text', localized: true },
      ],
    },
    { name: 'faq', type: 'array', fields: [{ name: 'q', type: 'text', required: true, localized: true }, { name: 'a', type: 'textarea', required: true, localized: true }] },
    { name: 'order', type: 'number', defaultValue: 0 },
  ],
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { useAsTitle: 'title', group: 'Katalog' },
  access: publicRead,
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'short', type: 'text', localized: true, admin: { description: 'Qisqa nom (katalogdagi tugmalar): Tonerlar, SPF …' } },
    slug,
    { name: 'parent', type: 'relationship', relationTo: 'categories' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'order', type: 'number', defaultValue: 0 },
    { name: 'seoTitle', type: 'text', localized: true, admin: { description: 'SEO blok sarlavhasi (katalog pastida)' } },
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
        costField('Bir donasi sizga necha soʻmga tushadi (xarid + kargo + bojxona). Faqat admin koʻradi; moliya hisobotida foyda shundan hisoblanadi.'),
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
    {
      type: 'collapsible', label: 'SEO (Google va Yandex qidiruvi uchun)', admin: { initCollapsed: true, description: 'Boʻsh qoldirsangiz, sayt sarlavha va tavsifni mahsulot maʼlumotidan oʻzi yaratadi. Qidiruvda yaxshiroq koʻrinishi uchun oʻzingiz yozing.' },
      fields: [
        { name: 'seoTitle', type: 'text', localized: true, maxLength: 70, admin: { description: 'Qidiruvdagi sarlavha. 50–60 belgi yaxshi. Oxiriga « — Yeppo» avtomatik qoʻshiladi.' } },
        { name: 'seoDescription', type: 'textarea', localized: true, maxLength: 200, admin: { description: 'Sarlavha ostidagi matn. 120–160 belgi: nima uchun, kimga, narx yoki afzallik.' } },
      ],
    },
    { name: 'expertNote', type: 'textarea', localized: true, admin: { description: '«Maslahatchi aytadi» (mahsulot sahifasi)' } },
    {
      name: 'fit', type: 'array', admin: { description: '«Teringizga mosmi?» — har teri turi uchun javob' },
      fields: [
        { name: 'skin', type: 'select', required: true, options: SKIN },
        { name: 'ok', type: 'checkbox', defaultValue: true, admin: { description: 'Belgilanmasa — ehtiyot belgisi (!)' } },
        { name: 'note', type: 'text', required: true, localized: true },
      ],
    },
    {
      name: 'faq', type: 'array', admin: { description: 'Savol-javob (doʻkon javobi)' },
      fields: [
        { name: 'q', type: 'text', required: true, localized: true },
        { name: 'a', type: 'textarea', required: true, localized: true },
      ],
    },
    { name: 'pairsWith', type: 'relationship', relationTo: 'products', hasMany: true, admin: { description: '«Koʻpincha birga olinadi» (boʻsh boʻlsa — rutina qoidasi)' } },
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

// Reviews only from verified purchases (HANDOFF §6): shown when linked to an order and approved by the admin.
export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: { useAsTitle: 'name', group: 'Katalog', defaultColumns: ['product', 'rating', 'approved', 'createdAt'] },
  access: { read: ({ req }) => (req.user ? true : { approved: { equals: true } }) },
  fields: [
    { name: 'product', type: 'relationship', relationTo: 'products', required: true, index: true },
    { name: 'order', type: 'text', required: true, admin: { description: 'Buyurtma raqami — tasdiqlangan xarid' } },
    { name: 'name', type: 'text', required: true },
    { name: 'skin', type: 'select', options: SKIN },
    { name: 'rating', type: 'number', required: true, min: 1, max: 5 },
    { name: 'text', type: 'textarea', required: true },
    { name: 'helpful', type: 'number', defaultValue: 0 },
    { name: 'approved', type: 'checkbox', defaultValue: false, index: true },
  ],
}

// Home slides and the weekly sale block (HANDOFF §8 Banner). The sale timer counts down to endsAt.
export const Banners: CollectionConfig = {
  slug: 'banners',
  admin: { useAsTitle: 'title', group: 'Sayt', defaultColumns: ['title', 'kind', 'active', 'order'] },
  access: publicRead,
  fields: [
    { name: 'kind', type: 'select', required: true, defaultValue: 'slide', options: [
      { value: 'slide', label: 'Bosh sahifa slaydi' }, { value: 'sale', label: 'Aksiya bloki (taymer)' }] },
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'order', type: 'number', defaultValue: 0 },
    { name: 'tag', type: 'text', localized: true },
    { name: 'tagStyle', type: 'select', defaultValue: 'tag-sale', options: ['tag-sale', 'tag-hit', 'tag-new'] },
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'accent', type: 'text', localized: true, admin: { description: 'Sarlavhadagi kursiv soʻz (aksiya bloki)' } },
    { name: 'text', type: 'textarea', localized: true },
    { name: 'cta', type: 'text', localized: true },
    { name: 'tagShort', type: 'text', localized: true, admin: { description: 'Telefon uchun qisqa teg' } },
    { name: 'titleShort', type: 'text', localized: true, admin: { description: 'Telefon uchun qisqa sarlavha' } },
    { name: 'ctaShort', type: 'text', localized: true, admin: { description: 'Telefon uchun qisqa havola matni' } },
    { name: 'link', type: 'text', admin: { description: 'Masalan: /katalog/serum yoki /aksiyalar' } },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'imagePos', type: 'text', defaultValue: '50% 50%' },
    { name: 'bg', type: 'text', defaultValue: '#F2D6D0' },
    { name: 'endsAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Aksiya tugash vaqti (taymer)' } },
  ],
}

// Admin-managed shop values (design placeholders [N], [300 000] …). All marked as samples until the owner sets them.
export const Store: GlobalConfig = {
  slug: 'store',
  access: { read: () => true },
  admin: { group: 'Sozlamalar' },
  fields: [
    { name: 'freeDeliveryFrom', type: 'number', required: true, defaultValue: 300000, admin: { description: 'NAMUNA. Bepul yetkazish chegarasi, soʻm' } },
    { name: 'tashkentDays', type: 'number', required: true, defaultValue: 1, admin: { description: 'NAMUNA. Toshkent boʻylab, kun' } },
    { name: 'regionDays', type: 'text', required: true, defaultValue: '2–4', admin: { description: 'NAMUNA. Viloyatlarga, kun' } },
    { name: 'tashkentPrice', type: 'number', required: true, defaultValue: 25000, admin: { description: 'NAMUNA. Toshkent yetkazish narxi' } },
    { name: 'regionPrice', type: 'number', required: true, defaultValue: 35000, admin: { description: 'NAMUNA. Viloyat yetkazish narxi' } },
    { name: 'giftBoxPrice', type: 'number', required: true, defaultValue: 15000, admin: { description: 'NAMUNA. Sovgʻa qutisi narxi, soʻm' } },
    { name: 'returnDays', type: 'number', required: true, defaultValue: 14, admin: { description: 'NAMUNA. Ochilmagan boʻlsa qaytarish, kun' } },
    { name: 'orderCutoff', type: 'text', required: true, defaultValue: '18:00', admin: { description: 'Shu vaqtgacha buyurtma — ertaga yetkaziladi' } },
    { name: 'telegramUrl', type: 'text', required: true, defaultValue: 'https://t.me/' },
    { name: 'telegramBotUrl', type: 'text', required: true, defaultValue: 'https://t.me/' },
    { name: 'phone', type: 'text', admin: { description: 'Doʻkon telefoni, masalan +998 90 123 45 67' } },
    { name: 'email', type: 'email' },
    { name: 'telegramHandle', type: 'text', admin: { description: 'Masalan @yeppo_uz_bot' } },
    { name: 'supportHours', type: 'text', defaultValue: '9:00–21:00', localized: true },
    { name: 'pickupAddress', type: 'text', localized: true, admin: { description: 'Olib ketish nuqtasi (boʻsh boʻlsa — saytda koʻrsatilmaydi)' } },
    { name: 'pickupHours', type: 'text', defaultValue: '10:00–20:00' },
    { name: 'refundDays', type: 'text', defaultValue: '3–5', admin: { description: 'NAMUNA. Pul kartaga necha ish kunida qaytadi' } },
    { name: 'minShelfMonths', type: 'number', defaultValue: 6, admin: { description: 'NAMUNA. Kamida necha oy yaroqlilik muddati qolgan mahsulot yuboriladi' } },
    {
      name: 'loyalty', type: 'group', admin: { description: 'Bonus dasturi. Darajalar boʻsh boʻlsa — dastur saytda koʻrinmaydi. Hammasi NAMUNA, egasi tasdiqlaydi.' },
      fields: [
        { name: 'tiers', type: 'array', fields: [
          { name: 'name', type: 'text', required: true, localized: true }, { name: 'percent', type: 'number', required: true },
          { name: 'from', type: 'number', defaultValue: 0, admin: { description: 'Jami xarid (soʻm) shu summadan' } },
          { name: 'perks', type: 'array', fields: [{ name: 'text', type: 'text', required: true, localized: true }] },
        ] },
        { name: 'maxUsePct', type: 'number', defaultValue: 30, admin: { description: 'Buyurtma summasining necha % igacha ball bilan' } },
        { name: 'creditDays', type: 'number', admin: { description: 'Ball yetkazilgandan keyin necha kunda tushadi' } },
        { name: 'expireMonths', type: 'number', admin: { description: 'Necha oy xarid boʻlmasa ball yonadi (boʻsh = yonmaydi)' } },
      ],
    },
    { name: 'cashOnDelivery', type: 'checkbox', defaultValue: false, admin: { description: 'Toshkentda qabul qilganda toʻlash (saytda yoqilsa koʻrsatiladi)' } },
    { name: 'homeRoutine', type: 'relationship', relationTo: 'products', hasMany: true, maxRows: 3,
      admin: { description: 'Bosh sahifadagi «Tayyor rutina»: toner, ampula, SPF (tartib bilan)' } },
  ],
}
