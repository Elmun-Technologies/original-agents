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

// Sample data: the design package (design/yeppo-handoff, not in git) when it is on disk, otherwise the copy in
// src/seed-data so a fresh clone can seed and run the e2e tests.
const DESIGN = path.resolve(process.cwd(), '..', 'design', 'yeppo-handoff', 'data')
const LOCAL = path.resolve(process.cwd(), 'src', 'seed-data')
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))
const sampleProducts = () => readJson(fs.existsSync(path.join(DESIGN, 'products.sample.json')) ? path.join(DESIGN, 'products.sample.json') : path.join(LOCAL, 'products.sample.json')).products
/** uz -> ru dictionary: the design's when present, else the site's own (src/i18n) */
const ruDictionary = (): Record<string, string> => fs.existsSync(path.join(DESIGN, 'ru.json'))
  ? readJson(path.join(DESIGN, 'ru.json'))
  : { ...readJson(path.resolve(process.cwd(), 'src', 'i18n', 'ru.json')), ...readJson(path.resolve(process.cwd(), 'src', 'i18n', 'ru.extra.json')) }
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
  amp: ['acne', 'pores'], toner: ['acne', 'dull'], snail: ['acne', 'dryness', 'wrinkles'], ess: ['dryness', 'dull', 'pigment'], revive: ['dryness', 'wrinkles'],
  baha: ['dull', 'pores', 'pigment'], pore: ['pores'], cream: ['dryness'], clean: ['pores'], mask: ['acne'], spf: [], set: ['dull'],
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
  const products = sampleProducts()

  const one = async (collection: any, slug: string, create: () => Promise<any>) =>
    (await payload.find({ collection, where: { slug: { equals: slug } }, limit: 1 })).docs[0] ?? create()

  const ruDict = ruDictionary()
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
  // gift certificate (Gifts page): one product, a variant per amount × form; price = amount, never discounted
  if (!(await payload.find({ collection: 'products', where: { slug: { equals: 'sovga-sertifikati' } }, limit: 1 })).docs.length) {
    const house = await one('brands', 'yeppo', () => payload.create({ collection: 'brands', data: { name: 'Yeppo', slug: 'yeppo' } }))
    const gc = await one('categories', 'sertifikatlar', async () => {
      const c = await payload.create({ collection: 'categories', data: { slug: 'sertifikatlar', title: 'Sovgʻa sertifikatlari', order: 99 }, locale: 'uz' })
      await payload.update({ collection: 'categories', id: c.id, data: { title: 'Подарочные сертификаты' }, locale: 'ru' })
      return c
    })
    const image = await media('p-flatlay-pink.jpg', 'Sovgʻa sertifikati')
    const p = await payload.create({ collection: 'products', locale: 'uz', data: {
      name: 'Sovgʻa sertifikati', slug: 'sovga-sertifikati', brand: house.id, category: gc.id, type: 'Sertifikat', images: [image.id],
      variants: [100000, 200000, 300000, 500000].flatMap((a) => [{ volume: 'Telegram', sku: `GC-${a}-TG`, price: a, stock: 9999 }, { volume: 'Kartochka', sku: `GC-${a}-CARD`, price: a, stock: 9999 }]),
    } })
    await payload.update({ collection: 'products', id: p.id, locale: 'ru', data: { type: 'Сертификат' } })
  }
  // home: 3 slides + weekly sale (design p_main.py SL), ready routine (toner, ampoule, SPF)
  if (!(await payload.find({ collection: 'banners', limit: 1 })).docs.length) {
    const SL = [
      { tag: 'Birinchi buyurtmaga', tagStyle: 'tag-sale', title: 'Birinchi xaridingizga −10%', text: 'Savatda SALOM10 kodini kiriting. Qaysi mahsulot mosligini bilmasangiz — yozing, tanlashga yordam beramiz.', cta: 'Xaridni boshlash', tagShort: 'Birinchi xarid', titleShort: 'SALOM10 bilan −10%', ctaShort: 'Kodni savatda kiriting', link: '/katalog/serum', img: 'hero-dewy.jpg', pos: '50% 25%', bg: '#F2D6D0', alt: 'Tabiiy porloq terili ayol' },
      { tag: 'Centella haftaligi', tagStyle: 'tag-hit', title: 'SKIN1004 ampulalari −15% gacha', text: 'Qizarish va toshmalarni tinchlantiradigan eng mashhur ampula. Aksiya yakshanba kuni tugaydi.', cta: 'Aksiyani koʻrish', titleShort: 'SKIN1004 −15% gacha', ctaShort: 'Aksiyani koʻrish', link: '/aksiyalar', img: 'p-centella-amp.jpg', pos: '50% 50%', bg: '#F5DCC9', alt: 'SKIN1004 Centella ampulasi' },
      { tag: 'Qishki parvarish', tagStyle: 'tag-new', title: 'Sovuqda teri tortishyaptimi?', text: 'Qishda teri tez quriydi. Namlantiruvchi essensiya va serumlarni bir joyga yigʻdik.', cta: 'Namlantiruvchilar', titleShort: 'Quruq teri uchun toʻplam', ctaShort: 'Tanlash', link: '/katalog/essensiya', img: 'face-flower.jpg', pos: '50% 28%', bg: '#F0EBE5', alt: 'Serum teksturasi' },
    ]
    // Russian from the design dictionary (data/ru.json)
    const ru = ruDictionary()
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
  const ru = ruDictionary()
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
  // bonus tiers from the design — SAMPLE values, only with --demo (the owner sets the real ones in the admin)
  if (demo && !(await payload.findGlobal({ slug: 'store', depth: 0 })).loyalty?.tiers?.length) {
    const T = [['Pushti', 'Розовый', 3, 0, [['Tugʻilgan kun sovgʻasi', 'Подарок на день рождения']]], ['Shaftoli', 'Персиковый', 5, 2000000, [['Yangi mahsulotlarga oldindan kirish', 'Ранний доступ к новинкам']]], ['Kakao', 'Какао', 7, 5000000, [['Bepul yetkazish har doim', 'Бесплатная доставка всегда']]]] as const
    const st = await payload.updateGlobal({ slug: 'store', locale: 'uz', data: { loyalty: { maxUsePct: 30, creditDays: 3, tiers: T.map(([n, , pc, from, perks]) => ({ name: n, percent: pc, from, perks: perks.map(([x]) => ({ text: x })) })) } } })
    await payload.updateGlobal({ slug: 'store', locale: 'ru', data: { loyalty: { ...st.loyalty, tiers: st.loyalty!.tiers!.map((t, i) => ({ ...t, name: T[i][1], perks: t.perks!.map((x, j) => ({ ...x, text: T[i][4][j][1] })) })) } } })
  }

  // brands: taglines/short notes and covers from the design (Brands.html, Brand.html); Russian from the design dictionary
  const BR: Record<string, { tag?: string; short: string; cover?: string; order?: number }> = {
    skin1004: { tag: 'Sezgir teri uchun centella', short: 'Madagaskar centellasi', cover: 'p-centella-duo.jpg', order: 1 },
    'beauty-of-joseon': { tag: 'Jenshen va guruch', short: 'Jenshen, guruch', cover: 'p-boj-glow.jpg', order: 2 },
    mixsoon: { tag: 'Ferment essensiyalar', short: 'Ferment essensiya', cover: 'p-mixsoon.jpg', order: 3 },
    missha: { tag: 'Yengil SPF', short: 'SPF, BB krem', cover: 'spf-missha.jpg', order: 4 },
    'cos-de-baha': { short: 'Arzon aktivlar' }, iunik: { short: 'Salyangoz, propolis' }, mediheal: { short: 'Matoli niqoblar' },
    'round-lab': { short: 'Dokdo suvi' }, torriden: { short: 'DIVE-IN gialuron' },
  }
  for (const [slug, b] of Object.entries(BR)) {
    const doc = (await payload.find({ collection: 'brands', where: { slug: { equals: slug } }, limit: 1 })).docs[0]
    if (!doc) continue
    const cover = b.cover ? (await media(b.cover, doc.name)).id : undefined
    await payload.update({ collection: 'brands', id: doc.id, locale: 'uz', data: { tagline: b.tag, short: b.short, cover, featured: !!b.cover, order: b.order ?? 10 } })
    await payload.update({ collection: 'brands', id: doc.id, locale: 'ru', data: { tagline: b.tag && R(b.tag), short: R(b.short), country: R('Janubiy Koreya') } })
  }
  const skin = (await payload.find({ collection: 'brands', where: { slug: { equals: 'skin1004' } }, limit: 1 })).docs[0]
  if (skin) {
    const ABOUT = 'Madagaskar centellasi bilan mashhur brend. Tarkiblari qisqa, hidsiz — shuning uchun sezgir va qizarishga moyil teriga koʻp tavsiya qilamiz. Qaysi liniyadan boshlashni bilmasangiz, pastda tushuntirdik.'
    const LINES = [
      ['Centella (yashil)', 'Madagascar', '#9DB89A', 'Asosiy liniya. Qizarish va tirnashni tinchlantiradi.', 'Kimga: sezgir, qizarishga moyil teri'],
      ['Hyalu-Cica (koʻk)', 'Hyalu-Cica', '#9BB7CF', 'Centella + gialuron. Namlik va yorqinlik.', 'Kimga: quruq, charchagan teri'],
      ['Poremizing (pushti)', 'Poremizing', '#E7B9BC', 'Poralar va yogʻ uchun, yengil tekstura.', 'Kimga: yogʻli va aralash teri'],
    ]
    const FAQB = [
      ['SKIN1004 qaysi davlat brendi?', 'Janubiy Koreya brendi. Asosiy tarkibi — Madagaskar centellasi.'],
      ['Ampula va toner birga ishlatiladimi?', 'Ha: avval toner, keyin ampula, soʻng krem. Ertalab oxirida SPF.'],
      ['Homiladorlikda mumkinmi?', 'Centella liniyasida retinol yoʻq, lekin har qanday yangi vositani shifokoringiz bilan kelishib oling.'],
    ]
    const d = await payload.update({ collection: 'brands', id: skin.id, locale: 'uz', data: {
      about: ABOUT, country: 'Janubiy Koreya',
      lines: LINES.map(([name, keyword, color, note, who]) => ({ name, keyword, color, note, who })), faq: FAQB.map(([q, a]) => ({ q, a })) } })
    await payload.update({ collection: 'brands', id: skin.id, locale: 'ru', data: {
      about: R(ABOUT), lines: d.lines!.map((l, i) => ({ ...l, name: R(LINES[i][0]), note: R(LINES[i][3]), who: R(LINES[i][4]) })),
      faq: d.faq!.map((f, i) => ({ ...f, q: R(FAQB[i][0]), a: R(FAQB[i][1]) })) } })
  }

  // "Kim uchun" segments from the design (p_segment.py -> src/seed-data/segments.json)
  if (!(await payload.find({ collection: 'segments', limit: 1 })).docs.length) {
    const SEGS = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'seed-data', 'segments.json'), 'utf8')) as any[]
    for (const g of SEGS) {
      const ids = async (keys: string[]) => (await Promise.all(keys.map(bySku))).filter(Boolean) as number[]
      const setIds = await ids(g.set.map((x: any) => x.id))
      const image = await media(g.img, g.alt)
      const doc = await payload.create({ collection: 'segments', locale: 'uz', data: {
        slug: g.slug, order: g.order, title: g.t, tag: g.tag, image: image.id, imagePos: g.pos, h1: g.h1, say: g.say, setName: g.setName, setWhy: g.setWhy,
        set: g.set.map((x: any, i: number) => ({ step: x.step, product: setIds[i], why: x.why })).filter((x: any) => x.product),
        gridTitle: g.gridTitle, grid: await ids(g.grid), exclude: g.exclude,
        avoid: g.avoid.map((text: string) => ({ text })), faq: g.faq.map((f: any) => ({ q: f.q, a: f.a })) } })
      await payload.update({ collection: 'segments', id: doc.id, locale: 'ru', data: {
        title: R(g.t), tag: R(g.tag), h1: R(g.h1), say: R(g.say), setName: R(g.setName), setWhy: R(g.setWhy), gridTitle: R(g.gridTitle),
        set: doc.set!.map((x, i) => ({ ...x, step: R(g.set[i].step), why: R(g.set[i].why) })),
        avoid: doc.avoid!.map((x, i) => ({ ...x, text: R(g.avoid[i]) })), faq: doc.faq!.map((x, i) => ({ ...x, q: R(g.faq[i].q), a: R(g.faq[i].a) })) } })
    }
  }

  // journal: articles and ingredient glossary from the design (Journal.html, Article.html, p_more2.py, p_article.py)
  if (!(await payload.find({ collection: 'articles', limit: 1 })).docs.length) {
    type A = { slug: string; cat: 'teri-turi' | 'tarkiblar' | 'rutina' | 'spf' | 'erkaklar' | 'originallik'; title: string; ex: string; img: string; pos: string; min: number }
    const PO: A[] = [
      { slug: 'teri-turi', cat: 'teri-turi', title: 'Teri turingizni 2 daqiqada qanday aniqlash mumkin', ex: 'Oddiy salfetka testi va 3 ta savol.', img: 'face-touch.jpg', pos: '50% 30%', min: 4 },
      { slug: 'spf-qishda', cat: 'spf', title: 'Qishda ham SPF kerakmi? Qisqa javob — ha', ex: 'Nega bulutli kunda ham quyosh terini qaritadi.', img: 'spf-arm.jpg', pos: '50% 50%', min: 3 },
      { slug: 'essensiya-serum-ampula', cat: 'tarkiblar', title: 'Essensiya, serum, ampula — farqi nima?', ex: 'Uch soʻz, uch xil vazifa. Pul tejash uchun bilib qoʻying.', img: 'serum-eucalyptus.jpg', pos: '50% 50%', min: 5 },
      { slug: 'koreyscha-parvarish', cat: 'rutina', title: 'Koreyscha parvarish: 10 qadam shartmi?', ex: 'Yoʻq. Boshlash uchun 3 qadam yetarli.', img: 'gel-jar-hands.jpg', pos: '50% 50%', min: 5 },
      { slug: 'originallik', cat: 'originallik', title: 'Originalni soxtadan qanday ajratish mumkin', ex: 'Partiya raqami, qadoq, hid — 5 ta belgi.', img: 'face-leaf.jpg', pos: '50% 30%', min: 6 },
      { slug: 'soqoldan-keyin', cat: 'erkaklar', title: 'Soqoldan keyin qizarish: nima surtish kerak', ex: 'Spirtli loson oʻrniga nima ishlatish.', img: 'men-jar.jpg', pos: '50% 50%', min: 3 },
    ]
    let day = 0
    for (const a of PO) {
      const cover = await media(a.img, a.title)
      const d = await payload.create({ collection: 'articles', locale: 'uz', data: { slug: a.slug, title: a.title, category: a.cat, excerpt: a.ex, shortAnswer: a.ex, cover: cover.id, coverPos: a.pos, minutes: a.min, publishedAt: new Date(Date.now() - (++day) * 86_400_000).toISOString() } })
      await payload.update({ collection: 'articles', id: d.id, locale: 'ru', data: { title: R(a.title), excerpt: R(a.ex), shortAnswer: R(a.ex) } })
    }
    // the design's full article
    const T = 'Yuzingiz tushga borib yaltirayaptimi? Yogʻli teri uchun koreys parvarishi'
    const SA = 'Yogʻli teriga uchta qadam kifoya: yumshoq tozalovchi, yengil namlantiruvchi (masalan, centella yoki niatsinamidli ampula) va har kuni SPF. Kuchli quritadigan vositalar yogʻni faqat koʻpaytiradi.'
    const H = 'Nega teri yogʻlanadi?'
    const P1 = 'Yogʻ bezlari terini himoya qilish uchun sebum ishlab chiqaradi. Ularning faolligi irsiyat, gormonlar va iqlimga bogʻliq. Toshkentning issiq yozida koʻpchilik buni ayniqsa sezadi.'
    const P2 = 'Eng koʻp uchraydigan xato — terini «quritish». Spirtli loson yoki qattiq sovundan keyin teri suvsizlanadi va oʻzini himoya qilish uchun yanada koʻp yogʻ chiqaradi.'
    const ST: [string, string, string][] = [['Toner', 'Yuvgandan keyin, kaft bilan yengil urib', 'toner'], ['Ampula', '2–3 tomchi, butun yuzga', 'pore'], ['SPF', 'Faqat ertalab, oxirgi qadam', 'spf']]
    const IN: [string, string][] = [['Niatsinamid', 'Yogʻ ishlab chiqarishni muvozanatlaydi, poralarni koʻrinishda toraytiradi'], ['Centella asiatica', 'Qizarish va toshmalarni tinchlantiradi'], ['BHA (salitsil kislota)', 'Poralarni tozalaydi; haftasiga 2–3 marta, SPF bilan']]
    const FQ: [string, string][] = [
      ['Yogʻli teriga krem kerakmi?', 'Ha, lekin yengil — gel yoki emulsiya. Namlik yetishmasa, teri koʻproq yogʻ chiqaradi.'],
      ['Kuniga necha marta yuvish kerak?', 'Ikki marta: ertalab va kechqurun. Koʻproq yuvish terini quritadi.'],
      ['Yogʻli teriga SPF yopishqoq boʻlmaydimi?', 'Essensiya yoki gel teksturali SPF tanlang — ular tez soʻriladi va yaltiramaydi.'],
      ['Natija qachon koʻrinadi?', 'Odatda 3–4 haftada. Yangi vositalarni birdaniga emas, bittadan qoʻshing.'],
    ]
    const cover = await media('tex-3.jpg', 'Yengil gel teksturasi')
    const stepIds = await Promise.all(ST.map(([, , k]) => bySku(k)))
    const full = await payload.create({ collection: 'articles', locale: 'uz', data: {
      slug: 'yogli-teri', title: T, accent: 'Yogʻli teri', category: 'teri-turi', tag: 'Yogʻli teri', featured: true, minutes: 7, cover: cover.id, coverPos: '50% 50%',
      excerpt: 'Nega quritish yogʻni koʻpaytiradi, qaysi uchta qadam yetadi va qaysi tarkiblarni qidirish kerak.', shortAnswer: SA, publishedAt: new Date().toISOString(),
      sections: [{ h: H, text: `${P1}\n\n${P2}` }], steps: ST.map(([t, d], i) => ({ t, d, product: stepIds[i] })),
      ingredients: IN.map(([name, d]) => ({ name, d })), faq: FQ.map(([q, a]) => ({ q, a })) } })
    await payload.update({ collection: 'articles', id: full.id, locale: 'ru', data: {
      title: R(T), accent: R('Yogʻli teri'), tag: R('Yogʻli teri'), excerpt: R('Nega quritish yogʻni koʻpaytiradi, qaysi uchta qadam yetadi va qaysi tarkiblarni qidirish kerak.'),
      shortAnswer: R(SA), sections: full.sections!.map((x) => ({ ...x, h: R(H), text: `${R(P1)}\n\n${R(P2)}` })),
      steps: full.steps!.map((x, i) => ({ ...x, t: R(ST[i][0]), d: R(ST[i][1]) })), ingredients: full.ingredients!.map((x, i) => ({ ...x, name: R(IN[i][0]), d: R(IN[i][1]) })),
      faq: full.faq!.map((x, i) => ({ ...x, q: R(FQ[i][0]), a: R(FQ[i][1]) })) } })
    const IG: [string, string, string, string][] = [
      ['Centella', 'Tinchlantiradi, qizarishni kamaytiradi', 'Sezgir, toshmaga moyil teri', 'Deyarli hammaga mos'],
      ['Niatsinamid', 'Poralar, yogʻ va rangni tekislaydi', 'Yogʻli, aralash teri', '10% dan yuqorisi achishtirishi mumkin'],
      ['Gialuron kislota', 'Namlikni ushlab qoladi', 'Quruq va suvsizlangan teri', 'Ustidan krem surting'],
      ['Salyangoz mutsini', 'Tiklaydi, namlaydi', 'Quruq, charchagan teri', 'Allergiya boʻlsa — sinab koʻring'],
      ['Retinol', 'Ajin va notekis rang', '25+ yosh, kechqurun', 'Homiladorlikda mumkin emas, SPF shart'],
      ['BHA', 'Poralarni ichidan tozalaydi', 'Yogʻli, toshmali teri', 'Haftasiga 2–3 marta, SPF bilan'],
      ['Galactomyces', 'Yorqinlik va tekis rang', 'Xira, charchagan teri', 'Yangi boshlovchiga ham mos'],
      ['Pantenol', 'Tiklaydi, tirnashni oladi', 'Har qanday teri', 'Xavfsiz'],
    ]
    for (const [i, [name, does, who, care]] of IG.entries()) {
      const g = await payload.create({ collection: 'ingredients', locale: 'uz', data: { name, does, who, care, order: i } })
      await payload.update({ collection: 'ingredients', id: g.id, locale: 'ru', data: { name: R(name), does: R(does), who: R(who), care: R(care) } })
    }
  }
  // legal pages: titles only — the text comes from the owner / lawyer
  for (const [slug, uz, ru2] of [['oferta', 'Ommaviy oferta', 'Публичная оферта'], ['maxfiylik', 'Maxfiylik siyosati', 'Политика конфиденциальности']]) {
    if ((await payload.find({ collection: 'legal-pages', where: { slug: { equals: slug } }, limit: 1 })).docs.length) continue
    const d = await payload.create({ collection: 'legal-pages', locale: 'uz', data: { slug, title: uz } })
    await payload.update({ collection: 'legal-pages', id: d.id, locale: 'ru', data: { title: ru2 } })
  }

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
