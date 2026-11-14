import { NextResponse } from 'next/server'

import { paymeHandle, PAYME_ERR } from '@/lib/payments/payme'

// Payme Merchant API endpoint (set https://<domain>/api/pay/payme in the Payme cabinet). Always HTTP 200 + JSON-RPC.
export async function POST(req: Request) {
  const rpc = await req.json().catch(() => null)
  if (!rpc) return NextResponse.json({ jsonrpc: '2.0', id: null, error: PAYME_ERR.PARSE })
  return NextResponse.json(await paymeHandle(rpc, req.headers.get('authorization')))
}
