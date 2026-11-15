'use client'
// Consultant — design/preview/Consultant.html. Rule-based for now (3 questions → skin, concern, time → a routine
// from the real catalog); free text is read with lib/search `understand`. No diagnosis, no photos.
// ponytail: an LLM chat can replace `reply` later behind the same UI.
import Link from 'next/link'
import { useState } from 'react'

import { CONCERNS, SKIN } from '@/collections/catalog'
import { ProductCard } from '@/components/ProductCard'
import type { HomeCard } from '@/lib/catalog'
import { href, t, tn, type Lang } from '@/lib/i18n'
import { understand } from '@/lib/search'

const Q1: [string, string][] = [['Tortishadi, quruqlik sezadi', 'dry'], ['Yaltiray boshlaydi', 'oily'], ['Peshona yaltiraydi, yonoqlar normal', 'combo'], ['Tez qizaradi, achishadi', 'sens'], ['Hech narsa sezilmaydi', 'normal']]
const Q2: [string, string][] = [['Qizarish va toshmalar', 'acne'], ['Kengaygan poralar', 'pores'], ['Pigment dogʻlar', 'pigment'], ['Quruqlik, tortishish', 'dryness'], ['Birinchi ajinlar', 'wrinkles'], ['Xira rang', 'dull']]
const Q3: [string, string[]][] = [['1–2 daqiqa, tezroq', ['serum', 'spf']], ['5 daqiqa normal', ['toner', 'serum', 'krem', 'spf']], ['Yoqtiraman, 10+ daqiqa', ['tozalash', 'toner', 'essensiya', 'serum', 'krem', 'spf']]]
const ASK = [
  'Salom! Men sizga mos parvarishni tanlashga yordam beraman. Avval oddiy savol: yuvinib, hech narsa surtmasangiz, 1–2 soatdan keyin teringiz qanday boʻladi?',
  'Tushunarli. Hozir eng koʻp nima bezovta qilyapti? Bittasini tanlang — keyin boshqasiga ham qaytamiz.',
  'Oxirgi savol: ertalab parvarishga qancha vaqt ajratasiz?',
]
type Msg = { me: boolean; text: string }
const label = (list: { value: string; label: { uz: string; ru: string } }[], lang: Lang, v?: string) => (v ? list.find((x) => x.value === v)?.label[lang] : undefined)

export function ConsultantPage({ lang, products, brands, telegram, hours, signedIn }: { lang: Lang; products: HomeCard[]; brands: { slug: string; name: string }[]; telegram: string; hours: string; signedIn: boolean }) {
  const tr = (s: string) => t(lang, s)
  const [msgs, setMsgs] = useState<Msg[]>([{ me: false, text: tr(ASK[0]) }])
  const [skin, setSkin] = useState<string>()
  const [concern, setConcern] = useState<string>()
  const [time, setTime] = useState<number>()
  const [text, setText] = useState('')
  const [misses, setMisses] = useState(0)
  const [saved, setSaved] = useState(false)
  const step = skin === undefined ? 0 : concern === undefined ? 1 : time === undefined ? 2 : 3
  const say = (mine: string, s?: string, c?: string, ti?: number) => {
    const next = s === undefined ? 0 : c === undefined ? 1 : ti === undefined ? 2 : 3
    setMsgs((m) => [...m, { me: true, text: mine }, { me: false, text: next < 3 ? tr(ASK[next]) : tr('Mana sizga mos rutina. Yangi vositani birinchi 3 kun alohida sinab koʻring. Toshma kuchli yoki uzoq davom etsa — dermatologga uchrashing.') }])
  }
  const pick = (v: string, shown: string) => {
    if (step === 0) { setSkin(v); say(shown, v) }
    else if (step === 1) { setConcern(v); say(shown, skin, v) }
    else if (step === 2) { const n = Number(v); setTime(n); say(shown, skin, concern, n) }
  }
  const send = (e: React.FormEvent) => {
    e.preventDefault()
    const q = text.trim()
    if (!q) return
    setText('')
    const u = understand(q, brands)
    const s = skin ?? u.skin, c = concern ?? u.concern
    if (s === skin && c === concern) {
      const n = misses + 1
      setMisses(n)
      setMsgs((m) => [...m, { me: true, text: q }, { me: false, text: tr(n >= 2 ? 'Kechirasiz, tushunmadim. Kosmetologimizga Telegramda yozing — u yordam beradi.' : 'Tushunmadim. Pastdagi tugmalardan birini tanlang yoki boshqacha yozing.') }])
      return
    }
    setSkin(s); setConcern(c)
    say(q, s, c, time)
  }
  const restart = () => { setSkin(undefined); setConcern(undefined); setTime(undefined); setMisses(0); setSaved(false); setMsgs([{ me: false, text: tr(ASK[0]) }]) }

  // one product per step: in stock, fits the skin and the concern best
  const plan = step === 3 ? Q3[time!][1].map((cat) => products
    .filter((p) => p.category === cat && p.stock > 0)
    .map((p) => ({ p, s: (p.skin.includes(skin!) ? 2 : 0) + (p.concerns.includes(concern!) ? 3 : 0) }))
    .sort((a, b) => b.s - a.s)[0]?.p).filter((p): p is HomeCard => !!p) : []

  const options: [string, string][] = step === 0 ? Q1 : step === 1 ? Q2 : step === 2 ? Q3.map(([l], i) => [l, String(i)]) : []
  const bubble = (m: Msg, i: number) => (
    <div key={i} style={{ display: 'flex', justifyContent: m.me ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '560px', padding: '14px 18px', borderRadius: m.me ? '22px 22px 6px 22px' : '22px 22px 22px 6px', background: m.me ? '#2A211E' : '#FBFAF7', color: m.me ? '#FBFAF7' : '#2A211E', fontSize: '15px', lineHeight: 1.55 }}>{m.text}</div>
    </div>
  )
  const fact = (k: string, v?: string) => <span style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px', padding: '6px 0', borderTop: '1px solid #EFE9E3' }}><span className="muted">{tr(k)}</span><b style={{ fontWeight: 600, textAlign: 'right' }}>{v ?? '—'}</b></span>
  return (
    <div className="wrap" style={{ marginTop: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <section className="card" style={{ flex: '999 1 760px', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: '760px' }} aria-label={tr('Maslahatchi bilan suhbat')}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #EFE9E3' }}>
          <span style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden' }}><img className="ph" src="/img/face-white.jpg" alt="" style={{ objectPosition: '50% 25%' }} /></span>
          <span style={{ flex: 1 }}><h1 style={{ fontWeight: 600, fontSize: 'inherit', margin: 0, display: 'inline' }}>{tr('Yeppo maslahatchisi')}</h1><br /><span className="muted" style={{ fontSize: '13px' }}>{tr('Avtomatik tanlovchi · tibbiy tashxis qoʻymaydi')}</span></span>
          <button className="pill ghost" style={{ minHeight: '40px' }} onClick={restart}>↺ {tr('Boshidan')}</button>
        </div>
        <div aria-live="polite" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#F6F3EF' }}>
          {msgs.map(bubble)}
          {plan.length > 0 && <div className="pgrid">{plan.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #EFE9E3', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {options.length > 0 && <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{options.map(([l, v]) => <button key={v} className="pill line" style={{ minHeight: '44px' }} onClick={() => pick(v, tr(l))}>{tr(l)}</button>)}</div>}
          {step < 3 && (
            <form onSubmit={send} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 6px 6px 18px', borderRadius: '999px', background: '#fff', border: '1px solid #E2DAD2' }}>
              <input className="inp" value={text} onChange={(e) => setText(e.target.value)} placeholder={tr('Yoki oʻz soʻzingiz bilan yozing…')} aria-label={tr('Xabar')} style={{ border: 'none', background: 'transparent', flex: 1, minHeight: 0, padding: '10px 0' }} />
              <button className="ib" aria-label={tr('Yuborish')} style={{ background: '#2A211E', color: '#FBFAF7' }}>➤</button>
            </form>
          )}
          {step === 3 && <Link href={href(lang, '/rutina')} className="pill dark" style={{ alignSelf: 'flex-start' }}>{tr('Rutina konstruktorida ochish')}</Link>}
        </div>
      </section>

      <aside style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '20px' }}>
        <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <b style={{ fontWeight: 600 }}>{tr('Siz haqingizda tushunganim')}</b>
          {fact('Teri turi', label(SKIN, lang, skin))}{fact('Asosiy muammo', label(CONCERNS, lang, concern))}{fact('Vaqt', time !== undefined ? tr(Q3[time][0]) : undefined)}
          <span className="muted" style={{ fontSize: '12px' }}>{tr('Bu maʼlumot faqat tanlash uchun. Kabinetda saqlash — sizning xohishingiz.')}</span>
          {signedIn && skin && (saved ? <span style={{ color: '#2F5228', fontSize: '14px' }}>{tr('Saqlandi ✓')}</span>
            : <button className="pill line" onClick={async () => { const r = await fetch('/api/account', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ skin, concerns: concern ? [concern] : [] }) }); setSaved(r.ok) }}>{tr('Kabinetga saqlash')}</button>)}
        </div>
        <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#F6F3EF' }}>
          <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><b style={{ fontWeight: 600 }}>{tr('Selfi orqali tahlil')}</b><span className="chip">{tr('Tez orada')}</span></span>
          <span className="muted" style={{ fontSize: '14px' }}>{tr('Yuridik tekshiruvdan keyin yoqiladi: rozilik bilan, rasm tahlildan soʻng oʻchiriladi, maʼlumot Oʻzbekistonda saqlanadi.')}</span>
        </div>
        <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <b style={{ fontWeight: 600 }}>{tr('Odamga yozmoqchimisiz?')}</b>
          <span className="muted" style={{ fontSize: '14px' }}>{tn(lang, 'Kosmetolog-konsultantimiz Telegramda, [N]', hours)}</span>
          <a href={telegram} target="_blank" rel="noopener" className="pill line">{tr('Telegramda yozish')}</a>
        </div>
      </aside>
    </div>
  )
}
