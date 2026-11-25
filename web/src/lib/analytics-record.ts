import 'server-only'

import { payload } from '@/lib/catalog'
import type { Row } from './analytics-ingest'

type Pool = { query: (sql: string, params: unknown[]) => Promise<unknown> }

const COLS = ['name', 'visitor', 'session', 'path', 'lang', 'device', 'ref', 'src', 'med', 'cmp', 'data'] as const

/** One multi-row INSERT (the ORM would need a round trip per row). */
export async function recordEvents(rows: Row[]) {
  if (!rows.length) return
  const pool = ((await payload()).db as unknown as { pool: Pool }).pool
  const params: unknown[] = []
  const tuples = rows.map((r) => {
    const marks = COLS.map((c) => {
      params.push(c === 'data' ? (r.data ? JSON.stringify(r.data) : null) : r[c])
      return '$' + params.length
    })
    return '(' + marks.join(',') + ',now(),now())'
  })
  await pool.query('INSERT INTO analytics_events (' + COLS.join(',') + ',updated_at,created_at) VALUES ' + tuples.join(','), params)
}

type OrderLike = {
  number: string; total: number; lang?: string | null; visitor?: string | null; session?: string | null
  src?: string | null; med?: string | null; cmp?: string | null
}

/** An event the server itself knows about (an order was placed / paid), with the order's own attribution. */
export async function recordOrderEvent(name: 'order_created' | 'purchase', o: OrderLike) {
  try {
    const none = '0'.repeat(16)
    const lang = o.lang === 'ru' ? 'ru' : 'uz'
    await recordEvents([{
      name, visitor: o.visitor || none, session: o.session || o.visitor || none, path: `/${lang}/buyurtma`, lang, device: 'desktop',
      ref: null, src: o.src ?? null, med: o.med ?? null, cmp: o.cmp ?? null, data: { order: o.number, value: Math.round(o.total) },
    }])
  } catch (e) {
    console.warn('analytics: order event not stored —', (e as Error).message.split('\n')[0]) // never breaks an order
  }
}

// Old rows are deleted so the table cannot grow without limit: clicks 90 days, scroll/speed samples 180 days,
// everything else two years. Runs at most once an hour, started by the collector itself (no extra job to configure).
export const RETENTION_SQL = `DELETE FROM analytics_events WHERE (name = 'click' AND created_at < now() - interval '90 days')
  OR (name IN ('scroll', 'vitals') AND created_at < now() - interval '180 days') OR created_at < now() - interval '730 days'`
let lastPurge = 0
export async function purgeOldEvents(now = Date.now()) {
  if (now - lastPurge < 3_600_000) return false
  lastPurge = now
  try { await ((await payload()).db as unknown as { pool: Pool }).pool.query(RETENTION_SQL, []); return true } catch (e) { console.warn('analytics: cleanup failed —', (e as Error).message.split('\n')[0]); return false }
}
