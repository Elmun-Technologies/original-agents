import { NextResponse } from 'next/server'

import { adminUser, denied } from '@/lib/admin-auth'
import { heat, rangeOf, runner } from '@/lib/analytics'
import { cleanPath } from '@/lib/analytics-ingest'

export const dynamic = 'force-dynamic'

// Clicks and scroll depth of one page on one kind of device, for the heatmap screen. Admin only.
export async function GET(req: Request) {
  if (!(await adminUser())) return denied()
  const q = new URL(req.url).searchParams
  const path = q.get('path') ?? '/'
  const device = ['mobile', 'tablet', 'desktop'].includes(q.get('device') ?? '') ? q.get('device')! : 'desktop'
  if (path !== '/' && !cleanPath(`/uz${path}`)) return NextResponse.json({ ok: false }, { status: 400 })
  return NextResponse.json({ ok: true, ...(await heat(await runner(), rangeOf(q.get('r') ?? '30'), path, device)) })
}
