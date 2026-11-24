import 'server-only'

import { payload } from '@/lib/catalog'

// Reports for the admin analytics screens. Visitors, sessions and page views come from our own events table
// (analytics_events); money and orders come from the orders table itself, so revenue is never an estimate.
// Days are cut in Tashkent time. Every function takes a time range and returns plain numbers/rows.

export type Range = { from: Date; to: Date }
export type Run = (sql: string, params?: unknown[]) => Promise<Record<string, any>[]>

const TZ = 'Asia/Tashkent'
const DAY = 86_400_000
export const RANGES = { '1': 'Bugun', '7': '7 kun', '30': '30 kun', '90': '90 kun' } as const
export type RangeKey = keyof typeof RANGES

/** "today" starts at midnight Tashkent time (UTC+5, no daylight saving) */
export function rangeOf(key: string, now = new Date()): Range {
  const days = key in RANGES ? Number(key) : 7
  const startOfToday = Math.floor((now.getTime() + 5 * 3_600_000) / DAY) * DAY - 5 * 3_600_000
  return { from: new Date(startOfToday - (days - 1) * DAY), to: new Date(now.getTime() + 1000) }
}
export const previous = (r: Range): Range => { const len = r.to.getTime() - r.from.getTime(); return { from: new Date(r.from.getTime() - len), to: r.from } }

export async function runner(): Promise<Run> {
  const pool = ((await payload()).db as unknown as { pool: { query: (s: string, p?: unknown[]) => Promise<{ rows: Record<string, any>[] }> } }).pool
  return async (sql, params) => (await pool.query(sql, params)).rows
}

const n = (v: unknown) => Number(v ?? 0) || 0
const W = 'created_at >= $1 AND created_at < $2'

export type Overview = { visitors: number; sessions: number; pageviews: number; orders: number; paid: number; revenue: number; aov: number; conversion: number; unpaid: number }

export async function overview(run: Run, r: Range): Promise<Overview> {
  const [t] = await run(`SELECT count(DISTINCT visitor) v, count(DISTINCT session) s, count(*) p FROM analytics_events WHERE name = 'pageview' AND ${W}`, [r.from, r.to])
  const [o] = await run(`SELECT count(*) FILTER (WHERE created_at >= $1 AND created_at < $2) placed,
      count(*) FILTER (WHERE payment_status = 'paid' AND paid_at >= $1 AND paid_at < $2) paid,
      coalesce(sum(total) FILTER (WHERE payment_status = 'paid' AND paid_at >= $1 AND paid_at < $2), 0) revenue
    FROM orders WHERE (created_at >= $1 AND created_at < $2) OR (paid_at >= $1 AND paid_at < $2)`, [r.from, r.to])
  const paid = n(o.paid), sessions = n(t.s)
  return { visitors: n(t.v), sessions, pageviews: n(t.p), orders: n(o.placed), paid, revenue: n(o.revenue), aov: paid ? Math.round(n(o.revenue) / paid) : 0, conversion: sessions ? paid / sessions : 0, unpaid: Math.max(0, n(o.placed) - paid) }
}

export type Day = { day: string; visitors: number; sessions: number; orders: number; revenue: number }

/** one row per day of the range (empty days included), Tashkent time */
export async function daily(run: Run, r: Range): Promise<Day[]> {
  const ev = await run(`SELECT to_char(created_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD') d, count(DISTINCT visitor) v, count(DISTINCT session) s
    FROM analytics_events WHERE name = 'pageview' AND ${W} GROUP BY 1`, [r.from, r.to])
  const od = await run(`SELECT to_char(paid_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD') d, count(*) c, sum(total) t FROM orders
    WHERE payment_status = 'paid' AND paid_at >= $1 AND paid_at < $2 GROUP BY 1`, [r.from, r.to])
  const out: Day[] = []
  const fmt = (t: number) => new Date(t + 5 * 3_600_000).toISOString().slice(0, 10)
  for (let t = r.from.getTime(); t < r.to.getTime(); t += DAY) {
    const day = fmt(t)
    const e = ev.find((x) => x.d === day), o = od.find((x) => x.d === day)
    out.push({ day, visitors: n(e?.v), sessions: n(e?.s), orders: n(o?.c), revenue: n(o?.t) })
  }
  return out
}

export type Funnel = { visit: number; product: number; cart: number; checkout: number; ordered: number; paid: number }
export async function funnel(run: Run, r: Range): Promise<Funnel> {
  const [f] = await run(`SELECT
      count(DISTINCT session) FILTER (WHERE name = 'pageview') visit,
      count(DISTINCT session) FILTER (WHERE name = 'pageview' AND path ~ '^/(uz|ru)/mahsulot/') product,
      count(DISTINCT session) FILTER (WHERE name = 'add_to_cart') cart,
      count(DISTINCT session) FILTER (WHERE name = 'pageview' AND path ~ '^/(uz|ru)/rasmiylashtirish') checkout,
      count(DISTINCT session) FILTER (WHERE name = 'order_created') ordered,
      count(DISTINCT session) FILTER (WHERE name = 'purchase') paid
    FROM analytics_events WHERE ${W}`, [r.from, r.to])
  return { visit: n(f.visit), product: n(f.product), cart: n(f.cart), checkout: n(f.checkout), ordered: n(f.ordered), paid: n(f.paid) }
}

export type SourceRow = { src: string; med: string; cmp: string; sessions: number; visitors: number; orders: number; revenue: number }
export const DIRECT = '(toʻgʻridan-toʻgʻri)'

export async function sources(run: Run, r: Range): Promise<SourceRow[]> {
  const ev = await run(`SELECT coalesce(src, '${DIRECT}') src, coalesce(med, '') med, coalesce(cmp, '') cmp, count(DISTINCT session) s, count(DISTINCT visitor) v
    FROM analytics_events WHERE name = 'pageview' AND ${W} GROUP BY 1, 2, 3`, [r.from, r.to])
  const od = await run(`SELECT coalesce(src, '${DIRECT}') src, coalesce(med, '') med, coalesce(cmp, '') cmp, count(*) c, sum(total) t FROM orders
    WHERE payment_status = 'paid' AND paid_at >= $1 AND paid_at < $2 GROUP BY 1, 2, 3`, [r.from, r.to])
  const key = (x: Record<string, any>) => `${x.src}|${x.med}|${x.cmp}`
  const map = new Map<string, SourceRow>()
  for (const e of ev) map.set(key(e), { src: e.src, med: e.med, cmp: e.cmp, sessions: n(e.s), visitors: n(e.v), orders: 0, revenue: 0 })
  for (const o of od) {
    const row = map.get(key(o)) ?? { src: o.src, med: o.med, cmp: o.cmp, sessions: 0, visitors: 0, orders: 0, revenue: 0 }
    row.orders = n(o.c); row.revenue = n(o.t)
    map.set(key(o), row)
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue || b.sessions - a.sessions).slice(0, 60)
}

export type PageRow = { path: string; views: number; visitors: number; depth: number | null }
export async function pages(run: Run, r: Range, limit = 40): Promise<PageRow[]> {
  const rows = await run(`SELECT coalesce(nullif(regexp_replace(path, '^/(uz|ru)', ''), ''), '/') p, count(*) v, count(DISTINCT visitor) u
    FROM analytics_events WHERE name = 'pageview' AND ${W} GROUP BY 1 ORDER BY 2 DESC LIMIT ${Math.min(limit, 200)}`, [r.from, r.to])
  const sc = await run(`SELECT coalesce(nullif(regexp_replace(path, '^/(uz|ru)', ''), ''), '/') p, avg((data->>'depth')::numeric) d
    FROM analytics_events WHERE name = 'scroll' AND ${W} GROUP BY 1`, [r.from, r.to])
  return rows.map((x) => ({ path: x.p, views: n(x.v), visitors: n(x.u), depth: sc.find((s) => s.p === x.p) ? Math.round(n(sc.find((s) => s.p === x.p)!.d)) : null }))
}

export type ProductRow = { slug: string; name: string; views: number; carts: number; sold: number; revenue: number }
export async function products(run: Run, r: Range): Promise<ProductRow[]> {
  const views = await run(`SELECT substring(path from '/mahsulot/([^/]+)') s, count(*) c FROM analytics_events
    WHERE name = 'pageview' AND path ~ '/mahsulot/' AND ${W} GROUP BY 1`, [r.from, r.to])
  const carts = await run(`SELECT data->>'slug' s, sum(coalesce((data->>'qty')::int, 1)) c FROM analytics_events
    WHERE name = 'add_to_cart' AND ${W} GROUP BY 1`, [r.from, r.to])
  const sold = await run(`SELECT i.slug s, sum(i.qty) q, sum(i.qty * i.price) t FROM orders_items i JOIN orders o ON o.id = i._parent_id
    WHERE o.payment_status = 'paid' AND o.paid_at >= $1 AND o.paid_at < $2 GROUP BY 1`, [r.from, r.to])
  const slugs = [...new Set([...views, ...carts, ...sold].map((x) => x.s).filter(Boolean))] as string[]
  const names = slugs.length ? await run('SELECT slug, name FROM products WHERE slug = ANY($1)', [slugs]) : []
  return slugs.map((s) => ({
    slug: s, name: names.find((x) => x.slug === s)?.name ?? s,
    views: n(views.find((x) => x.s === s)?.c), carts: n(carts.find((x) => x.s === s)?.c), sold: n(sold.find((x) => x.s === s)?.q), revenue: n(sold.find((x) => x.s === s)?.t),
  })).sort((a, b) => b.revenue - a.revenue || b.views - a.views).slice(0, 60)
}

export type DeviceRow = { key: string; sessions: number }
export async function devices(run: Run, r: Range) {
  const by = async (col: string): Promise<DeviceRow[]> => (await run(`SELECT coalesce(${col}, '?') k, count(DISTINCT session) s FROM analytics_events
    WHERE name = 'pageview' AND ${W} GROUP BY 1 ORDER BY 2 DESC`, [r.from, r.to])).map((x) => ({ key: x.k, sessions: n(x.s) }))
  return { device: await by('device'), lang: await by('lang') }
}

export type Vitals = { device: string; samples: number; lcp: number | null; cls: number | null; inp: number | null }
/** 75th percentile per device — the number Google judges a page by */
export async function vitals(run: Run, r: Range): Promise<Vitals[]> {
  const rows = await run(`SELECT device, count(*) c,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY (data->>'lcp')::numeric) FILTER (WHERE data ? 'lcp') lcp,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY (data->>'cls')::numeric) FILTER (WHERE data ? 'cls') cls,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY (data->>'inp')::numeric) FILTER (WHERE data ? 'inp') inp
    FROM analytics_events WHERE name = 'vitals' AND ${W} GROUP BY 1 ORDER BY 2 DESC`, [r.from, r.to])
  return rows.map((x) => ({ device: x.device, samples: n(x.c), lcp: x.lcp === null ? null : Math.round(n(x.lcp)), cls: x.cls === null ? null : Math.round(n(x.cls) * 1000) / 1000, inp: x.inp === null ? null : Math.round(n(x.inp)) }))
}
export const grade = (kind: 'lcp' | 'cls' | 'inp', v: number | null): 'good' | 'mid' | 'bad' | null => {
  if (v === null) return null
  const [good, mid] = kind === 'lcp' ? [2500, 4000] : kind === 'cls' ? [0.1, 0.25] : [200, 500]
  return v <= good ? 'good' : v <= mid ? 'mid' : 'bad'
}

export async function realtime(run: Run, now = new Date()) {
  const since = new Date(now.getTime() - 5 * 60_000)
  const [c] = await run(`SELECT count(DISTINCT visitor) v FROM analytics_events WHERE created_at >= $1`, [since])
  const now_on = await run(`SELECT coalesce(nullif(regexp_replace(path, '^/(uz|ru)', ''), ''), '/') p, count(DISTINCT visitor) v FROM analytics_events
    WHERE name = 'pageview' AND created_at >= $1 GROUP BY 1 ORDER BY 2 DESC LIMIT 10`, [since])
  const last = await run(`SELECT name, path, device, coalesce(src, '') src, created_at FROM analytics_events WHERE name IN ('pageview', 'add_to_cart', 'order_created', 'purchase')
    ORDER BY created_at DESC LIMIT 15`)
  return { visitors: n(c.v), pages: now_on.map((x) => ({ path: x.p as string, visitors: n(x.v) })), last: last.map((x) => ({ name: x.name as string, path: x.path as string, device: x.device as string, src: x.src as string, at: new Date(x.created_at).toISOString() })) }
}

export type HeatClick = { x: number; y: number; w: number; h: number; t: string }
const PATHS = (p: string) => [`/uz${p === '/' ? '' : p}`, `/ru${p === '/' ? '' : p}`]

export async function heat(run: Run, r: Range, path: string, device: string) {
  const [uz, ru] = PATHS(path)
  const clicks = await run(`SELECT (data->>'x')::float x, (data->>'y')::int y, (data->>'w')::int w, coalesce((data->>'h')::int, 0) h, coalesce(data->>'t', '') t
    FROM analytics_events WHERE name = 'click' AND path IN ($3, $4) AND device = $5 AND ${W} ORDER BY created_at DESC LIMIT 20000`, [r.from, r.to, uz, ru, device])
  const depth = await run(`SELECT (data->>'depth')::int d, count(*) c FROM analytics_events WHERE name = 'scroll' AND path IN ($3, $4) AND device = $5 AND ${W} GROUP BY 1 ORDER BY 1`, [r.from, r.to, uz, ru, device])
  const [v] = await run(`SELECT count(*) c FROM analytics_events WHERE name = 'pageview' AND path IN ($3, $4) AND device = $5 AND ${W}`, [r.from, r.to, uz, ru, device])
  const top = await run(`SELECT data->>'t' t, count(*) c FROM analytics_events WHERE name = 'click' AND path IN ($3, $4) AND device = $5 AND ${W} AND coalesce(data->>'t', '') <> ''
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12`, [r.from, r.to, uz, ru, device])
  return {
    views: n(v.c),
    clicks: clicks.map((c) => ({ x: n(c.x), y: n(c.y), w: n(c.w), h: n(c.h), t: String(c.t) })) as HeatClick[],
    depth: depth.map((d) => ({ depth: n(d.d), count: n(d.c) })),
    top: top.map((x) => ({ t: String(x.t), count: n(x.c) })),
  }
}

/** pages that have click data, for the heatmap page picker */
export async function heatPages(run: Run, r: Range) {
  const rows = await run(`SELECT coalesce(nullif(regexp_replace(path, '^/(uz|ru)', ''), ''), '/') p, count(*) c FROM analytics_events
    WHERE name = 'click' AND ${W} GROUP BY 1 ORDER BY 2 DESC LIMIT 60`, [r.from, r.to])
  return rows.map((x) => ({ path: x.p as string, clicks: n(x.c) }))
}

export async function searches(run: Run) {
  const rows = await run(`SELECT query, count, missed FROM search_log ORDER BY count DESC NULLS LAST LIMIT 40`)
  return rows.map((x) => ({ query: x.query as string, count: n(x.count), missed: !!x.missed }))
}
