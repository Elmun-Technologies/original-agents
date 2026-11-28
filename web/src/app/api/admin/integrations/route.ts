import { NextResponse } from 'next/server'

import { adminUser, denied } from '@/lib/admin-auth'
import { payload } from '@/lib/catalog'
import { ALL_FIELDS, CHECKBOX_KEYS, SECRET_KEYS, SERVICES, statusOf } from '@/lib/integrations-def'
import { ensureIndexNowKey, invalidateIntegrations, loadIntegrations } from '@/lib/integrations'
import { mask } from '@/lib/secrets'
import { isSiteClosed } from '@/lib/site-state'
import { siteUrl } from '@/lib/site'

// The "Integratsiyalar" screen reads and saves here. Admin only. A saved secret is never sent back:
// only "••••" + its last 4 characters, so the screen can show that it is there.
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await adminUser())) return denied()
  await ensureIndexNowKey()
  const l = await loadIntegrations(true)
  const shown: Record<string, string | boolean> = {}
  for (const f of ALL_FIELDS) {
    const v = l.stored[f.key]
    if (f.kind === 'secret') shown[f.key] = typeof v === 'string' && v ? mask(v) : l.sources[f.key] === 'env' ? '(server sozlamasidan)' : ''
    else if (f.kind === 'checkbox') shown[f.key] = l.values[f.key] === true
    else shown[f.key] = typeof v === 'string' && v ? v : typeof l.values[f.key] === 'string' ? (l.sources[f.key] === 'env' || f.key === 'eskizFrom' ? String(l.values[f.key]) : '') : ''
  }
  shown.indexNowKey = String(l.stored.indexNowKey ?? '')
  return NextResponse.json({
    siteUrl: siteUrl(), values: shown, sources: l.sources, unreadable: l.unreadable,
    status: Object.fromEntries(SERVICES.map((s) => [s.id, statusOf(s, l.values)])),
    closed: await isSiteClosed(),
  })
}

/** body: { values: { key: value }, clear?: string[] } — an empty secret means "unchanged"; `clear` removes one. */
export async function PATCH(req: Request) {
  if (!(await adminUser())) return denied()
  const body = (await req.json().catch(() => null)) as { values?: Record<string, unknown>; clear?: string[] } | null
  if (!body?.values || typeof body.values !== 'object') return NextResponse.json({ ok: false, errors: ['Soʻrov notoʻgʻri'] }, { status: 400 })
  const known = new Set([...ALL_FIELDS.map((f) => f.key), 'indexNowKey'])
  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body.values)) {
    if (!known.has(k)) continue
    if (CHECKBOX_KEYS.includes(k)) data[k] = v === true
    else if (typeof v === 'string') {
      if (SECRET_KEYS.includes(k) && (!v.trim() || v.startsWith('••••') || v.startsWith('('))) continue // unchanged
      data[k] = v.trim()
    }
  }
  for (const k of body.clear ?? []) if (SECRET_KEYS.includes(k)) data[k] = ''
  try {
    await (await payload()).updateGlobal({ slug: 'integrations', data: data as never, overrideAccess: true })
    invalidateIntegrations()
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = (e as { message?: string }).message ?? 'Saqlab boʻlmadi'
    return NextResponse.json({ ok: false, errors: message.split('\n').filter(Boolean) }, { status: 400 })
  }
}
