import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic' // reads the site state (admin → Sayt holati) at runtime

import { siteUrl } from '@/lib/site'
import { isSiteClosed } from '@/lib/site-state'

// Personal and transactional pages stay out of search; filters/search results are noindex on the page itself.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = siteUrl()
  // closed test site (admin → Sayt holati, or SITE_NOINDEX / SITE_PASSWORD) or a non-https / local address: nothing is indexed
  const live = site.startsWith('https://') && !site.includes('localhost') && !(await isSiteClosed())
  return {
    rules: live
      ? [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/*/savat', '/*/rasmiylashtirish', '/*/kabinet', '/*/kirish', '/*/buyurtma/', '/*/tolov/', '/*/dev/', '/*/sevimlilar'] }]
      : [{ userAgent: '*', disallow: '/' }], // test/staging hosts are never indexed
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
