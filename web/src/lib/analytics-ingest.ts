// What the browser may tell our own analytics, and nothing more. Pure functions (no database, no framework):
// every field is checked, cut and whitelisted before it is stored, so the endpoint cannot be used to fill the
// database with junk or to store personal data. No IP address, no user agent, no full URL, no query string,
// no name/phone/address is ever stored.

export type Row = {
  name: string; visitor: string; session: string; path: string; lang: string; device: string
  ref: string | null; src: string | null; med: string | null; cmp: string | null; data: Record<string, unknown> | null
}

export const MAX_BODY = 24_000
export const MAX_EVENTS = 40
const NAMES = new Set(['pageview', 'click', 'scroll', 'vitals', 'add_to_cart', 'search'])
const ID = /^[a-f0-9]{8,32}$/
const HOST = /^[a-z0-9]([a-z0-9.-]{0,58}[a-z0-9])?$/
const LABEL = /^[\p{L}\p{N} _.\-+/@:]{1,40}$/u
const PATH = /^\/(uz|ru)(\/[A-Za-z0-9\-_.%]{1,120}){0,5}\/?$/
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|lighthouse|pagespeed|preview|monitor|uptime|curl|wget|python-requests|go-http-client/i

export const isBot = (ua: string | null | undefined) => !ua || BOT.test(ua)

const label = (v: unknown) => (typeof v === 'string' && LABEL.test(v.trim()) ? v.trim().toLowerCase() : null)
const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null)
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max) : '')

/** the path without the order number (an order link carries a secret and a personal order) */
export function cleanPath(p: unknown): string | null {
  if (typeof p !== 'string' || p.length > 200) return null
  const path = p.split(/[?#]/)[0]
  if (!PATH.test(path) || path.split('/').some((seg) => /^\.+$/.test(seg) || /^(%2e)+$/i.test(seg))) return null // no ".." segments
  return path.replace(/\/(buyurtma|tolov)\/[^/]+/, '/$1').replace(/(.)\/$/, '$1')
}

function dataFor(name: string, e: Record<string, unknown>): Record<string, unknown> | null {
  switch (name) {
    case 'click': {
      const x = typeof e.x === 'number' && e.x >= 0 && e.x <= 1 ? Math.round(e.x * 10_000) / 10_000 : null
      const y = int(e.y, 0, 60_000), w = int(e.w, 200, 4000), h = int(e.h, 0, 60_000)
      return x === null || y === null || w === null ? null : { x, y, w, h, t: text(e.t, 40) }
    }
    case 'scroll': { const d = int(e.depth, 0, 100); return d === null ? null : { depth: d } }
    case 'vitals': {
      const out: Record<string, number> = {}
      const lcp = int(e.lcp, 0, 60_000), inp = int(e.inp, 0, 60_000)
      if (lcp !== null) out.lcp = lcp
      if (inp !== null) out.inp = inp
      if (typeof e.cls === 'number' && Number.isFinite(e.cls)) out.cls = Math.round(Math.min(10, Math.max(0, e.cls)) * 1000) / 1000
      return Object.keys(out).length ? out : null
    }
    case 'add_to_cart': {
      const sku = text(e.sku, 40), slug = text(e.slug, 80)
      return sku ? { sku, slug, price: int(e.price, 0, 100_000_000) ?? 0, qty: int(e.qty, 1, 99) ?? 1 } : null
    }
    case 'search': { const q = text(e.q, 80).toLowerCase(); return q.length >= 2 ? { q } : null }
    default: return {}
  }
}

/** body = what the tracker sends; returns the rows to store (invalid events are dropped one by one) */
export function parseBatch(body: unknown): Row[] {
  if (!body || typeof body !== 'object') return []
  const b = body as Record<string, unknown>
  const visitor = typeof b.v === 'string' && ID.test(b.v) ? b.v : null
  const session = typeof b.s === 'string' && ID.test(b.s) ? b.s : null
  if (!visitor || !session || !Array.isArray(b.e)) return []
  const device = ['mobile', 'tablet', 'desktop'].includes(String(b.d)) ? String(b.d) : 'desktop'
  const a = (b.a && typeof b.a === 'object' ? b.a : {}) as Record<string, unknown>
  const ref = typeof b.r === 'string' && HOST.test(b.r.toLowerCase()) ? b.r.toLowerCase() : null
  const rows: Row[] = []
  for (const raw of b.e.slice(0, MAX_EVENTS)) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as Record<string, unknown>
    const name = String(e.n)
    const path = cleanPath(e.p)
    if (!NAMES.has(name) || !path) continue
    const data = dataFor(name, e)
    if (data === null) continue
    rows.push({ name, visitor, session, path, lang: path.slice(1, 3), device, ref, src: label(a.s), med: label(a.m), cmp: label(a.c), data: Object.keys(data).length ? data : null })
  }
  return rows
}

/** first-party attribution cookie "yp_a" = encodeURIComponent(JSON {s,m,c,l}); also visitor "yp_v" and session "yp_s" */
export function readCookies(header: string | null | undefined) {
  const jar = new Map<string, string>()
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1).trim())
  }
  let a: Record<string, unknown> = {}
  try { a = JSON.parse(decodeURIComponent(jar.get('yp_a') ?? '')) ?? {} } catch { /* tampered or absent */ }
  const id = (k: string) => { const v = jar.get(k); return v && ID.test(v) ? v : null }
  return {
    visitor: id('yp_v'), session: id('yp_s'),
    src: label(a.s), med: label(a.m), cmp: label(a.c),
    landing: typeof a.l === 'string' && cleanPath(a.l) ? cleanPath(a.l) : null,
    hasAdmin: jar.has('payload-token'),
  }
}

/** a small fixed-window limiter per client key; the map cleans itself */
export function makeLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; at: number }>()
  return (key: string, cost = 1, now = Date.now()) => {
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.at > windowMs) hits.delete(k)
    const h = hits.get(key)
    if (!h || now - h.at > windowMs) { hits.set(key, { n: cost, at: now }); return true }
    h.n += cost
    return h.n <= max
  }
}
