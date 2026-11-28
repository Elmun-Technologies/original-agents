import 'server-only'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'

import { payload } from '@/lib/catalog'
import { siteUrl } from '@/lib/site'
import { sendSms, smsMock } from '@/lib/sms'

// Customer session: httpOnly cookie "<phone>.<expires>.<hmac>" signed with PAYLOAD_SECRET. No password.
const COOKIE = 'yp_c'
const DAYS = 90
const MAX_CODES_PER_DAY = 5 // x 5 tries each = at most 25 guesses of a 4-digit code per phone per day
function secret() {
  const s = process.env.PAYLOAD_SECRET
  if (!s || s.length < 16) throw new Error('PAYLOAD_SECRET is missing or too short') // never sign with an empty key
  return s
}
const mac = (s: string) => crypto.createHmac('sha256', secret()).update(s).digest('base64url')
const hash = (phone: string, code: string) => mac(`otp:${phone}:${code}`)

export async function sessionPhone(): Promise<string | null> {
  const v = (await cookies()).get(COOKIE)?.value
  const [phone, exp, sig] = v?.split('.') ?? []
  if (!phone || !exp || !sig || Number(exp) < Date.now()) return null
  const want = mac(`${phone}.${exp}`)
  return want.length === sig.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig)) ? phone : null
}

export async function currentCustomer() {
  const phone = await sessionPhone()
  if (!phone) return null
  return (await (await payload()).find({ collection: 'customers', where: { phone: { equals: phone } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] ?? null
}

export async function signIn(phone: string) {
  const exp = Date.now() + DAYS * 86_400_000
  ;(await cookies()).set(COOKIE, `${phone}.${exp}.${mac(`${phone}.${exp}`)}`, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: DAYS * 86400 })
}
export async function signOut() { (await cookies()).delete(COOKIE) }

/** Sends a 4-digit code: one per minute and at most MAX_CODES_PER_DAY per phone. Mock mode returns the code instead of sending it. */
export async function requestCode(phone: string): Promise<{ ok: true; mock?: string } | { ok: false; error: 'too_soon' | 'too_many' | 'sms_failed' | 'sms_off' }> {
  // Sinov SMS (the code shown on screen) lets anyone sign in as any phone: allowed only while the site is closed
  // with a password, or on a developer's own computer (http, not https). On an open public site, sign-in waits for
  // real SMS (Integratsiyalar → Eskiz → Haqiqiy SMS).
  if ((await smsMock()) && siteUrl().startsWith('https://') && !(await (await import('@/lib/site-state')).siteState()).locked) return { ok: false, error: 'sms_off' }
  const p = await payload()
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  await p.delete({ collection: 'login-codes', where: { createdAt: { less_than: dayAgo } }, overrideAccess: true })
  const recent = (await p.find({ collection: 'login-codes', where: { phone: { equals: phone } }, sort: '-createdAt', limit: MAX_CODES_PER_DAY, depth: 0, overrideAccess: true })).docs
  if (recent[0] && Date.now() - new Date(recent[0].createdAt).getTime() < 60_000) return { ok: false, error: 'too_soon' }
  if (recent.length >= MAX_CODES_PER_DAY) return { ok: false, error: 'too_many' }
  const code = String(crypto.randomInt(1000, 10000))
  // older codes stay (for the daily count) but only the newest one is checked
  await p.create({ collection: 'login-codes', data: { phone, hash: hash(phone, code), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() }, overrideAccess: true })
  try { await sendSms(phone, `Yeppo: kirish kodi ${code}`) } catch { return { ok: false, error: 'sms_failed' } }
  return (await smsMock()) ? { ok: true, mock: code } : { ok: true }
}

/** Checks the code (5 tries, 5 minutes), creates the customer on first login, sets the session cookie. */
export async function verifyCode(phone: string, code: string): Promise<boolean> {
  const p = await payload()
  const row = (await p.find({ collection: 'login-codes', where: { phone: { equals: phone } }, sort: '-createdAt', limit: 1, depth: 0, overrideAccess: true })).docs[0]
  if (!row || new Date(row.expiresAt) < new Date() || (row.tries ?? 0) >= 5) return false
  const a = Buffer.from(row.hash), b = Buffer.from(hash(phone, code.trim()))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await p.update({ collection: 'login-codes', id: row.id, data: { tries: (row.tries ?? 0) + 1 }, overrideAccess: true })
    return false
  }
  await p.update({ collection: 'login-codes', id: row.id, data: { tries: 99 }, overrideAccess: true }) // used up, still counted
  if (!(await p.find({ collection: 'customers', where: { phone: { equals: phone } }, limit: 1, depth: 0, overrideAccess: true })).docs.length) {
    await p.create({ collection: 'customers', data: { phone }, overrideAccess: true })
  }
  await signIn(phone)
  return true
}
