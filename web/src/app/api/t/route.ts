import { isBot, makeLimiter, MAX_BODY, parseBatch, readCookies } from '@/lib/analytics-ingest'
import { recordEvents } from '@/lib/analytics-record'

// Our own analytics collector. Always answers 204 — a visitor's browser must never see an error from it.
// The client address is used only to limit abuse, in memory, and is never stored.
const allow = makeLimiter(240, 60_000)

export async function POST(req: Request) {
  const done = new Response(null, { status: 204 })
  try {
    if (isBot(req.headers.get('user-agent'))) return done
    if (readCookies(req.headers.get('cookie')).hasAdmin) return done // the owner's own visits are not traffic
    const raw = await req.text()
    if (raw.length > MAX_BODY) return done
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    const rows = parseBatch(JSON.parse(raw))
    if (!rows.length || !allow(ip, rows.length)) return done
    await recordEvents(rows)
  } catch (e) {
    console.warn('analytics: batch dropped —', (e as Error).message.split('\n')[0])
  }
  return done
}
