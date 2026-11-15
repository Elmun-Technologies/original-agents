import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic' // reads SITE_PASSWORD / SITE_NOINDEX at runtime

import { siteUrl } from '@/lib/site'

// Personal and transactional pages stay out of search; filters/search results are noindex on the page itself.
export default function robots(): MetadataRoute.Robots {
  const site = siteUrl()
  // closed test site (SITE_NOINDEX / SITE_PASSWORD) or a non-https / local address: nothing is indexed
  const live = site.startsWith('https://') && !site.includes('localhost') && process.env.SITE_NOINDEX !== '1' && !process.env.SITE_PASSWORD
  return {
    rules: live
      ? [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/*/savat', '/*/rasmiylashtirish', '/*/kabinet', '/*/kirish', '/*/buyurtma/', '/*/tolov/', '/*/dev/', '/*/sevimlilar'] }]
      : [{ userAgent: '*', disallow: '/' }], // test/staging hosts are never indexed
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
