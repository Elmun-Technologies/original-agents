// Loyalty — design/preview/Loyalty.html. Tiers and rules come from Store.loyalty (admin, sample values);
// without tiers the programme is shown as "coming soon". Progress only for a signed-in customer.
import Link from 'next/link'

import { fmt, sum } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'

const TICK = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>
const BG = ['#F2D6D0', '#F5DCC9', '#E8DDD3']
export type LoyaltyTier = { name: string; percent: number; from: number; perks: string[] }
export type LoyaltyData = { tiers: LoyaltyTier[]; maxUsePct?: number | null; creditDays?: number | null; expireMonths?: number | null; me: { spent: number; tier: string | null; balance: number; expiresAt?: string | null } | null }

export function LoyaltyPage({ lang, d }: { lang: Lang; d: LoyaltyData }) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const on = d.tiers.length > 0
  const next = d.me ? d.tiers.find((x) => x.from > d.me!.spent) : null
  return (
    <div className="wrap" style={{ marginTop: '16px' }}>
      <nav aria-label={tr('Yoʻl')} className="muted" style={{ fontSize: '13px', display: 'flex', gap: '8px' }}><Link href={L('/')} style={{ color: '#6B5F59' }}>{tr('Bosh sahifa')}</Link><span>/</span><span style={{ color: '#2A211E' }}>{tr('Bonus dasturi')}</span></nav>
      <section className="card" style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', background: '#2A211E', color: '#FBFAF7', minHeight: '340px' }}>
        <div className="pad-m" style={{ flex: '1 1 560px', padding: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
          <span className="eyebrow" style={{ color: '#F2D6D0' }}>{tr('Bonus dasturi')}</span>
          <h1 className="h h1" style={{ fontSize: '50px', lineHeight: 1.04 }}>{tr('Har xariddan qaytadi.')} <span className="serif" style={{ fontStyle: 'italic', color: '#F2D6D0' }}>{tr(on ? 'Shunchaki.' : 'Tez orada.')}</span></h1>
          <p style={{ margin: 0, fontSize: '17px', lineHeight: 1.6, color: '#E9E1DC', maxWidth: '520px' }}>{tr(on ? 'Har xariddan ball yigʻiladi, 1 ball = 1 soʻm. Keyingi buyurtmada chegirma sifatida ishlatasiz. Roʻyxatdan oʻtish — telefon raqam bilan, 20 soniya.' : 'Dastur shartlarini tayyorlayapmiz. Ishga tushganda Telegramda xabar beramiz.')}</p>
          {on && <Link href={L(d.me ? '/kabinet' : '/kirish')} className="pill" style={{ alignSelf: 'flex-start', background: '#F2D6D0', borderColor: '#F2D6D0', color: '#2A211E' }}>{d.me ? tn(lang, 'Sizda [N] ball', fmt(d.me.balance)) : tr('Qoʻshilish')}</Link>}
          {on && d.me?.expiresAt && <span style={{ fontSize: '14px', color: '#E9E1DC' }}>{tn(lang, 'Ballar [N] gacha amal qiladi', new Date(d.me.expiresAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { timeZone: 'Asia/Tashkent' }))}</span>}
        </div>
        <div style={{ flex: '1 1 420px', minHeight: '340px', position: 'relative' }}><img className="ph" src="/img/face-loyalty.jpg" alt="" style={{ position: 'absolute', inset: 0, objectPosition: '50% 25%' }} /></div>
      </section>

      {on && (
        <section data-g="3" style={{ marginTop: '16px', display: 'grid', gap: '12px' }} aria-label={tr('Darajalar')}>
          {d.tiers.map((x, i) => {
            const mine = d.me?.tier === x.name
            return (
              <div key={x.name} className="card" style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: '10px', background: mine ? '#FBFAF7' : BG[i % 3], border: `1.5px solid ${mine ? '#2A211E' : 'transparent'}` }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b className="h" style={{ fontSize: '26px' }}>{x.name}</b><span className="num" style={{ fontSize: '34px', color: '#A8475C' }}>{x.percent}%</span></span>
                <span className="muted" style={{ fontSize: '14px' }}>{x.from ? tn(lang, '[N] soʻmdan', fmt(x.from)) : tr('Birinchi xariddan')}</span>
                <span style={{ display: 'flex', gap: '8px', fontSize: '14px' }}>{TICK} {tn(lang, 'Har xariddan [N]% ball', x.percent)}</span>
                {x.perks.map((p) => <span key={p} style={{ display: 'flex', gap: '8px', fontSize: '14px' }}>{TICK} {p}</span>)}
                {mine && <span className="chip dark" style={{ alignSelf: 'flex-start', background: '#2A211E', color: '#FBFAF7' }}>{tr('Siz shu yerdasiz')}</span>}
              </div>
            )
          })}
        </section>
      )}

      {on && d.me && next && (
        <section className="card pad-m" style={{ marginTop: '16px', padding: '28px' }} aria-labelledby="pr-h">
          <div className="sec-h"><h2 id="pr-h" className="h" style={{ fontSize: '24px' }}>{tn(lang, '«[N]» darajasigacha', next.name)}</h2><span className="num" style={{ fontSize: '18px' }}>{fmt(d.me.spent)} / {fmt(next.from)} {sum(lang)}</span></div>
          <span style={{ display: 'block', height: '10px', borderRadius: '999px', background: '#EFE9E3', marginTop: '14px', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.min(100, (d.me.spent / next.from) * 100)}%`, background: '#A8475C' }} /></span>
          <p className="muted" style={{ margin: '12px 0 0', fontSize: '15px' }}>{tn(lang, 'Yana [N] soʻmlik xarid — va har buyurtmadan [N]% qaytadi.', fmt(next.from - d.me.spent), next.percent)}</p>
        </section>
      )}

      {on && (
        <section className="card pad-m" style={{ marginTop: '16px', padding: '28px' }} aria-label={tr('Savollar')}>
          <b className="h" style={{ fontSize: '24px' }}>{tr('Shartlar qisqacha')}</b>
          <div data-g="2" style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
            <p><b>{tr('Ball qachon tushadi?')}</b><br /><span className="muted">{d.creditDays ? tn(lang, 'Buyurtma yetkazilganidan keyin [N] kun ichida.', d.creditDays) : tr('Buyurtma yetkazilgach.')}</span></p>
            {d.maxUsePct ? <p><b>{tr('Qancha ishlatsa boʻladi?')}</b><br /><span className="muted">{tn(lang, 'Buyurtma summasining [N]% igacha.', d.maxUsePct)}</span></p> : null}
            {d.expireMonths ? <p><b>{tr('Ball yonib ketadimi?')}</b><br /><span className="muted">{tn(lang, '[N] oy xarid qilmasangiz — ha. Muddat kabinetingizda koʻrinadi.', d.expireMonths)}</span></p> : null}
            <p><b>{tr('Aksiyadagi mahsulotga-chi?')}</b><br /><span className="muted">{tr('Ball yigʻiladi, lekin promokod bilan birga ishlatilmaydi.')}</span></p>
          </div>
        </section>
      )}
    </div>
  )
}
