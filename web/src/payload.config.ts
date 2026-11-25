import { postgresAdapter } from '@payloadcms/db-postgres'

import { migrations } from './migrations'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, type CollectionConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Banners, Brands, Categories, PriceHistory, Products, Reviews, Store } from './collections/catalog'
import { AnalyticsEvents } from './collections/analytics'
import { Integrations } from './collections/integrations'
import { uz } from './collections/labels'
import { en } from '@payloadcms/translations/languages/en'
import { ru } from '@payloadcms/translations/languages/ru'
import { Articles, Customers, GiftCards, Ingredients, LegalPages, LoginCodes, Orders, Payments, PromoCodes, SearchLog, Segments } from './collections/shop'

const INDEXED: Record<string, string> = { products: '/mahsulot', articles: '/jurnal' }
const indexNow = <C extends CollectionConfig>(c: C): C => !INDEXED[c.slug] ? c : ({
  ...c,
  hooks: { ...c.hooks, afterChange: [...(c.hooks?.afterChange ?? []), async ({ doc }: { doc: { slug?: string } }) => { if (doc.slug) (await import('@/lib/indexnow')).notifyChanged(`${INDEXED[c.slug]}/${doc.slug}`) }] },
})

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: { titleSuffix: ' — Yeppo admin' },
    components: {
      beforeNavLinks: ['/components/admin/NavLinks#NavLinks'],
      beforeDashboard: ['/components/admin/DashboardWidget#DashboardWidget'],
      views: {
        analytics: { Component: '/components/admin/AnalyticsView#AnalyticsView', path: '/analitika' },
        heatmap: { Component: '/components/admin/HeatmapView#HeatmapView', path: '/heatmap' },
        marketing: { Component: '/components/admin/MarketingView#MarketingView', path: '/marketing' },
        seo: { Component: '/components/admin/SeoView#SeoView', path: '/seo' },
        readiness: { Component: '/components/admin/ReadinessView#ReadinessView', path: '/tayyorlik' },
        integrations: { Component: '/components/admin/IntegrationsView#IntegrationsView', path: '/integratsiyalar' },
      },
    },
  },
  // order = order of the groups in the admin menu: Savdo, Katalog, Sayt, then settings
  // search engines hear about a new or changed product / article at once (Integratsiyalar → IndexNow).
  // Registered here, not in the collection files: those are also imported by browser code.
  collections: ([Orders, Payments, PromoCodes, GiftCards, Customers, Products, Brands, Categories, Media, PriceHistory, Reviews, Banners, Segments, Articles, Ingredients, LegalPages, SearchLog, LoginCodes, AnalyticsEvents, Users].map(uz.collection)).map(indexNow),
  globals: [Store, Integrations].map(uz.global),
  localization: {
    locales: [
      { code: 'uz', label: 'Oʻzbekcha' },
      { code: 'ru', label: 'Русский' },
    ],
    defaultLocale: 'uz',
    fallback: true,
  },
  // the admin buttons (Save, Delete …) in Russian: Payload has no Uzbek; our own screens and field names are Uzbek
  i18n: { supportedLanguages: { ru, en }, fallbackLanguage: 'ru' },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI || '' },
    migrationDir: path.resolve(dirname, 'migrations'),
    // production: pending migrations run when the server starts (dev keeps using schema push)
    prodMigrations: migrations,
  }),
  sharp,
  plugins: [],
})
