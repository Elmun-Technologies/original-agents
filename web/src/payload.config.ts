import { postgresAdapter } from '@payloadcms/db-postgres'

import { migrations } from './migrations'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Banners, Brands, Categories, PriceHistory, Products, Reviews, Store } from './collections/catalog'
import { Integrations } from './collections/integrations'
import { Articles, Customers, GiftCards, Ingredients, LegalPages, LoginCodes, Orders, Payments, PromoCodes, SearchLog, Segments } from './collections/shop'

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
      afterNavLinks: ['/components/admin/NavLinks#NavLinks'],
      views: {
        integrations: { Component: '/components/admin/IntegrationsView#IntegrationsView', path: '/integratsiyalar' },
      },
    },
  },
  collections: [Orders, Payments, PromoCodes, GiftCards, Customers, LoginCodes, Products, Brands, Categories, PriceHistory, Reviews, Banners, Segments, SearchLog, LegalPages, Articles, Ingredients, Media, Users],
  globals: [Store, Integrations],
  localization: {
    locales: [
      { code: 'uz', label: 'Oʻzbekcha' },
      { code: 'ru', label: 'Русский' },
    ],
    defaultLocale: 'uz',
    fallback: true,
  },
  i18n: { fallbackLanguage: 'en' },
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
