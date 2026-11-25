// The tracked link for a post or an ad (also used in the browser by the link builder): utm_* values are lower-cased plain words.
/** the tracked link for a post or an ad: utm_* values are lower-cased plain words */
export function trackedLink(site: string, path: string, o: { source: string; medium: string; campaign: string }): string {
  const clean = (s: string) => s.toLowerCase().trim().replace(/[^\p{L}\p{N}_.\-+]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  const q = new URLSearchParams()
  if (clean(o.source)) q.set('utm_source', clean(o.source))
  if (clean(o.medium)) q.set('utm_medium', clean(o.medium))
  if (clean(o.campaign)) q.set('utm_campaign', clean(o.campaign))
  const p = path.startsWith('/') ? path : `/${path}`
  return `${site.replace(/\/$/, '')}${p}${q.toString() ? `?${q}` : ''}`
}
