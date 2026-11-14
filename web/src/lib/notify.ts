import 'server-only'

// Admin messages via the Telegram Bot API (TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_IDS in .env / Coolify).
// Without them this is a no-op. Message text (it contains the customer's contact for the order) is never logged.
export async function notifyAdmins(text: string) {
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
