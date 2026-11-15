import 'server-only'

import { paymentsMode } from '@/lib/payments/config'

// Admin messages via the Telegram Bot API (TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_IDS in .env / Coolify).
// Without them this is a no-op. Message text (it contains the customer's contact for the order) is never logged.
// ADMIN_NOTIFY=off silences it (automated tests). With PAYMENTS_MODE=mock every message is marked as a test.
export async function notifyAdmins(text: string) {
  if (process.env.ADMIN_NOTIFY === 'off') return
  if (paymentsMode() === 'mock') text = `🧪 SINOV (soxta toʻlov, pul yoʻq)\n${text}`
  const token = process.env.TELEGRAM_BOT_TOKEN
  const ids = (process.env.TELEGRAM_ADMIN_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!token || !ids.length) return
  await Promise.all(ids.map(async (chat_id) => {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000),
      })
      if (!r.ok) console.warn('telegram notify failed', r.status)
    } catch (e) {
      console.warn('telegram notify error', (e as Error).name)
    }
  }))
}
