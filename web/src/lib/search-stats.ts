import 'server-only'
import crypto from 'node:crypto'

import { serviceAccountOf, type Values } from './integrations-def'
import { integrations } from './integrations'
import { siteUrl } from './site'

// What people typed in Google and Yandex before they came to the site, read from Google Search Console and
// Yandex Vebmaster with the owner's own keys (Integratsiyalar). Nothing is stored: answers are kept in memory for an
// hour (both services update their numbers about once a day). Messages are for the owner (Uzbek), never contain a key.

export type QueryRow = { query: string; clicks: number; impressions: number; ctr: number; position: number }
export type PageRow = { page: string; clicks: number; impressions: number; ctr: number; position: number }
export type DayRow = { date: string; clicks: number; impressions: number }
export type Report<T> = { ok: true; data: T } | { ok: false; reason: 'not_connected' | 'error'; message: string }
export type GoogleStats = { property: string; totals: { clicks: number; impressions: number; ctr: number; position: number }; queries: QueryRow[]; pages: PageRow[]; days: DayRow[] }
export type YandexStats = { host: string; queries: QueryRow[]; indexed?: number; excluded?: number; sqi?: number }

type Fetch = typeof fetch
const DAY = 86_400_000
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d

/** Google and Yandex numbers trail by 2–3 days: the window ends 2 days ago. */
export function dateWindow(days: number, now = Date.now()) {
  const end = new Date(now - 2 * DAY)
  return { start: ymd(new Date(end.getTime() - (days - 1) * DAY)), end: ymd(end) }
}

// ---------- Google Search Console ----------

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url')

/** A signed JWT that Google trades for an access token (service account, read-only Search Console scope). */
export function googleAssertion(email: string, privateKey: string, now = Date.now()) {
  const iat = Math.floor(now / 1000)
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }))
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claims}`).sign(privateKey)
  return `${head}.${claims}.${b64url(sig)}`
}

let gToken: { v: string; at: number; email: string } | null = null
async function googleToken(email: string, key: string, f: Fetch): Promise<string> {
  if (gToken && gToken.email === email && Date.now() - gToken.at < 50 * 60_000) return gToken.v
  const r = await f('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: googleAssertion(email, key) }).toString(),
  })
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; error?: string }
  if (!r.ok || !j.access_token) throw new SearchError(`Google kalitni qabul qilmadi (${j.error ?? r.status}). JSON faylni qayta yuklab, toʻliq qoʻying.`)
  gToken = { v: j.access_token, at: Date.now(), email }
  return j.access_token
}

class SearchError extends Error {}

/** the Search Console property: what the owner wrote, else the site address ("URL prefix" property) */
export const gscProperty = (v: Values, site = siteUrl()) => (typeof v.gscProperty === 'string' && v.gscProperty.trim()) || `${site}/`

async function gscQuery(token: string, property: string, body: object, f: Fetch) {
  const r = await f(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
  })
  if (r.status === 403) throw new SearchError(`Xizmat akkauntiga «${property}» ga ruxsat berilmagan. Search Console → Settings → Users and permissions → Add user: xizmat akkaunti emaili.`)
  if (r.status === 404) throw new SearchError(`Search Console’da «${property}» topilmadi. Sayt Search Console’ga qoʻshilgan va tasdiqlanganini tekshiring yoki «Search Console’dagi sayt» maydonini toʻgʻrilang.`)
  if (!r.ok) throw new SearchError(`Google javobi: ${r.status}.`)
  return ((await r.json()) as { rows?: { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }).rows ?? []
}

export async function googleStats(days: number, v?: Values, f: Fetch = fetch): Promise<Report<GoogleStats>> {
  const vals = v ?? (await integrations())
  const sa = serviceAccountOf(vals.gscServiceAccount)
  if (!sa) return { ok: false, reason: 'not_connected', message: 'Google Search Console statistikasi ulanmagan: Integratsiyalar → Google Search Console → «Xizmat akkaunti kaliti».' }
  const property = gscProperty(vals)
  try {
    const token = await googleToken(sa.email, sa.key, f)
    const { start, end } = dateWindow(days)
    const base = { startDate: start, endDate: end, dataState: 'all' }
    const [q, p, d, t] = await Promise.all([
      gscQuery(token, property, { ...base, dimensions: ['query'], rowLimit: 100 }, f),
      gscQuery(token, property, { ...base, dimensions: ['page'], rowLimit: 50 }, f),
      gscQuery(token, property, { ...base, dimensions: ['date'], rowLimit: 500 }, f),
      gscQuery(token, property, { ...base }, f),
    ])
    const row = (x: { clicks: number; impressions: number; ctr: number; position: number }) => ({ clicks: x.clicks, impressions: x.impressions, ctr: round(x.ctr * 100), position: round(x.position) })
    return {
      ok: true,
      data: {
        property,
        totals: t[0] ? row(t[0]) : { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        queries: q.map((x) => ({ query: x.keys?.[0] ?? '', ...row(x) })),
        pages: p.map((x) => ({ page: x.keys?.[0] ?? '', ...row(x) })),
        days: d.map((x) => ({ date: x.keys?.[0] ?? '', clicks: x.clicks, impressions: x.impressions })),
      },
    }
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof SearchError ? e.message : 'Google’ga ulanib boʻlmadi (tarmoq).' }
  }
}

// ---------- Yandex Vebmaster ----------

const YA = 'https://api.webmaster.yandex.net/v4'

/** Vebmaster's host id for the site: "https:yeppy.uz:443" */
export const yandexHostId = (site: string) => { const u = new URL(site); return `${u.protocol.replace(':', '')}:${u.hostname}:${u.port || (u.protocol === 'https:' ? '443' : '80')}` }

async function ya(path: string, token: string, f: Fetch) {
  const r = await f(`${YA}${path}`, { headers: { authorization: `OAuth ${token}` }, signal: AbortSignal.timeout(15_000) })
  if (r.status === 401) throw new SearchError('Yandex tokenni qabul qilmadi: token eskirgan yoki notoʻgʻri. Yangisini oling.')
  if (r.status === 403) throw new SearchError('Yandex: bu token bilan saytga ruxsat yoʻq. Token sayt egasi akkauntidan olinganini va «webmaster:hostinfo» huquqi borligini tekshiring.')
  if (r.status === 404) throw new SearchError('Yandex Vebmaster’da sayt topilmadi yoki hali tasdiqlanmagan.')
  if (!r.ok) throw new SearchError(`Yandex javobi: ${r.status}.`)
  return r.json() as Promise<Record<string, any>>
}

export async function yandexStats(days: number, v?: Values, f: Fetch = fetch, site = siteUrl()): Promise<Report<YandexStats>> {
  const vals = v ?? (await integrations())
  const token = typeof vals.yandexOAuth === 'string' ? vals.yandexOAuth.trim() : ''
  if (!token) return { ok: false, reason: 'not_connected', message: 'Yandex Vebmaster statistikasi ulanmagan: Integratsiyalar → Yandex Vebmaster → «OAuth token».' }
  try {
    const user = (await ya('/user', token, f)).user_id
    const hosts = ((await ya(`/user/${user}/hosts`, token, f)).hosts ?? []) as { host_id: string; ascii_host_url?: string; verified?: boolean }[]
    const want = yandexHostId(site)
    const host = hosts.find((h) => h.host_id === want) ?? hosts.find((h) => h.host_id.includes(new URL(site).hostname))
    if (!host) return { ok: false, reason: 'error', message: `Yandex Vebmaster’da ${new URL(site).hostname} yoʻq. Avval saytni Vebmaster’ga qoʻshing va tasdiqlang.` }
    const { start, end } = dateWindow(days)
    const qs = new URLSearchParams({ order_by: 'TOTAL_SHOWS', date_from: start, date_to: end, limit: '100' })
    for (const i of ['TOTAL_SHOWS', 'TOTAL_CLICKS', 'AVG_SHOW_POSITION']) qs.append('query_indicator', i)
    const id = encodeURIComponent(host.host_id)
    const [pop, sum] = await Promise.all([
      ya(`/user/${user}/hosts/${id}/search-queries/popular?${qs}`, token, f),
      ya(`/user/${user}/hosts/${id}/summary`, token, f).catch(() => ({} as Record<string, any>)),
    ])
    const queries: QueryRow[] = ((pop.queries ?? []) as { query_text: string; indicators: Record<string, number> }[]).map((q) => {
      const shows = q.indicators.TOTAL_SHOWS ?? 0, clicks = q.indicators.TOTAL_CLICKS ?? 0
      return { query: q.query_text, impressions: shows, clicks, ctr: shows ? round((clicks / shows) * 100) : 0, position: round(q.indicators.AVG_SHOW_POSITION ?? 0) }
    })
    return { ok: true, data: { host: host.ascii_host_url ?? host.host_id, queries, indexed: sum.searchable_pages_count, excluded: sum.excluded_pages_count, sqi: sum.sqi } }
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof SearchError ? e.message : 'Yandex’ga ulanib boʻlmadi (tarmoq).' }
  }
}

// ---------- cache for the admin screen ----------

const memo = new Map<string, { at: number; v: unknown }>()
const HOUR = 3_600_000
export async function cached<T>(key: string, fn: () => Promise<Report<T>>, fresh = false): Promise<Report<T>> {
  const hit = memo.get(key)
  if (!fresh && hit && Date.now() - hit.at < HOUR) return hit.v as Report<T>
  const v = await fn()
  if (v.ok) memo.set(key, { at: Date.now(), v }) // failures are not kept: fixing a key shows at once
  return v
}

/** "Tekshirish" buttons on the Integratsiyalar screen */
export async function testGoogle(v: Values) {
  const r = await googleStats(7, v)
  return r.ok ? { ok: true, message: `Ulandi: ${r.data.property}. Oxirgi 7 kunda Google’da ${r.data.totals.impressions} marta koʻrsatilgan, ${r.data.totals.clicks} ta bosish.` } : { ok: false, message: r.message }
}
export async function testYandex(v: Values) {
  const r = await yandexStats(7, v)
  return r.ok ? { ok: true, message: `Ulandi: ${r.data.host}. Oxirgi 7 kunda ${r.data.queries.length} ta soʻrov boʻyicha maʼlumot bor.` } : { ok: false, message: r.message }
}
