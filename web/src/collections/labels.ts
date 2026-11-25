import type { CollectionConfig, Field, GlobalConfig } from 'payload'

// The admin panel in Uzbek: names of the sections and of every field the owner sees. The data model keeps its
// stable English keys; only the labels shown on screen are set here (fields that already have a label keep it).

const SECTIONS: Record<string, [singular: string, plural: string]> = {
  orders: ['Buyurtma', 'Buyurtmalar'], payments: ['Tranzaksiya', 'Toʻlov tranzaksiyalari'], 'promo-codes': ['Promokod', 'Promokodlar'],
  'gift-cards': ['Sertifikat', 'Sovgʻa sertifikatlari'], customers: ['Mijoz', 'Mijozlar'], products: ['Mahsulot', 'Mahsulotlar'],
  brands: ['Brend', 'Brendlar'], categories: ['Toifa', 'Toifalar'], 'price-history': ['Narx yozuvi', 'Narx tarixi'], reviews: ['Sharh', 'Sharhlar'],
  banners: ['Banner', 'Bannerlar'], segments: ['Sahifa', '«Kim uchun» sahifalari'], 'search-log': ['Soʻrov', 'Qidiruv soʻrovlari'],
  'legal-pages': ['Sahifa', 'Huquqiy sahifalar'], articles: ['Maqola', 'Jurnal maqolalari'], ingredients: ['Ingredient', 'Ingredientlar lugʻati'],
  media: ['Rasm', 'Rasmlar'], users: ['Admin', 'Adminlar'],
}
const GLOBALS: Record<string, string> = { store: 'Doʻkon sozlamalari' }

const F: Record<string, string> = {
  name: 'Nomi', slug: 'Havola nomi (slug)', price: 'Narx (soʻm)', stock: 'Qoldiq (dona)', sku: 'Artikul (SKU)', volume: 'Hajmi', status: 'Holati', total: 'Jami (soʻm)',
  phone: 'Telefon', address: 'Manzil', addresses: 'Manzillar', email: 'Email', title: 'Sarlavha', description: 'Tavsif', summary: 'Qisqacha tavsif', brand: 'Brend',
  category: 'Toifa', type: 'Turi', need: 'Nima uchun (bir qator)', skin: 'Teri turlari', concerns: 'Muammolar', notFor: 'Tavsiya qilinmaydi', tags: 'Belgilar',
  images: 'Rasmlar', variants: 'Hajmlar (variantlar)', ingredients: 'Tarkibi', howTo: 'Qanday ishlatiladi', batch: 'Partiya raqami', expiresAt: 'Yaroqlilik muddati',
  certificate: 'Sertifikat (fayl)', expertNote: '«Maslahatchi aytadi»', fit: '«Teringizga mosmi?»', faq: 'Savol-javob', q: 'Savol', a: 'Javob', pairsWith: 'Birga olinadi',
  sample: 'Namuna maʼlumot (ishga tushirishdan oldin almashtiring)', order: 'Tartib raqami', image: 'Rasm', alt: 'Rasm tavsifi (alt matn)', caption: 'Rasm izohi',
  number: 'Raqam', token: 'Maxfiy kalit', lang: 'Til', paymentStatus: 'Toʻlov holati', payment: 'Toʻlov usuli', paidAt: 'Toʻlangan vaqt', items: 'Tovarlar',
  subtotal: 'Tovarlar summasi', discount: 'Chegirma', discountLabel: 'Chegirma manbai', deliveryFee: 'Yetkazish narxi', giftFee: 'Sovgʻa qutisi narxi',
  pointsUsed: 'Ishlatilgan ball', pointsEarned: 'Berilgan ball', telegramUpdates: 'Telegramda xabar olishni xohlaydi', delivery: 'Yetkazish turi', city: 'Shahar',
  slot: 'Vaqt oraligʻi', comment: 'Mijoz izohi', gift: 'Sovgʻa qutisi', qty: 'Soni', provider: 'Toʻlov tizimi', providerId: 'Tranzaksiya raqami', amount: 'Summa',
  state: 'Holat kodi', createTime: 'Yaratilgan', performTime: 'Bajarilgan', cancelTime: 'Bekor qilingan', reason: 'Sababi', code: 'Kod', value: 'Qiymati',
  note: 'Izoh', minTotal: 'Eng kam summa', firstOrderOnly: 'Faqat birinchi buyurtmaga', active: 'Faol', validTo: 'Amal qilish muddati', balance: 'Qoldiq summa',
  orderNumber: 'Buyurtma raqami', form: 'Shakli', rating: 'Baho (1–5)', helpful: 'Foydali deganlar', approved: 'Tasdiqlangan (saytda koʻrinadi)', product: 'Mahsulot',
  count: 'Necha marta', missed: 'Topilmagan', author: 'Muallif', reviewedBy: 'Tekshirgan dermatolog', publishedAt: 'Eʼlon qilingan sana', shortAnswer: 'Qisqa javob (tepada)',
  sections: 'Boʻlimlar', steps: 'Qadamlar', excerpt: 'Qisqa matn', cover: 'Muqova rasmi', coverPos: 'Muqova joylashuvi', minutes: 'Oʻqish vaqti (daqiqa)',
  featured: 'Asosiy (yuqorida)', accent: 'Kursiv soʻz', tag: 'Teg', tagStyle: 'Teg uslubi', tagShort: 'Telefon uchun teg', titleShort: 'Telefon uchun sarlavha',
  ctaShort: 'Telefon uchun tugma', cta: 'Tugma matni', link: 'Havola', imagePos: 'Rasm joylashuvi', bg: 'Fon rangi', endsAt: 'Tugash vaqti', kind: 'Turi',
  tagline: 'Shior', short: 'Qisqa nom', about: 'Brend haqida', country: 'Davlat', lines: 'Liniyalar', keyword: 'Kalit soʻz', color: 'Rang', who: 'Kimga', care: 'Eʼtibor',
  does: 'Nima qiladi', seoTitle: 'SEO sarlavha', seoText: 'SEO matn', parent: 'Ota toifa', freeDeliveryFrom: 'Bepul yetkazish chegarasi (soʻm)',
  tashkentDays: 'Toshkent boʻylab yetkazish (kun)', regionDays: 'Viloyatlarga yetkazish (kun)', tashkentPrice: 'Toshkentga yetkazish narxi',
  regionPrice: 'Viloyatga yetkazish narxi', giftBoxPrice: 'Sovgʻa qutisi narxi', returnDays: 'Qaytarish muddati (kun)', orderCutoff: 'Buyurtma qabul qilish vaqti',
  telegramUrl: 'Telegram kanal havolasi', telegramBotUrl: 'Telegram bot havolasi', telegramHandle: 'Telegram nomi', supportHours: 'Ish vaqti (yordam)',
  pickupAddress: 'Olib ketish manzili', pickupHours: 'Olib ketish vaqti', refundDays: 'Pul qaytish muddati (ish kuni)', minShelfMonths: 'Eng kam qolgan yaroqlilik (oy)',
  loyalty: 'Bonus dasturi', tiers: 'Darajalar', maxUsePct: 'Ball bilan eng koʻp toʻlash (%)', creditDays: 'Ball tushish muddati (kun)',
  expireMonths: 'Ball yonish muddati (oy)', cashOnDelivery: 'Qabul qilganda toʻlash', homeRoutine: 'Bosh sahifadagi tayyor rutina', perks: 'Imtiyozlar',
  percent: 'Foiz', from: 'Qancha xariddan (soʻm)', text: 'Matn', src: 'Manba', med: 'Kanal', cmp: 'Kampaniya', landing: 'Birinchi kirgan sahifa',
  visitor: 'Tashrifchi (ID)', session: 'Kirish (ID)', step: 'Qadam', why: 'Nega', say: 'Kirish matni', set: 'Tayyor toʻplam', setName: 'Toʻplam nomi', setWhy: 'Toʻplam izohi',
  grid: 'Mahsulotlar roʻyxati', gridTitle: 'Roʻyxat sarlavhasi', exclude: 'Koʻrsatilmaydi', avoid: 'Nimadan saqlanish', h: 'Sarlavha', h1: 'Bosh sarlavha',
  d: 'Izoh', t: 'Sarlavha', ok: 'Mos', routine: 'Saqlangan rutina', hash: 'Kod (shifrlangan)', tries: 'Urinishlar', body: 'Matn', img: 'Rasm (havola)',
  tagline2: 'Shior',
}

function walk(fields: Field[]): Field[] {
  return fields.map((f) => {
    const x = { ...f } as Field & { fields?: Field[]; tabs?: { fields: Field[] }[]; label?: unknown; name?: string }
    if ('name' in x && x.name && x.label === undefined && F[x.name]) x.label = F[x.name]
    if (Array.isArray(x.fields)) x.fields = walk(x.fields)
    if (Array.isArray(x.tabs)) x.tabs = x.tabs.map((t) => ({ ...t, fields: walk(t.fields) }))
    return x as Field
  })
}

export const uz = {
  collection: <C extends CollectionConfig>(c: C): C => {
    const s = SECTIONS[c.slug]
    return { ...c, ...(s && !c.labels ? { labels: { singular: s[0], plural: s[1] } } : {}), fields: walk(c.fields) }
  },
  global: <G extends GlobalConfig>(g: G): G => ({ ...g, ...(GLOBALS[g.slug] && !g.label ? { label: GLOBALS[g.slug] } : {}), fields: walk(g.fields) }),
}
