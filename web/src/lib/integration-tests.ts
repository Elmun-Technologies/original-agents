import 'server-only'

import type { Values } from './integrations-def'

// "Tekshirish" buttons: prove the saved keys really work, without sending anything to customers.
// Messages are for the owner (Uzbek) and never contain a key.
export type TestResult = { ok: boolean; message: string }

export async function testTelegram(v: Values): Promise<TestResult> {
  const token = String(v.telegramToken ?? '')
  const ids = String(v.telegramAdminIds ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!token) return { ok: false, message: 'Bot token kiritilmagan.' }
  if (!ids.length) return { ok: false, message: 'Admin Telegram ID kiritilmagan.' }
  const api = (method: string, body?: object) => fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(10_000),
  }).then(async (r) => ({ ok: r.ok, status: r.status, json: (await r.json().catch(() => ({}))) as { description?: string; result?: { username?: string } } }))
  try {
    const me = await api('getMe')
    if (!me.ok) return { ok: false, message: me.status === 401 || me.status === 404 ? 'Token notoʻgʻri (Telegram qabul qilmadi).' : `Telegram javobi: ${me.status}.` }
    const bad: string[] = []
    for (const id of ids) {
      const r = await api('sendMessage', { chat_id: id, text: '✅ Yeppo: Telegram ulandi. Endi har bir toʻlangan buyurtma haqida shu yerga xabar keladi.' })
      if (!r.ok) bad.push(id)
    }
    if (bad.length) return { ok: false, message: `Bot ishlayapti (@${me.json.result?.username}), lekin ${bad.join(', ')} ga yubora olmadi. Oʻsha odam botga avval /start yozishi kerak.` }
    return { ok: true, message: `Ulandi: @${me.json.result?.username}. ${ids.length} ta adminga sinov xabari yuborildi.` }
  } catch {
    return { ok: false, message: 'Telegram’ga ulanib boʻlmadi (tarmoq).' }
  }
}

/** Logs in to Eskiz with the saved email and password. Sends no SMS. */
export async function testEskiz(v: Values): Promise<TestResult> {
  const email = String(v.eskizEmail ?? ''), password = String(v.eskizPassword ?? '')
  if (!email || !password) return { ok: false, message: 'Eskiz email va parol kiritilmagan.' }
  try {
    const body = new FormData()
    body.set('email', email)
    body.set('password', password)
    const r = await fetch('https://notify.eskiz.uz/api/auth/login', { method: 'POST', body, signal: AbortSignal.timeout(10_000) })
    if (r.status === 401 || r.status === 400) return { ok: false, message: 'Eskiz email yoki parolni qabul qilmadi.' }
    if (!r.ok) return { ok: false, message: `Eskiz javobi: ${r.status}.` }
    const j = (await r.json().catch(() => ({}))) as { data?: { token?: string } }
    return j.data?.token ? { ok: true, message: 'Eskiz bilan ulanish ishlayapti (SMS yuborilmadi).' } : { ok: false, message: 'Eskiz kutilmagan javob berdi.' }
  } catch {
    return { ok: false, message: 'Eskiz’ga ulanib boʻlmadi (tarmoq).' }
  }
}
