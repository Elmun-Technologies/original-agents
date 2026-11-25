import 'server-only'

import { loadIntegrations } from '@/lib/integrations'
import { SERVICES, statusOf } from '@/lib/integrations-def'
import { payload } from '@/lib/catalog'
import { hasText } from '@/lib/seo-audit-load'
import { closedSite } from '@/lib/seo'
import { siteUrl } from '@/lib/site'
import { buildChecklist } from './readiness'

export async function loadChecklist() {
  const p = await payload()
  const ig = await loadIntegrations(true)
  const v = ig.values
  const ready = (id: string) => statusOf(SERVICES.find((s) => s.id === id)!, v) === 'on'
  const [store, legal, prods, admins, events] = await Promise.all([
    p.findGlobal({ slug: 'store', depth: 0, overrideAccess: true }),
    p.find({ collection: 'legal-pages', depth: 0, limit: 20, overrideAccess: true }),
    p.find({ collection: 'products', depth: 0, limit: 5000, pagination: false, overrideAccess: true, where: { 'category.slug': { not_equals: 'sertifikatlar' } } }),
    p.count({ collection: 'users', overrideAccess: true }),
    p.db ? ((p.db as unknown as { pool: { query: (s: string) => Promise<{ rows: { n: string }[] }> } }).pool.query('SELECT count(*) n FROM analytics_events')) : { rows: [{ n: '0' }] },
  ])
  const site = siteUrl()
  const real = prods.docs.filter((x) => !x.sample)
  const body = (slug: string) => hasText(legal.docs.find((d) => d.slug === slug)?.body)
  return buildChecklist({
    closed: closedSite(), https: site.startsWith('https://'), ownDomain: site.startsWith('https://') && !/localhost|sslip\.io|traefik\.me|nip\.io/.test(site),
    paymentsLive: v.paymentsMode === 'live', clickReady: ready('click'), paymeReady: ready('payme'), cardProvider: v.cardProvider === 'click' ? 'click' : 'payme',
    smsLive: v.smsMode === 'live', eskizReady: ready('eskiz'), telegramReady: ready('telegram'), secretsUnreadable: ig.unreadable.length,
    google: !!v.googleVerification, yandex: !!v.yandexVerification, ga4: !!v.ga4Id, metrica: !!v.metricaId, meta: !!v.metaPixelId, indexNow: v.indexNowOn === true,
    contacts: { phone: !!store.phone?.trim(), telegramUrl: !!store.telegramUrl && store.telegramUrl !== 'https://t.me/', telegramBot: !!store.telegramBotUrl && store.telegramBotUrl !== 'https://t.me/' },
    legal: { oferta: body('oferta'), maxfiylik: body('maxfiylik') },
    products: {
      real: real.length, sample: prods.docs.length - real.length,
      noStock: real.filter((x) => !x.variants?.some((y) => (y.stock ?? 0) > 0)).length, noBatch: real.filter((x) => !x.batch || !x.expiresAt).length,
    },
    admins: admins.totalDocs, trackerEvents: Number(events.rows[0]?.n ?? 0),
  })
}
