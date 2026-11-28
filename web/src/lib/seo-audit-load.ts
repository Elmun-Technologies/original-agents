import 'server-only'

import { payload } from '@/lib/catalog'
import { loadIntegrations } from '@/lib/integrations'
import { isSiteClosed } from '@/lib/site-state'
import { siteUrl } from '@/lib/site'
import { buildAudit } from './seo-audit'

/** does a Lexical rich-text value contain any actual text */
export function hasText(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false
  const n = v as { text?: string; children?: unknown[]; root?: unknown }
  if (typeof n.text === 'string' && n.text.trim()) return true
  if (n.root && hasText(n.root)) return true
  return Array.isArray(n.children) && n.children.some(hasText)
}

export async function loadAudit() {
  const p = await payload()
  const all = { depth: 0, limit: 2000, pagination: false, overrideAccess: true } as const
  const [uz, ru, cats, arts, ruArts, brands, ig] = await Promise.all([
    p.find({ collection: 'products', locale: 'uz', ...all, where: { 'category.slug': { not_equals: 'sertifikatlar' } } }),
    p.find({ collection: 'products', locale: 'ru', fallbackLocale: false, ...all, where: { 'category.slug': { not_equals: 'sertifikatlar' } } }),
    p.find({ collection: 'categories', locale: 'uz', ...all, where: { and: [{ parent: { exists: true } }, { slug: { not_equals: 'sertifikatlar' } }] } }),
    p.find({ collection: 'articles', locale: 'uz', ...all }),
    p.find({ collection: 'articles', locale: 'ru', fallbackLocale: false, ...all }),
    p.find({ collection: 'brands', locale: 'uz', ...all, where: { slug: { not_equals: 'yeppo' } } }),
    loadIntegrations(),
  ])
  const ruById = new Map(ru.docs.map((d) => [d.id, d]))
  const ruArt = new Map(ruArts.docs.map((d) => [d.id, d]))
  const site = siteUrl(), v = ig.values
  return buildAudit({
    products: uz.docs.map((d) => ({
      id: d.id, name: d.name, hasDescription: hasText(d.description), hasSummary: !!d.summary?.trim(), images: d.images?.length ?? 0,
      price: Math.min(...(d.variants ?? []).map((x) => x.price), Infinity) === Infinity ? 0 : Math.min(...d.variants.map((x) => x.price)),
      hasRuText: !!ruById.get(d.id)?.summary?.trim(), hasBatch: !!d.batch && !!d.expiresAt, hasSeoDescription: !!d.seoDescription?.trim(),
    })),
    categories: cats.docs.map((c) => ({ id: c.id, title: c.title, hasSeoText: !!c.seoText?.trim() })),
    articles: arts.docs.map((a) => ({ id: a.id, title: a.title, hasExcerpt: !!a.excerpt?.trim(), hasCover: !!a.cover, hasRuTitle: !!ruArt.get(a.id)?.title?.trim() })),
    brands: brands.docs.map((b) => ({ id: b.id, name: b.name, hasAbout: !!b.about?.trim() })),
    site: {
      closed: await isSiteClosed(), https: site.startsWith('https://'), ownDomain: site.startsWith('https://') && !/localhost|sslip\.io|traefik\.me|nip\.io/.test(site),
      google: !!v.googleVerification, yandex: !!v.yandexVerification, analytics: !!(v.ga4Id || v.metricaId), indexNow: v.indexNowOn === true && !!v.indexNowKey,
    },
  })
}
