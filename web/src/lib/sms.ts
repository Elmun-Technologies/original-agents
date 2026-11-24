import 'server-only'

import { integrations } from '@/lib/integrations'

// SMS. Mode "mock" does not send — the login API returns the code so testers can sign in. Opt-in only:
// with mock anyone can sign in as any phone, so it must never be left on the live site.
// Mode "live" sends through notify.eskiz.uz. Email, password and sender come from the admin panel (Integratsiyalar),
// else from ESKIZ_EMAIL / ESKIZ_PASSWORD / ESKIZ_FROM. Eskiz approves the message text in advance: register
// "Yeppo: kirish kodi XXXX" with them.
export const smsMock = async () => (await integrations()).smsMode === 'mock'

let token: { v: string; at: number } | null = null
async function eskizToken() {
  if (token && Date.now() - token.at < 25 * 86_400_000) return token.v // tokens live 30 days
  const v = await integrations()
  const body = new FormData()
  body.set('email', String(v.eskizEmail ?? ''))
  body.set('password', String(v.eskizPassword ?? ''))
  const r = await fetch('https://notify.eskiz.uz/api/auth/login', { method: 'POST', body, signal: AbortSignal.timeout(10_000) })
  if (!r.ok) throw new Error(`eskiz login ${r.status}`)
  token = { v: (await r.json()).data.token, at: Date.now() }
  return token.v
}

export async function sendSms(phone: string, text: string) {
  if (await smsMock()) return
  const v = await integrations()
  const body = new FormData()
  body.set('mobile_phone', phone)
  body.set('message', text)
  body.set('from', String(v.eskizFrom || '4546'))
  const r = await fetch('https://notify.eskiz.uz/api/message/sms/send', { method: 'POST', body, headers: { authorization: `Bearer ${await eskizToken()}` }, signal: AbortSignal.timeout(10_000) })
  if (r.status === 401) token = null
  if (!r.ok) throw new Error(`eskiz send ${r.status}`) // phone number is never logged
}
