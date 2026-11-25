import { loadIntegrations } from '@/lib/integrations'

// The IndexNow key file: search engines fetch it to prove the site's owner sent the notifications.
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const { values } = await loadIntegrations()
  if (!key || key !== values.indexNowKey || values.indexNowOn !== true) return new Response('not found', { status: 404 })
  return new Response(key, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
