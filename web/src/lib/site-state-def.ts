// Is the site open to customers and search engines, and does it take orders? Decided in the admin panel
// (Sozlamalar → Sayt holati), so the owner never has to touch the server. Pure rules, no server code (used by the
// proxy, the pages and the tests alike).
//
// mode "env"    — as the server is set up (SITE_PASSWORD / SITE_NOINDEX in Coolify). The old behaviour.
// mode "open"   — open to everyone, Google and Yandex index it. Ignores SITE_PASSWORD / SITE_NOINDEX.
// mode "closed" — test site: password (user "yeppo", the server's SITE_PASSWORD) + noindex everywhere.

export type SiteMode = 'env' | 'open' | 'closed'
export type SiteResolved = { mode: SiteMode; locked: boolean; noindex: boolean; ordersEnabled: boolean }
type Env = Record<string, string | undefined>

export const SITE_MODES: { value: SiteMode; label: string }[] = [
  { value: 'open', label: 'Ochiq — hamma koʻradi, Google va Yandex indekslaydi' },
  { value: 'closed', label: 'Yopiq — parol bilan, qidiruv tizimlari koʻrmaydi (test)' },
  { value: 'env', label: 'Server sozlamasiga qarab (Coolify)' },
]

export const isSiteMode = (v: unknown): v is SiteMode => v === 'env' || v === 'open' || v === 'closed'

export function resolveSite(mode: unknown, ordersEnabled: unknown, env: Env): SiteResolved {
  const m: SiteMode = isSiteMode(mode) ? mode : 'env'
  const orders = ordersEnabled !== false
  if (m === 'open') return { mode: m, locked: false, noindex: false, ordersEnabled: orders }
  const password = !!env.SITE_PASSWORD
  if (m === 'closed') return { mode: m, locked: password, noindex: true, ordersEnabled: orders }
  return { mode: m, locked: password, noindex: password || env.SITE_NOINDEX === '1', ordersEnabled: orders }
}
