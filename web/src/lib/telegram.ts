import 'server-only'
import crypto from 'node:crypto'

import { integrations } from '@/lib/integrations'
import { siteUrl } from '@/lib/site'

// Telegram Bot API calls for the customer bot (order status, "tell me when it is back"). The same bot token that
// sends admin messages (Integratsiyalar → Telegram). Texts never contain keys; failures never throw.

export type Sent = { ok: boolean; status: number; blocked?: boolean }

async function call(token: string, method: string, body: object): Promise<{ ok: boolean; status: number; json: { description?: string; result?: unknown } }> {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  })
  return { ok: r.ok, status: r.status, json: (await r.json().catch(() => ({}))) as { description?: string; result?: unknown } }
}

/** the value Telegram sends back in the X-Telegram-Bot-Api-Secret-Token header; only this server can compute it */
export const webhookSecret = (botToken: string) =>
  crypto.createHmac('sha256', process.env.PAYLOAD_SECRET ?? '').update(`tg-webhook:${botToken}`).digest('hex').slice(0, 48)

export async function sendTelegram(chatId: string | number, text: string): Promise<Sent> {
  const token = String((await integrations()).telegramToken ?? '')
  if (!token) return { ok: false, status: 0 }
  try {
    const r = await call(token, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true })
    return { ok: r.ok, status: r.status, blocked: r.status === 403 } // 403: the customer blocked the bot or left
  } catch (e) {
    console.warn('telegram: not sent —', (e as Error).name)
    return { ok: false, status: 0 }
  }
}

/** points Telegram at /api/telegram of this site (https only: Telegram refuses anything else) */
export async function registerWebhook(): Promise<{ ok: boolean; message: string }> {
  const token = String((await integrations()).telegramToken ?? '')
  const site = siteUrl()
  if (!token) return { ok: false, message: 'Avval bot tokenini kiriting va saqlang.' }
  if (!site.startsWith('https://') || /localhost|127\.0\.0\.1/.test(site)) return { ok: false, message: `Telegram faqat https manzilga yuboradi. Hozirgi manzil: ${site}. Domen ulangach qayta bosing.` }
  try {
    const r = await call(token, 'setWebhook', { url: `${site}/api/telegram`, secret_token: webhookSecret(token), allowed_updates: ['message'], drop_pending_updates: false })
    return r.ok ? { ok: true, message: `Ulandi: mijozlar botga yozsa, javob shu saytdan beriladi (${site}/api/telegram).` } : { ok: false, message: `Telegram rad etdi: ${r.json.description ?? r.status}` }
  } catch {
    return { ok: false, message: 'Telegram’ga ulanib boʻlmadi (tarmoq).' }
  }
}
