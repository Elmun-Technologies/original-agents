// Site address: ONE runtime setting, SITE_URL (e.g. https://yeppo.uz). Changing the domain = change it + restart.
// NEXT_PUBLIC_SITE_URL is the old name, still read for local .env files (Next inlines it at build time).
export const siteUrl = () => (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
