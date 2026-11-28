import { siteState } from '@/lib/site-state'

// What the proxy needs to know about the site: closed with a password? hidden from search? Flags only — the password
// itself never leaves the server environment. Public on purpose (the proxy asks it on every new request burst).
export const dynamic = 'force-dynamic'

export async function GET() {
  const s = await siteState()
  return Response.json({ locked: s.locked, noindex: s.noindex, ordersEnabled: s.ordersEnabled }, { headers: { 'cache-control': 'no-store' } })
}
