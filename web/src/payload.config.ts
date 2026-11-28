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
import { Waitlist } from './collections/waitlist'
import { Integrations } from './collections/integrations'
import { SiteState } from './collections/site-state'
import { Expenses, FinanceSettings } from './collections/finance'
import { ReminderLog, ReminderSettings } from './collections/reminders'
import { uz } from './collections/labels'
import { en } from '@payloadcms/translations/languages/en'
import { ru } from '@payloadcms/translations/languages/ru'
import { Articles, Customers, GiftCards, Ingredients, LegalPages, LoginCodes, Orders, Payments, PromoCodes, SearchLog, Segments } from './collections/shop'

// Scripts outside the site (seed, e2e-reset) set YEPPO_SCRIPT=1: hooks that load server-only code stay quiet there
// (loading it outside Next can crash the script even inside try/catch).
const inScript = () => process.env.YEPPO_SCRIPT === '1'

const INDEXED: Record<string, string> = { products: '/mahsulot', articles: '/jurnal' }
const indexNow = <C extends CollectionConfig>(c: C): C => !INDEXED[c.slug] ? c : ({
  ...c,
  hooks: { ...c.hooks, afterChange: [...(c.hooks?.afterChange ?? []), async ({ doc }: { doc: { slug?: string } }) => {
    // best effort: a failed announcement (or a script running outside the site) must never fail the save
    try { if (doc.slug && !inScript()) (await import('@/lib/indexnow')).notifyChanged(`${INDEXED[c.slug]}/${doc.slug}`) } catch { /* not announced */ }
  }] },
})

// Customer Telegram messages: an order's new status, and "back in stock". Registered here for the same reason:
// best effort, server only, never fails a save.
type Doc = Record<string, any>
const telegramHooks = <C extends CollectionConfig>(c: C): C => {
  if (c.slug === 'orders') {
    return { ...c, hooks: { ...c.hooks, afterChange: [...(c.hooks?.afterChange ?? []), async ({ doc, previousDoc, operation }: { doc: Doc; previousDoc?: Doc; operation: string }) => {
      try { if (!inScript() && operation === 'update' && previousDoc && doc.status !== previousDoc.status) await (await import('@/lib/telegram-bot')).notifyOrderStatus(doc as never) } catch { /* not sent */ }
    }] } }
  }
  if (c.slug === 'products') {
    return { ...c, hooks: { ...c.hooks, afterChange: [...(c.hooks?.afterChange ?? []), async ({ doc, previousDoc }: { doc: Doc; previousDoc?: Doc }) => {
      try {
        const before = new Map<string, number>(((previousDoc?.variants ?? []) as { sku: string; stock?: number }[]).map((v) => [v.sku, v.stock ?? 0]))
        for (const v of (doc.variants ?? []) as { sku: string; stock?: number }[]) {
          if (!inScript() && (v.stock ?? 0) > 0 && (before.get(v.sku) ?? 0) <= 0 && previousDoc) await (await import('@/lib/telegram-bot')).notifyBackInStock(v.sku, doc.name, doc.slug)
        }
      } catch { /* not sent */ }
    }] } }
  }
  return c
}

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
        search: { Component: '/components/admin/SearchView#SearchView', path: '/qidiruv' },
        finance: { Component: '/components/admin/FinanceView#FinanceView', path: '/moliya' },
      },
    },
  },
  // order = order of the groups in the admin menu: Savdo, Katalog, Sayt, then settings
  // search engines hear about a new or changed product / article at once (Integratsiyalar → IndexNow).
  // Registered here, not in the collection files: those are also imported by browser code.
  collections: ([Orders, Payments, PromoCodes, GiftCards, Customers, ReminderLog, Expenses, Products, Brands, Categories, Media, PriceHistory, Reviews, Banners, Segments, Articles, Ingredients, LegalPages, SearchLog, LoginCodes, AnalyticsEvents, Waitlist, Users].map(uz.collection)).map(indexNow).map(telegramHooks),
  globals: [SiteState, Store, ReminderSettings, FinanceSettings, Integrations].map(uz.global),
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
