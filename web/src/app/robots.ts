import type { MetadataRoute } from 'next'

import { siteUrl } from '@/lib/site'

// Personal and transactional pages stay out of search; filters/search results are noindex on the page itself.
export default function robots(): MetadataRoute.Robots {
  const site = siteUrl()
  const live = site.startsWith('https://') && !site.includes('localhost')
  return {
    rules: live
      ? [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/*/savat', '/*/rasmiylashtirish', '/*/kabinet', '/*/kirish', '/*/buyurtma/', '/*/tolov/', '/*/dev/', '/*/sevimlilar'] }]
      : [{ userAgent: '*', disallow: '/' }], // test/staging hosts are never indexed
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
