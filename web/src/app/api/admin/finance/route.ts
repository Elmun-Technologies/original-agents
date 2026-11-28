import { adminUser, denied } from '@/lib/admin-auth'
import { runner } from '@/lib/analytics'
import { daysOf, financeReport, lastMonths, reportCsv } from '@/lib/finance'

// Admin → Moliya hisoboti → «Excel’ga yuklab olish»: the same table as on the screen.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!(await adminUser())) return denied()
  const m = new URL(req.url).searchParams.get('m') ?? ''
  const periods = /^\d{4}-\d{2}$/.test(m) ? daysOf(m) : lastMonths(12)
  if (!periods.length) return Response.json({ error: 'period' }, { status: 400 })
  const csv = reportCsv(await financeReport(await runner(), periods))
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="yeppo-moliya-${m || '12-oy'}.csv"`, 'cache-control': 'no-store' } })
}
