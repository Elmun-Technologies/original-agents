import { adminUser, denied } from '@/lib/admin-auth'
import { runner } from '@/lib/analytics'
import { customers, SEGMENTS, toCsv } from '@/lib/marketing'

export const dynamic = 'force-dynamic'

// Customer list as a spreadsheet (CSV) for a message campaign. Contains phone numbers: admin only.
export async function GET(req: Request) {
  if (!(await adminUser())) return denied()
  const seg = new URL(req.url).searchParams.get('segment') ?? ''
  const all = await customers(await runner())
  const rows = seg in SEGMENTS ? all.filter((c) => c.segments.includes(seg)) : all
  return new Response(toCsv(rows), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="mijozlar-${seg || 'hammasi'}.csv"`, 'cache-control': 'no-store' },
  })
}
