import { verifyCode } from '@/lib/customer'
import { normalizePhone } from '@/lib/pricing'

export async function POST(req: Request) {
  const { phone, code } = await req.json().catch(() => ({}))
  const n = normalizePhone(String(phone ?? ''))
  if (!n || !/^\d{4}$/.test(String(code ?? '').trim())) return Response.json({ ok: false }, { status: 400 })
  const ok = await verifyCode(n, String(code))
  return Response.json({ ok }, { status: ok ? 200 : 401 })
}
