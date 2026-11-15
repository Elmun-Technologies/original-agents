// Site address from one setting (NEXT_PUBLIC_SITE_URL), without a trailing slash.
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
