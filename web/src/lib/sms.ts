import 'server-only'

// SMS: SMS_MODE=mock does not send — the login API returns the code so testers can sign in. Opt-in only:
// with mock anyone can sign in as any phone, so it must never be set on the live site.
// Default (unset or eskiz) sends through notify.eskiz.uz (ESKIZ_EMAIL, ESKIZ_PASSWORD, ESKIZ_FROM in .env / Coolify).
// TODO(admin): Eskiz approves the message text in advance — register "Yeppo: kirish kodi XXXX" with them.
export const smsMock = () => process.env.SMS_MODE === 'mock'
if (smsMock() && process.env.NODE_ENV === 'production') console.warn('SMS_MODE=mock: login codes are shown on screen — test sites only')

let token: { v: string; at: number } | null = null
async function eskizToken() {
  if (token && Date.now() - token.at < 25 * 86_400_000) return token.v // tokens live 30 days
  const body = new FormData()
  body.set('email', process.env.ESKIZ_EMAIL ?? '')
  body.set('password', process.env.ESKIZ_PASSWORD ?? '')
  const r = await fetch('https://notify.eskiz.uz/api/auth/login', { method: 'POST', body, signal: AbortSignal.timeout(10_000) })
  if (!r.ok) throw new Error(`eskiz login ${r.status}`)
  token = { v: (await r.json()).data.token, at: Date.now() }
  return token.v
}

export async function sendSms(phone: string, text: string) {
  if (smsMock()) return
  const body = new FormData()
  body.set('mobile_phone', phone)
  body.set('message', text)
  body.set('from', process.env.ESKIZ_FROM ?? '4546')
  const r = await fetch('https://notify.eskiz.uz/api/message/sms/send', { method: 'POST', body, headers: { authorization: `Bearer ${await eskizToken()}` }, signal: AbortSignal.timeout(10_000) })
  if (r.status === 401) token = null
  if (!r.ok) throw new Error(`eskiz send ${r.status}`) // phone number is never logged
}
