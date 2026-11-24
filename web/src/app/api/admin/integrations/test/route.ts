import { NextResponse } from 'next/server'

import { adminUser, denied } from '@/lib/admin-auth'
import { testEskiz, testTelegram } from '@/lib/integration-tests'
import { loadIntegrations } from '@/lib/integrations'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!(await adminUser())) return denied()
  const { service } = (await req.json().catch(() => ({}))) as { service?: string }
  const { values } = await loadIntegrations(true)
  if (service === 'telegram') return NextResponse.json(await testTelegram(values))
  if (service === 'eskiz') return NextResponse.json(await testEskiz(values))
  return NextResponse.json({ ok: false, message: 'Bu xizmat uchun tekshiruv yoʻq.' }, { status: 400 })
}
