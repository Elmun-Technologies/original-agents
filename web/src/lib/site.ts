// Site address: ONE runtime setting, SITE_URL (e.g. https://yeppo.uz). Changing the domain = change it + restart.
// NEXT_PUBLIC_SITE_URL is the old name, still read for local .env files (Next inlines it at build time).
// If SITE_URL arrives without a scheme (e.g. Coolify's bare *.sslip.io host), prefix https:// so
// new URL(siteUrl()) in layout metadataBase never throws TypeError: Invalid URL.
export const siteUrl = () => {
  let url = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  return url
}
