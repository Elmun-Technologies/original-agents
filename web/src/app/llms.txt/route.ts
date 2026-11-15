// llms.txt (llmstxt.org): a short map of the shop for AI assistants and answer engines.
import { getStore, payload } from '@/lib/catalog'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic' // reads the database (not available while the Docker image builds)

export async function GET() {
  const site = siteUrl()
  const p = await payload()
  const [store, cats, brands, articles] = await Promise.all([
    getStore(),
    p.find({ collection: 'categories', depth: 0, limit: 100, pagination: false, locale: 'uz', where: { parent: { exists: true } }, select: { slug: true, title: true } }),
    p.find({ collection: 'brands', depth: 0, limit: 200, pagination: false, where: { slug: { not_equals: 'yeppo' } }, sort: 'name', select: { slug: true, name: true } }),
    p.find({ collection: 'articles', depth: 0, limit: 50, pagination: false, locale: 'uz', sort: '-publishedAt', select: { slug: true, title: true } }),
  ])
  const body = `# Yeppo

> Yeppo — internet shop of original Korean skincare in Tashkent, Uzbekistan. Site languages: Uzbek (/uz) and Russian (/ru).
> Prices are in Uzbek soʻm. Delivery: Tashkent ${store.tashkentDays} day(s), regions ${store.regionDays} days. Unopened products can be returned within ${store.returnDays} days.

## Catalog
- [Face care](${site}/uz/yuz-parvarishi)
${cats.docs.filter((c) => c.slug !== 'sertifikatlar').map((c) => `- [${c.title}](${site}/uz/katalog/${c.slug})`).join('\n')}
- [Sale and best sellers](${site}/uz/aksiyalar)
- [Gifts and gift certificates](${site}/uz/sovgalar)

## Brands
${brands.docs.map((b) => `- [${b.name}](${site}/uz/brend/${b.slug})`).join('\n')}

## Help
- [Delivery](${site}/uz/yordam/yetkazish)
- [Payment](${site}/uz/yordam/tolov)
- [Returns](${site}/uz/yordam/qaytarish)
- [How we guarantee originals](${site}/uz/yordam/originallik)
- [Contacts](${site}/uz/yordam/aloqa)

## Journal
${articles.docs.map((a) => `- [${a.title}](${site}/uz/jurnal/${a.slug})`).join('\n')}

## Optional
- [Sitemap](${site}/sitemap.xml)
`
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
