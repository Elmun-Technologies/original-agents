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
        skin: s.skin, tags, images: [image.id], sample: true,
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
  payload.logger.info(`seed: ${made} ta yangi mahsulot${demo ? ' (+ namuna eski narxlar)' : ''}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
