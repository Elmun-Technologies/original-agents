import crypto from 'node:crypto'

import { integrations } from '@/lib/integrations'
import { webhookSecret } from '@/lib/telegram'
import { handleUpdate, type Update } from '@/lib/telegram-bot'

// Telegram calls this for every message a customer writes to the bot (set it up with the "Webhook oʻrnatish" button in
// Integratsiyalar). Only requests that carry the secret Telegram was given are accepted.
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const token = String((await integrations()).telegramToken ?? '')
  const got = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
  const want = token ? webhookSecret(token) : ''
  const ok = !!want && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))
  if (!ok) return new Response('forbidden', { status: 401 })
  try {
    const body = (await req.json()) as Update
    await handleUpdate(body)
  } catch (e) {
    console.warn('telegram webhook:', (e as Error).message.split('\n')[0]) // answer 200 anyway: Telegram would resend the same update
  }
  return Response.json({ ok: true })
}
