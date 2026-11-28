import 'server-only'

import { REMINDER_DEFAULTS } from '@/collections/reminders'
import { payload } from '@/lib/catalog'
import { runner, type Run } from '@/lib/analytics'
import { PAY_WINDOW_MS } from '@/lib/order-state'
import { siteUrl } from '@/lib/site'
import { sendSms, smsMock } from '@/lib/sms'
import { sendTelegram } from '@/lib/telegram'

// Automatic reminders (admin → Sozlamalar → Avtomatik eslatmalar). Runs every 10 minutes inside the site
// (instrumentation.ts) and from the "Hozir tekshirish" button. Rules that never bend:
//  - off until the owner switches it on; only 10:00–20:00 Tashkent time;
//  - one reminder per unpaid order, one per "quiet period" of a customer (a unique key in reminder-log);
//  - "Qaytmagan mijoz" only to customers who ticked "Aksiyalar va eslatmalar" on their latest order;
//  - SMS only in real SMS mode (in test mode nothing would arrive), Telegram only to people who joined the bot.

export type Channel = 'telegram_sms' | 'telegram' | 'sms'
export type Settings = {
  abandonedOn: boolean; abandonedAfterMin: number; abandonedChannel: Channel; abandonedText: { uz: string; ru: string }
  lapsedOn: boolean; lapsedDays: number; lapsedChannel: Channel; lapsedPromo: string; lapsedText: { uz: string; ru: string }
}
export type Candidate = { kind: 'abandoned' | 'lapsed'; key: string; phone: string; name: string; lang: 'uz' | 'ru'; chat: string | null; orderNumber?: string; text: string }
export type Result = { checked: boolean; reason?: string; sent: number; failed: number; skipped: number }

const DAY = 86_400_000

/** {ism} {buyurtma} {havola} {sayt} {promokod} → values; unknown placeholders stay as they are */
export const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))

/** 10:00–20:00 in Tashkent (UTC+5, no daylight saving) */
export const allowedHour = (now: number) => { const h = new Date(now + 5 * 3_600_000).getUTCHours(); return h >= 10 && h < 20 }

/** which way a message goes, or null when it cannot go any way */
export function channelFor(pref: Channel, chat: string | null, smsReady: boolean): 'telegram' | 'sms' | null {
  if (pref !== 'sms' && chat) return 'telegram'
  if (pref !== 'telegram' && smsReady) return 'sms'
  return null
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] || ''
const lang = (v: unknown): 'uz' | 'ru' => (v === 'ru' ? 'ru' : 'uz')
const textOf = (own: { uz: string; ru: string }, def: { uz: string; ru: string }, l: 'uz' | 'ru') => own[l]?.trim() || def[l]

export async function loadSettings(): Promise<Settings> {
  const p = await payload()
  const uz = (await p.findGlobal({ slug: 'reminders', depth: 0, locale: 'uz', overrideAccess: true })) as unknown as Record<string, any>
  const ru = (await p.findGlobal({ slug: 'reminders', depth: 0, locale: 'ru', fallbackLocale: false, overrideAccess: true })) as unknown as Record<string, any>
  const ch = (v: unknown, d: Channel): Channel => (v === 'telegram' || v === 'sms' || v === 'telegram_sms' ? v : d)
  return {
    abandonedOn: uz.abandonedOn === true, abandonedAfterMin: Math.min(600, Math.max(15, Number(uz.abandonedAfterMin) || 60)), abandonedChannel: ch(uz.abandonedChannel, 'telegram_sms'),
    abandonedText: { uz: String(uz.abandonedText ?? ''), ru: String(ru.abandonedText ?? '') },
    lapsedOn: uz.lapsedOn === true, lapsedDays: Math.min(365, Math.max(14, Number(uz.lapsedDays) || 45)), lapsedChannel: ch(uz.lapsedChannel, 'telegram'),
    lapsedPromo: String(uz.lapsedPromo ?? '').trim(), lapsedText: { uz: String(uz.lapsedText ?? ''), ru: String(ru.lapsedText ?? '') },
  }
}

/** Who would get a reminder right now (also shown on the admin screen as "next"). Nothing is sent here. */
export async function candidates(run: Run, s: Settings, now = Date.now(), site = siteUrl()): Promise<Candidate[]> {
  const out: Candidate[] = []
  if (s.abandonedOn) {
    // unpaid, still payable (12-hour window), old enough; not when the same phone paid another order since
    const rows = await run(`SELECT o.id, o.number, o.token, o.name, o.phone, o.lang,
        coalesce(o.telegram_chat, (SELECT x.telegram_chat FROM orders x WHERE x.phone = o.phone AND x.telegram_chat IS NOT NULL ORDER BY x.created_at DESC LIMIT 1)) chat
      FROM orders o
      WHERE o.status = 'new' AND o.payment_status IN ('pending', 'cancelled') AND o.created_at < $1 AND o.created_at > $2
        AND NOT EXISTS (SELECT 1 FROM orders y WHERE y.phone = o.phone AND y.payment_status = 'paid' AND y.created_at >= o.created_at)
        AND NOT EXISTS (SELECT 1 FROM reminder_log r WHERE r.key = 'a:' || o.id)
      ORDER BY o.created_at LIMIT 50`, [new Date(now - s.abandonedAfterMin * 60_000), new Date(now - PAY_WINDOW_MS + 30 * 60_000)])
    for (const r of rows) {
      const l = lang(r.lang)
      out.push({ kind: 'abandoned', key: `a:${r.id}`, phone: String(r.phone), name: String(r.name ?? ''), lang: l, chat: r.chat ? String(r.chat) : null, orderNumber: String(r.number),
        text: fill(textOf(s.abandonedText, REMINDER_DEFAULTS.abandoned, l), { ism: firstName(String(r.name ?? '')), buyurtma: String(r.number), havola: `${site}/${l}/buyurtma/${r.number}?t=${r.token}` }) })
    }
  }
  if (s.lapsedOn) {
    // last paid order between N and N+30 days ago (so switching it on does not message the whole history at once),
    // and the latest order says yes to marketing messages
    const rows = await run(`WITH last AS (
        SELECT DISTINCT ON (phone) phone, name, lang, marketing_consent, paid_at FROM orders WHERE payment_status = 'paid' AND paid_at IS NOT NULL ORDER BY phone, created_at DESC)
      SELECT l.phone, l.name, l.lang, l.paid_at,
        (SELECT x.telegram_chat FROM orders x WHERE x.phone = l.phone AND x.telegram_chat IS NOT NULL ORDER BY x.created_at DESC LIMIT 1) chat
      FROM last l
      WHERE l.marketing_consent = true AND l.paid_at < $1 AND l.paid_at > $2
        AND NOT EXISTS (SELECT 1 FROM orders y WHERE y.phone = l.phone AND y.created_at > l.paid_at AND y.payment_status = 'pending' AND y.status = 'new')
        AND NOT EXISTS (SELECT 1 FROM reminder_log r WHERE r.key = 'l:' || l.phone || ':' || to_char(l.paid_at, 'YYYY-MM-DD'))
      LIMIT 50`, [new Date(now - s.lapsedDays * DAY), new Date(now - (s.lapsedDays + 30) * DAY)])
    for (const r of rows) {
      const l = lang(r.lang)
      out.push({ kind: 'lapsed', key: `l:${r.phone}:${new Date(r.paid_at).toISOString().slice(0, 10)}`, phone: String(r.phone), name: String(r.name ?? ''), lang: l, chat: r.chat ? String(r.chat) : null,
        text: fill(textOf(s.lapsedText, REMINDER_DEFAULTS.lapsed, l), { ism: firstName(String(r.name ?? '')), sayt: `${site}/${l}`, promokod: s.lapsedPromo }) })
    }
  }
  return out
}

type Senders = { telegram: (chat: string, text: string) => Promise<{ ok: boolean }>; sms: (phone: string, text: string) => Promise<void>; smsReady: () => Promise<boolean> }
const realSenders: Senders = {
  telegram: (chat, text) => sendTelegram(chat, text),
  sms: (phone, text) => sendSms(phone, text),
  smsReady: async () => !(await smsMock()),
}

let running = false

/** One pass: claim each reminder in the log first (unique key), then send. Never throws. */
export async function runReminders(o: { now?: number; senders?: Senders; force?: boolean } = {}): Promise<Result> {
  const now = o.now ?? Date.now()
  const res: Result = { checked: false, sent: 0, failed: 0, skipped: 0 }
  if (running) return { ...res, reason: 'busy' }
  running = true
  try {
    const s = await loadSettings()
    if (!s.abandonedOn && !s.lapsedOn) return { ...res, reason: 'off' }
    if (!o.force && !allowedHour(now)) return { ...res, reason: 'hours' }
    const senders = o.senders ?? realSenders
    const smsReady = await senders.smsReady()
    const p = await payload()
    for (const c of await candidates(await runner(), s, now)) {
      const via = channelFor(c.kind === 'abandoned' ? s.abandonedChannel : s.lapsedChannel, c.chat, smsReady)
      let log
      try {
        log = await p.create({ collection: 'reminder-log', overrideAccess: true, data: { kind: c.kind, key: c.key, phone: c.phone, orderNumber: c.orderNumber, channel: via ?? 'none', status: 'skipped', note: via ? 'yuborilmoqda' : (smsReady ? 'Telegram ulanmagan' : 'Telegram ulanmagan, SMS sinov rejimida') } })
      } catch { continue } // already claimed (another pass, or the unique key) — never twice
      if (!via) { res.skipped++; continue }
      let ok = false
      try { ok = via === 'telegram' ? (await senders.telegram(c.chat!, c.text)).ok : (await senders.sms(c.phone, c.text), true) } catch { ok = false }
      await p.update({ collection: 'reminder-log', id: log.id, overrideAccess: true, data: { status: ok ? 'sent' : 'failed', note: ok ? '' : via === 'telegram' ? 'Telegram qabul qilmadi (mijoz botni bloklagan boʻlishi mumkin)' : 'SMS yuborilmadi' } })
      if (ok) res.sent++; else res.failed++
    }
    return { ...res, checked: true }
  } catch (e) {
    console.warn('reminders: pass failed —', (e as Error).message.split('\n')[0])
    return { ...res, reason: 'error' }
  } finally {
    running = false
  }
}

/** started once per server process (instrumentation.ts): every 10 minutes */
export function startReminderLoop() {
  const g = globalThis as unknown as { __ypReminders?: NodeJS.Timeout }
  if (g.__ypReminders) return
  g.__ypReminders = setInterval(() => { void runReminders() }, 10 * 60_000)
  g.__ypReminders.unref?.()
}
