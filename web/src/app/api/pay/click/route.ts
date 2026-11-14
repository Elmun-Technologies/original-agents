import { NextResponse } from 'next/server'

import { clickHandle } from '@/lib/payments/click'

// Click Prepare + Complete (set both URLs in the Click cabinet to https://<domain>/api/pay/click).
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const params = Object.fromEntries([...(form?.entries() ?? [])].map(([k, v]) => [k, String(v)]))
  return NextResponse.json(await clickHandle(params))
}
