import { requestCode } from '@/lib/customer'
import { normalizePhone } from '@/lib/pricing'

export async function POST(req: Request) {
  const { phone } = await req.json().catch(() => ({}))
  const n = normalizePhone(String(phone ?? ''))
  if (!n) return Response.json({ ok: false, error: 'phone' }, { status: 400 })
  const r = await requestCode(n)
  return Response.json(r, { status: r.ok ? 200 : 429 })
}
