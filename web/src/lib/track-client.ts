// Browser side of our own analytics. Small, no dependencies, no personal data: a random visitor id and a random
// session id (first-party cookies, no IP, no name), the page path, where the visitor came from, clicks as page
// coordinates, scroll depth and speed. Events are batched and sent with sendBeacon to /api/t (see lib/analytics-ingest.ts).
// Import only from client components.

type Ev = Record<string, unknown> & { n: string; p: string }
type Attr = { s?: string; m?: string; c?: string; l?: string }

const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')
const getCookie = (k: string) => document.cookie.split('; ').find((c) => c.startsWith(k + '='))?.slice(k.length + 1)
const setCookie = (k: string, v: string, seconds: number) => {
  document.cookie = `${k}=${v}; max-age=${seconds}; path=/; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
}

const SEARCH = /(^|\.)(google|yandex|bing|duckduckgo|yahoo|baidu)\./
const SOCIAL: [RegExp, string][] = [[/(^|\.)instagram\.com$/, 'instagram'], [/(^|\.)(facebook|fb)\.com$|^l\.facebook\.com$/, 'facebook'], [/^t\.me$|(^|\.)telegram\.(org|me)$/, 'telegram'], [/(^|\.)tiktok\.com$/, 'tiktok'], [/(^|\.)youtube\.com$/, 'youtube']]

/** where this visit came from: utm_* first, else the referring site; null = direct or from our own site */
export function sourceOf(url: URL, referrer: string): Attr | null {
  const q = url.searchParams
  const utm = q.get('utm_source')
  if (utm) return { s: utm.toLowerCase().slice(0, 40), m: (q.get('utm_medium') ?? 'link').toLowerCase().slice(0, 40), c: (q.get('utm_campaign') ?? '').toLowerCase().slice(0, 40) || undefined }
  let host = ''
  try { host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '') } catch { return null }
  if (!host || host === url.hostname.replace(/^www\./, '')) return null
  const social = SOCIAL.find(([re]) => re.test(host))
  if (social) return { s: social[1], m: 'social' }
  const engine = SEARCH.test(host) ? host.split('.').filter((x) => !['www', 'com', 'ru', 'uz', 'co'].includes(x))[0] : null
  if (engine) return { s: engine, m: 'organic' }
  return { s: host.slice(0, 40), m: 'referral' }
}

const device = () => (innerWidth < 768 ? 'mobile' : innerWidth < 1100 ? 'tablet' : 'desktop')
const attr = (): Attr => { try { return JSON.parse(decodeURIComponent(getCookie('yp_a') ?? '')) ?? {} } catch { return {} } }

const queue: Ev[] = []
let timer: ReturnType<typeof setTimeout> | undefined
let started = false
let refHost: string | undefined

function ids() {
  let v = getCookie('yp_v')
  if (!v || !/^[a-f0-9]{16}$/.test(v)) { v = rid(); setCookie('yp_v', v, 400 * 86400) }
  let s = getCookie('yp_s')
  if (!s || !/^[a-f0-9]{16}$/.test(s)) s = rid()
  setCookie('yp_s', s, 30 * 60) // a session ends after 30 minutes without activity
  return { v, s }
}

export function flush() {
  clearTimeout(timer); timer = undefined
  if (!queue.length) return
  const { v, s } = ids()
  const a = attr()
  const body = JSON.stringify({ v, s, d: device(), a, r: refHost, e: queue.splice(0, 40) })
  try {
    if (!navigator.sendBeacon?.('/api/t', new Blob([body], { type: 'text/plain' }))) void fetch('/api/t', { method: 'POST', body, keepalive: true })
  } catch { /* analytics must never break the page */ }
}

type Tags = { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void; ym?: (id: string, ev: string, target?: string) => void; __ymId?: string }
/** the same event for the connected Google / Meta / Yandex tags (if the owner connected them) */
function fanOut(n: string, data: Record<string, unknown>) {
  const w = window as unknown as Tags
  try {
    if (n === 'add_to_cart') {
      const value = Number(data.price ?? 0) * Number(data.qty ?? 1)
      w.gtag?.('event', 'add_to_cart', { currency: 'UZS', value, items: [{ item_id: data.sku, quantity: data.qty }] })
      w.fbq?.('track', 'AddToCart', { currency: 'UZS', value, content_ids: [data.sku] })
      if (w.__ymId) w.ym?.(w.__ymId, 'reachGoal', 'add_to_cart')
    }
  } catch { /* a blocked or broken tag must not break the shop */ }
}

export function track(n: string, p: string, data: Record<string, unknown> = {}) {
  fanOut(n, data)
  queue.push({ n, p, ...data })
  if (queue.length >= 20) flush()
  else timer ??= setTimeout(flush, 4000)
}

/** call once per page load: remembers the source of the visit (last non-direct touch, 30 days) */
export function start() {
  if (started) return
  started = true
  const found = sourceOf(new URL(location.href), document.referrer)
  if (found) {
    setCookie('yp_a', encodeURIComponent(JSON.stringify({ ...found, l: location.pathname })), 30 * 86400)
    try { const h = new URL(document.referrer).hostname.toLowerCase(); if (h && h !== location.hostname) refHost = h.slice(0, 60) } catch { /* direct */ }
  } else if (!attr().l) {
    setCookie('yp_a', encodeURIComponent(JSON.stringify({ l: location.pathname })), 30 * 86400)
  }
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
  addEventListener('pagehide', flush)
}
