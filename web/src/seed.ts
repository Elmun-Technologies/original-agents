/**
 * Seeds the catalog from the design package (data/products.sample.json): 12 SAMPLE products.
 *   pnpm seed          products, brands, categories, images (no discounts)
 *   pnpm seed --demo   + sample "old prices" 10 days back, so the design's −15% badges show (staging only!)
 * Ratings/reviews are NOT seeded: they come only from verified purchases (HANDOFF §6).
 * Safe to re-run: skips what already exists (by slug).
 */
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import config from './payload.config'

const ROOT = path.resolve(process.cwd(), '..', 'design', 'yeppo-handoff')
const IMAGES = path.resolve(process.cwd(), 'public', 'img')
const demo = process.argv.includes('--demo')

// order as in the design's sub-category pills (Catalog.html): Essensiyalar, Tonerlar, SPF first
const CATS: [slug: string, uz: string, ru: string, types: string[], short: [string, string]][] = [
  ['serum', 'Serum va ampulalar', 'Сыворотки и ампулы', ['Ampula', 'Serum'], ['Serumlar', 'Сыворотки']],
  ['essensiya', 'Essensiyalar', 'Эссенции', ['Essensiya'], ['Essensiyalar', 'Эссенции']],
  ['toner', 'Tonerlar va padlar', 'Тонеры и пэды', ['Toner'], ['Tonerlar', 'Тонеры']],
  ['spf', 'Quyoshdan himoya', 'Защита от солнца', ['SPF'], ['SPF', 'SPF']],
  ['krem', 'Kremlar', 'Кремы', ['Krem'], ['Kremlar', 'Кремы']],
  ['tozalash', 'Tozalovchilar', 'Очищение', ['Tozalovchi'], ['Tozalash', 'Очищение']],
  ['niqoblar', 'Niqoblar', 'Маски', ['Niqob'], ['Niqoblar', 'Маски']],
  ['toplamlar', 'Toʻplamlar', 'Наборы', ['Toʻplam'], ['Toʻplamlar', 'Наборы']],
]
// concerns per sample product (from the design's picker mapping, p_main.py ndMap)
const CONCERNS: Record<string, ('acne' | 'pores' | 'pigment' | 'dryness' | 'wrinkles' | 'dull')[]> = {
  amp: ['acne', 'pores'], toner: ['acne', 'dull'], snail: ['acne', 'dryness'], ess: ['dryness', 'dull'], revive: ['dryness'],
  baha: ['dull', 'pores'], pore: ['pores'], cream: ['dryness'], clean: ['pores'], mask: ['acne'], spf: [], set: ['dull'],
}
// Lexical rich text from paragraphs; **bold** spans
const rich = (...paras: string[]) => ({
  root: { type: 'root', format: '' as const, indent: 0, version: 1, direction: 'ltr' as const, children: paras.map((para) => ({
    type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr' as const, textFormat: 0,
    children: para.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((t) => ({
      type: 'text', text: t.replace(/\*\*/g, ''), format: t.startsWith('**') ? 1 : 0, detail: 0, mode: 'normal', style: '', version: 1,
    })),
  })) },
})

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function main() {
  const payload = await getPayload({ config: await config })
  const { products } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.sample.json'), 'utf8'))

  const one = async (collection: any, slug: string, create: () => Promise<any>) =>
    (await payload.find({ collection, where: { slug: { equals: slug } }, limit: 1 })).docs[0] ?? create()

  const ruDict = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ru.json'), 'utf8')) as Record<string, string>
  const face = await one('categories', 'yuz-parvarishi', async () => {
    const c = await payload.create({ collection: 'categories', data: { slug: 'yuz-parvarishi', title: 'Yuz parvarishi', order: 0 }, locale: 'uz' })
    await payload.update({ collection: 'categories', id: c.id, data: { title: 'Уход за лицом' }, locale: 'ru' })
    return c
  })
  // SEO block of the serum catalog: text from the design (Catalog.html), Russian from the design dictionary
  const SEO: Record<string, [string, string]> = {
    serum: ['Koreys serumini qanday tanlash kerak?', 'Serum — rutinadagi eng «ishlaydigan» qadam: u aniq bitta muammoga qaratilgan. Qizarish va toshma boʻlsa — centella yoki choy daraxti; quruqlik boʻlsa — gialuron va salyangoz mutsini; xira rang boʻlsa — niatsinamid va galactomyces. Serum tonerdan keyin, kremdan oldin surtiladi. Bilmasangiz, teri turingizni yuqorida tanlang yoki AI maslahatchidan soʻrang.'],
  }
  const cats: Record<string, any> = {}
  for (const [i, [slug, uz, ru, types, short]] of CATS.entries()) {
    const doc = await one('categories', slug, async () => {
      const seo = SEO[slug]
      const c = await payload.create({ collection: 'categories', data: { slug, title: uz, short: short[0], order: i, parent: face.id, ...(seo ? { seoTitle: seo[0], seoText: seo[1] } : {}) }, locale: 'uz' })
      await payload.update({ collection: 'categories', id: c.id, data: { title: ru, short: short[1], ...(seo ? { seoTitle: ruDict[seo[0]] ?? seo[0], seoText: ruDict[seo[1]] ?? seo[1] } : {}) }, locale: 'ru' })
      return c
    })
    for (const t of types) cats[t] = doc
  }

  const media = async (file: string, alt: string) => {
    const found = (await payload.find({ collection: 'media', where: { filename: { equals: file } }, limit: 1 })).docs[0]
    return found ?? payload.create({ collection: 'media', data: { alt }, filePath: path.join(IMAGES, file) })
  }

  let made = 0
  for (const s of products) {
    const brand = await one('brands', slugify(s.brand), () =>
      payload.create({ collection: 'brands', data: { name: s.brand, slug: slugify(s.brand) } }))
    const slug = slugify(`${s.brand} ${s.name}`)
    if ((await payload.find({ collection: 'products', where: { slug: { equals: slug } }, limit: 1 })).docs.length) continue
    const image = await media(path.basename(s.image), `${s.brand} ${s.name}`)
    const tags = (s.tags as string[]).flatMap((t): ('hit' | 'new' | 'set')[] => (t === 'Hit' ? ['hit'] : t === 'Yangi' ? ['new'] : t === 'Toʻplam' ? ['set'] : []))
    const sku = `Y-${s.id.toUpperCase()}`
    const p = await payload.create({
      collection: 'products',
      locale: 'uz',
      data: {
        name: s.name, slug, brand: brand.id, category: cats[s.type].id, type: s.type, need: s.need,
        skin: s.skin, concerns: CONCERNS[s.id] ?? [], tags, images: [image.id], sample: true,
        variants: [{ volume: s.vol || undefined, sku, price: s.price, stock: s.id === 'snail' ? 0 : 10 }], // one sold-out sample
      },
    })
    await payload.update({ collection: 'products', id: p.id, locale: 'ru', data: { type: s.type_ru, need: s.need_ru } })
    if (demo && s.old) {
      await payload.create({
        collection: 'price-history',
        data: { product: p.id, sku, price: s.old, createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString() } as any,
      })
    }
    made++
  }
  // home: 3 slides + weekly sale (design p_main.py SL), ready routine (toner, ampoule, SPF)
  if (!(await payload.find({ collection: 'banners', limit: 1 })).docs.length) {
    const SL = [
      { tag: 'Birinchi buyurtmaga', tagStyle: 'tag-sale', title: 'Birinchi xaridingizga −10%', text: 'Savatda SALOM10 kodini kiriting. Qaysi mahsulot mosligini bilmasangiz — yozing, tanlashga yordam beramiz.', cta: 'Xaridni boshlash', tagShort: 'Birinchi xarid', titleShort: 'SALOM10 bilan −10%', ctaShort: 'Kodni savatda kiriting', link: '/katalog/serum', img: 'hero-dewy.jpg', pos: '50% 25%', bg: '#F2D6D0', alt: 'Tabiiy porloq terili ayol' },
      { tag: 'Centella haftaligi', tagStyle: 'tag-hit', title: 'SKIN1004 ampulalari −15% gacha', text: 'Qizarish va toshmalarni tinchlantiradigan eng mashhur ampula. Aksiya yakshanba kuni tugaydi.', cta: 'Aksiyani koʻrish', titleShort: 'SKIN1004 −15% gacha', ctaShort: 'Aksiyani koʻrish', link: '/aksiyalar', img: 'p-centella-amp.jpg', pos: '50% 50%', bg: '#F5DCC9', alt: 'SKIN1004 Centella ampulasi' },
      { tag: 'Qishki parvarish', tagStyle: 'tag-new', title: 'Sovuqda teri tortishyaptimi?', text: 'Qishda teri tez quriydi. Namlantiruvchi essensiya va serumlarni bir joyga yigʻdik.', cta: 'Namlantiruvchilar', titleShort: 'Quruq teri uchun toʻplam', ctaShort: 'Tanlash', link: '/katalog/essensiya', img: 'face-flower.jpg', pos: '50% 28%', bg: '#F0EBE5', alt: 'Serum teksturasi' },
    ]
    // Russian from the design dictionary (data/ru.json)
    const ru = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ru.json'), 'utf8')) as Record<string, string>
    const R = (x?: string) => (x ? (ru[x] ?? x) : undefined)
    for (const [i, b] of SL.entries()) {
      const image = await media(b.img, b.alt)
      const doc = await payload.create({ collection: 'banners', locale: 'uz', data: { kind: 'slide', order: i, tag: b.tag, tagStyle: b.tagStyle as any, title: b.title, text: b.text, cta: b.cta, tagShort: (b as any).tagShort, titleShort: b.titleShort, ctaShort: b.ctaShort, link: b.link, image: image.id, imagePos: b.pos, bg: b.bg } })
      await payload.update({ collection: 'banners', id: doc.id, locale: 'ru', data: { tag: R(b.tag), title: R(b.title)!, text: R(b.text), cta: R(b.cta), tagShort: R((b as any).tagShort), titleShort: R(b.titleShort), ctaShort: R(b.ctaShort) } })
    }
    const sale = await payload.create({ collection: 'banners', locale: 'uz', data: { kind: 'sale', order: 10, title: 'Centella haftaligi:', accent: '−15% gacha', endsAt: new Date(Date.now() + (2 * 24 + 14) * 3_600_000).toISOString() } })
    await payload.update({ collection: 'banners', id: sale.id, locale: 'ru', data: { title: R('Centella haftaligi:')!, accent: R('−15% gacha') } })
  }
  const bySku = async (id: string) => (await payload.find({ collection: 'products', where: { 'variants.sku': { equals: `Y-${id.toUpperCase()}` } }, limit: 1 })).docs[0]?.id
  // full product page content for the design's sample product (Product.html / p_product.py)
  const ru = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ru.json'), 'utf8')) as Record<string, string>
  const R = (x: string) => ru[x] ?? x
  const ampId = (await payload.find({ collection: 'products', where: { 'variants.sku': { equals: 'Y-AMP' } }, limit: 1 })).docs[0]?.id
  if (ampId) {
    const SH = [
      ['p-centella-amp.jpg', 'SKIN1004 Centella Ampoule flakoni', 'Asl qadoq'], ['p-centella-duo.jpg', 'Centella ampulalari', 'Liniyadagi boshqa ampula bilan'],
      ['dropper-hand.jpg', 'Pipetkadan tomayotgan serum', 'Tekstura: suvdek yengil'], ['tex-3.jpg', 'Serum teksturasi va barglar', 'Bitta ingredient — centella'],
      ['face-glow.jpg', 'Tinch, yumshoq teri', 'Kundalik parvarishda'],
    ]
    const imgs = []
    for (const [file, alt, cap] of SH) {
      const m = await media(file, alt)
      await payload.update({ collection: 'media', id: m.id, locale: 'uz', data: { caption: cap } })
      await payload.update({ collection: 'media', id: m.id, locale: 'ru', data: { caption: R(cap) } })
      imgs.push(m.id)
    }
    const D = ['Bu ampula bitta ingredientdan iborat — Madagaskarda oʻsadigan', 'centella asiatica', 'ekstrakti. Shuning uchun u juda yumshoq: qizarishni tinchlantiradi, toshmalardan keyin terini tiklaydi va namlik beradi.',
      'Kimga mos:', 'sezgir, yogʻli, aralash va normal teri. Quruq teri boʻlsa, ustidan namlantiruvchi krem surting.',
      'Natija qachon:', 'koʻpchilik birinchi haftada tinchlanishni sezadi. Doimiy natija uchun 4–6 hafta har kuni ishlating.']
    const desc = (T: (x: string) => string) => rich(`${T(D[0])} **${T(D[1])}** ${T(D[2])}`, `**${T(D[3])}** ${T(D[4])}`, `**${T(D[5])}** ${T(D[6])}`)
    const FIT: [string, boolean, string][] = [
      ['dry', false, 'Mos, lekin ustidan namlantiruvchi krem surting — ampula yengil.'], ['oily', true, 'Juda mos: yogʻ qoldirmaydi, toshmalarni tinchlantiradi.'],
      ['combo', true, 'Mos: T-zonani ogʻirlashtirmaydi, yonoqlarni tinchlantiradi.'], ['sens', true, 'Aynan siz uchun: bitta ingredient, xushboʻysiz.'],
      ['normal', true, 'Mos: profilaktika va yengil namlik uchun.'],
    ]
    const FAQ = [
      ['Retinol bilan birga ishlatsa boʻladimi?', 'Ha. Retinoldan keyin surtsangiz, tirnashni kamaytiradi. Faqat retinolni kechqurun ishlating va ertalab SPF unutmang.'],
      ['Homiladorlikda mumkinmi?', 'Tarkibida faqat centella ekstrakti bor. Shunga qaramay, homiladorlikda har qanday yangi vositani shifokoringiz bilan kelishib oling.'],
      ['Ochganimdan keyin qancha saqlanadi?', 'Odatda 12 oy — aniq muddat qadoqdagi «ochilgandan keyin» belgisida. Quyosh tushmaydigan joyda saqlang.'],
    ]
    const SUM = 'Yuzingiz tez qizarsa yoki toshma tez-tez chiqsa — shu ampuladan boshlang. Suvdek yengil, yopishmaydi, sezgir teriga ham yoqadi.'
    const EXPERT = '«Bu ampula — eng xavfsiz boshlanish. Agar birinchi marta koreys parvarishini sinayotgan boʻlsangiz yoki teringiz hamma narsaga qizarsa, aynan shundan boshlang. Bir oyda farqni koʻrasiz.»'
    const ING = 'Centella asiatica ekstrakti 100%. Hid, spirt, boʻyoq yoʻq.'
    const HOW = 'Tonerdan keyin 2–3 tomchi, yuzga yengil urib. Ertalab va kechqurun.'
    const pairs = (await Promise.all(['toner', 'spf'].map(bySku))).filter(Boolean) as number[]
    const doc = await payload.update({
      collection: 'products', id: ampId, locale: 'uz',
      data: {
        images: imgs, summary: SUM, description: desc((x) => x), ingredients: rich(ING), howTo: rich(HOW), expertNote: EXPERT.replace(/[«»]/g, ''),
        fit: FIT.map(([skin, ok, note]) => ({ skin: skin as any, ok, note })), faq: FAQ.map(([q, a]) => ({ q, a })), pairsWith: pairs,
        variants: [{ volume: '55 ml', sku: 'Y-AMP', price: 245000, stock: 10 }, { volume: '100 ml', sku: 'Y-AMP-100', price: 389000, stock: 6 }],
      },
    })
    await payload.update({
      collection: 'products', id: ampId, locale: 'ru',
      data: {
        summary: R(SUM), description: desc(R), ingredients: rich(R(ING)), howTo: rich(R(HOW)), expertNote: R(EXPERT).replace(/[«»]/g, ''),
        fit: doc.fit!.map((f, i) => ({ ...f, note: R(FIT[i][2]) })), faq: doc.faq!.map((f, i) => ({ ...f, q: R(FAQ[i][0]), a: R(FAQ[i][1]) })),
      },
    })
  }

  const routine = (await Promise.all(['toner', 'amp', 'spf'].map(bySku))).filter(Boolean) as number[]
  await payload.updateGlobal({ slug: 'store', data: { homeRoutine: routine } })

  if (!(await payload.find({ collection: 'promo-codes', where: { code: { equals: 'SALOM10' } }, limit: 1 })).docs.length) {
    // NAMUNA: the design's first-order code (−10%); change or switch off in the admin
    const pc = await payload.create({ collection: 'promo-codes', locale: 'uz', data: { code: 'SALOM10', type: 'percent', value: 10, firstOrderOnly: true, active: true, note: 'birinchi buyurtmaga −10%' } })
    await payload.update({ collection: 'promo-codes', id: pc.id, locale: 'ru', data: { note: 'скидка −10% на первый заказ' } })
  }

  payload.logger.info(`seed: ${made} ta yangi mahsulot${demo ? ' (+ namuna eski narxlar)' : ''}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
