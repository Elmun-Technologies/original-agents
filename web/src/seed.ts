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

const CATS: [slug: string, uz: string, ru: string, types: string[]][] = [
  ['serum', 'Serum va ampulalar', 'Сыворотки и ампулы', ['Ampula', 'Serum']],
  ['toner', 'Tonerlar va padlar', 'Тонеры и пэды', ['Toner']],
  ['essensiya', 'Essensiyalar', 'Эссенции', ['Essensiya']],
  ['krem', 'Kremlar', 'Кремы', ['Krem']],
  ['tozalash', 'Tozalovchilar', 'Очищение', ['Tozalovchi']],
  ['spf', 'Quyoshdan himoya', 'Защита от солнца', ['SPF']],
  ['niqoblar', 'Niqoblar', 'Маски', ['Niqob']],
  ['toplamlar', 'Toʻplamlar', 'Наборы', ['Toʻplam']],
]
// concerns per sample product (from the design's picker mapping, p_main.py ndMap)
const CONCERNS: Record<string, ('acne' | 'pores' | 'pigment' | 'dryness' | 'wrinkles' | 'dull')[]> = {
  amp: ['acne', 'pores'], toner: ['acne', 'dull'], snail: ['acne', 'dryness'], ess: ['dryness', 'dull'], revive: ['dryness'],
  baha: ['dull', 'pores'], pore: ['pores'], cream: ['dryness'], clean: ['pores'], mask: ['acne'], spf: [], set: ['dull'],
}
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function main() {
  const payload = await getPayload({ config: await config })
  const { products } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.sample.json'), 'utf8'))

  const one = async (collection: any, slug: string, create: () => Promise<any>) =>
    (await payload.find({ collection, where: { slug: { equals: slug } }, limit: 1 })).docs[0] ?? create()

  const cats: Record<string, any> = {}
  for (const [i, [slug, uz, ru, types]] of CATS.entries()) {
    const doc = await one('categories', slug, async () => {
      const c = await payload.create({ collection: 'categories', data: { slug, title: uz, order: i }, locale: 'uz' })
      await payload.update({ collection: 'categories', id: c.id, data: { title: ru }, locale: 'ru' })
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
        variants: [{ volume: s.vol || undefined, sku, price: s.price, stock: 10 }],
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
  const routine = (await Promise.all(['toner', 'amp', 'spf'].map(bySku))).filter(Boolean) as number[]
  await payload.updateGlobal({ slug: 'store', data: { homeRoutine: routine } })

  payload.logger.info(`seed: ${made} ta yangi mahsulot${demo ? ' (+ namuna eski narxlar)' : ''}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
