'use client'
// Help — design/preview/Help.html + p_more2.py (5 sections). Numbers and contacts come from the store settings;
// a card without a real value (pickup address, phone, cash on delivery …) is not shown.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { fmt, sum } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'

export type HelpStore = {
  tashkentPrice: number; regionPrice: number; regionDays: string; freeDeliveryFrom: number; returnDays: number; orderCutoff: string
  refundDays: string; minShelfMonths: number; pickupAddress?: string; pickupHours: string; supportHours: string
  phone?: string; email?: string; telegramUrl: string; telegramHandle?: string; cashOnDelivery: boolean
}
export const HELP_SLUGS = ['yetkazish', 'tolov', 'qaytarish', 'originallik', 'aloqa'] as const

type Card = [string, string, string] | null
type Sec = { slug: (typeof HELP_SLUGS)[number]; t: string; h: string; lead: string; cards: Card[]; faq: [string, string][] }

export function HelpPage({ lang, store: s, active }: { lang: Lang; store: HelpStore; active: string }) {
  const tr = (x: string) => t(lang, x)
  const L = (p: string) => href(lang, p)
  const router = useRouter()
  const [q, setQ] = useState('')
  const so = (n: number) => `${fmt(n)} ${sum(lang)}`
  const secs: Sec[] = [
    { slug: 'yetkazish', t: 'Yetkazish', h: tr('Qachon va qanday yetkazamiz'),
      lead: tn(lang, 'Toshkentda bugun soat [N] gacha buyurtma bersangiz — ertaga, oʻzingiz tanlagan 3 soatlik oraliqda olib boramiz. Kuryer 30 daqiqa oldin qoʻngʻiroq qiladi.', s.orderCutoff),
      cards: [[tr('Toshkent'), tr('Ertaga'), tn(lang, '[N] soʻmdan bepul, undan kam — [N]', fmt(s.freeDeliveryFrom), so(s.tashkentPrice))],
        [tr('Viloyatlar'), tn(lang, '[N] kun', s.regionDays), tn(lang, 'Pochta xizmati orqali, [N]', so(s.regionPrice))],
        s.pickupAddress ? [tr('Olib ketish'), s.pickupAddress, tn(lang, 'Bugunoq, [N]', s.pickupHours)] : null],
      faq: [['Buyurtmani qayerdaligini qanday bilaman?', 'Telegram bot har bosqichda xabar yuboradi. Kabinetda ham koʻrinadi.'], ['Vaqtni oʻzgartirsa boʻladimi?', 'Ha, kuryer chiqishidan oldin botda yoki telefon orqali.']] },
    { slug: 'tolov', t: 'Toʻlov', h: tr('Qanday toʻlash mumkin'), lead: tr('Toʻlov Click yoki Payme sahifasida oʻtadi — karta maʼlumotlaringizni biz koʻrmaymiz va saqlamaymiz.'),
      cards: [[tr('Onlayn'), 'Click, Payme', tr('Ilova yoki karta orqali')], [tr('Karta'), 'Uzcard, Humo', tr('Toʻlov sahifasida')],
        s.cashOnDelivery ? [tr('Qabul qilganda'), tr('Naqd yoki karta'), tr('Faqat Toshkentda')] : null],
      faq: [['Pul yechildi, buyurtma tasdiqlanmadi?', 'Telegramga chek rasmini yuboring — 15 daqiqada tekshiramiz.'], ['Muddatli toʻlov bormi?', 'Hozircha yoʻq. Qoʻshilsa — shu yerda yozamiz.']] },
    { slug: 'qaytarish', t: 'Qaytarish', h: tr('Mos kelmasa, qaytaramiz'),
      lead: tn(lang, 'Ochilmagan mahsulotni [N] kun ichida qaytarishingiz mumkin. Ochilgan boʻlsa-yu, allergiya chiqsa — yozing, har holatni alohida koʻrib chiqamiz.', s.returnDays),
      cards: [[tr('Muddat'), tn(lang, '[N] kun', s.returnDays), tr('Olgan kundan boshlab')], [tr('Pul qaytishi'), tn(lang, '[N] ish kuni', s.refundDays), tr('Toʻlagan kartangizga')], [tr('Kuryer'), tr('Bepul'), tr('Toshkentda oʻzimiz olib ketamiz')]],
      faq: [['Qanday boshlayman?', 'Kabinetda buyurtmani tanlab «Qaytarish»ni bosing yoki Telegramga yozing.'], ['Sovgʻa qilingan mahsulot-chi?', 'Buyurtma raqami boʻlsa — qaytarsa boʻladi.']] },
    { slug: 'originallik', t: 'Originallik', h: tr('Original ekanini qanday tekshirasiz'), lead: tr('Har bir mahsulotni rasmiy hujjatlar bilan olib kelamiz. Mahsulot sahifasida sertifikat, partiya raqami va yaroqlilik muddati koʻrsatilgan.'),
      cards: [[tr('Hujjat'), tr('Sertifikat'), tr('Mahsulot sahifasida PDF')], [tr('Partiya'), tr('Raqam'), tr('Qutidagi raqam bilan solishtiring')], [tr('Muddat'), tn(lang, 'Kamida [N] oy', s.minShelfMonths), tr('Yaroqlilik muddati qolgan holda')]],
      faq: [['Soxta deb shubhalansam?', 'Rasmini yuboring. Tasdiqlansa — pulni toʻliq qaytaramiz.'], ['Nega marketpleysdan arzon emas?', 'Biz faqat rasmiy partiyalarni olamiz, bu narxga taʼsir qiladi.']] },
    { slug: 'aloqa', t: 'Aloqa', h: tr('Biz bilan bogʻlanish'), lead: tr('Eng tez yoʻl — Telegram. Telefon va doʻkon manzili pastda.'),
      cards: [s.telegramHandle ? ['Telegram', s.telegramHandle, tn(lang, 'Har kuni [N]', s.supportHours)] : null, s.phone ? [tr('Telefon'), s.phone, tr('Ish kunlari')] : null,
        s.pickupAddress ? [tr('Manzil'), s.pickupAddress, tr('Olib ketish nuqtasi')] : null],
      faq: [...(s.email ? [['Hamkorlik uchun?', `${s.email} — ${tr('manziliga yozing.')}`] as [string, string]] : []), ['Ulgurji narx bormi?', 'Salonlar uchun alohida shartlar — Telegramda soʻrang.']] },
  ]
  const cur = secs.find((x) => x.slug === active) ?? secs[0]
  const find = () => {
    const n = q.trim().toLowerCase()
    if (!n) return
    const hit = secs.find((x) => [x.t, x.h, x.lead, ...x.faq.flat()].some((v) => tr(v).toLowerCase().includes(n)))
    if (hit) router.push(L(`/yordam/${hit.slug}`))
  }
  return (
    <div className="wrap" style={{ marginTop: '16px' }}>
      <nav aria-label={tr('Yoʻl')} className="muted" style={{ fontSize: '13px', display: 'flex', gap: '8px' }}><Link href={L('/')} style={{ color: '#6B5F59' }}>{tr('Bosh sahifa')}</Link><span>/</span><span style={{ color: '#2A211E' }}>{tr('Yordam')}</span></nav>
      <section className="card pad-m" style={{ marginTop: '12px', padding: '36px', background: '#F2D6D0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h1 className="h h1" style={{ fontSize: '46px' }}>{tr('Qanday yordam bera olamiz?')}</h1>
        <form onSubmit={(e) => { e.preventDefault(); find() }} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 6px 6px 20px', borderRadius: '999px', background: '#FBFAF7', maxWidth: '720px' }}>
          <Icon name="search" /><input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Masalan: qachon yetkazasizlar, qaytarish')} aria-label={tr('Yordam boʻyicha qidirish')} style={{ border: 'none', background: 'transparent', flex: 1, minHeight: 0, padding: '10px 0', minWidth: 0 }} /><button className="pill dark">{tr('Topish')}</button>
        </form>
      </section>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px', alignItems: 'flex-start' }}>
        <nav role="tablist" aria-orientation="vertical" className="card" style={{ flex: '1 1 260px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'sticky', top: '20px' }}>
          {secs.map((x) => (
            <Link key={x.slug} href={L(`/yordam/${x.slug}`)} role="tab" aria-selected={x === cur} style={{ display: 'flex', gap: '10px', alignItems: 'center', minHeight: '48px', padding: '0 14px', borderRadius: '14px', background: x === cur ? '#2A211E' : 'transparent', color: x === cur ? '#FBFAF7' : '#2A211E', textDecoration: 'none', fontSize: '15px' }}>{tr(x.t)}</Link>
          ))}
        </nav>
        <section className="card pad-m" style={{ flex: '999 1 760px', minWidth: 0, padding: '32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <h2 className="h" style={{ fontSize: '32px' }}>{cur.h}</h2>
          <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.65, color: '#4A3F3A' }}>{cur.lead}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {cur.cards.filter((c): c is [string, string, string] => !!c).map(([k, v, d]) => (
              <div key={k} style={{ padding: '18px', borderRadius: '18px', background: '#F6F3EF', display: 'flex', flexDirection: 'column', gap: '4px' }}><span className="muted" style={{ fontSize: '13px' }}>{k}</span><b style={{ fontWeight: 600, fontSize: '17px' }}>{v}</b><span className="muted" style={{ fontSize: '13px' }}>{d}</span></div>
            ))}
          </div>
          <div>{cur.faq.map(([qq, a]) => <div key={qq} style={{ padding: '16px 0', borderTop: '1px solid #EFE9E3' }}><b style={{ fontWeight: 600, fontSize: '16px' }}>{tr(qq)}</b><p className="muted" style={{ margin: '6px 0 0', fontSize: '15px', lineHeight: 1.55 }}>{tr(a)}</p></div>)}</div>
        </section>
      </div>
      <section data-g="3" style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
        <a href={s.telegramUrl} className="card" style={{ padding: '22px', textDecoration: 'none', display: 'flex', gap: '14px', alignItems: 'center' }}><Icon name="tg" size={26} /><span><b style={{ fontWeight: 600 }}>Telegram</b><br /><span className="muted" style={{ fontSize: '14px' }}>{tr('Odatda 5 daqiqada javob beramiz')}</span></span></a>
        {s.phone && <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} className="card" style={{ padding: '22px', textDecoration: 'none', display: 'flex', gap: '14px', alignItems: 'center' }}><Icon name="chat" size={26} /><span><b style={{ fontWeight: 600 }}>{s.phone}</b><br /><span className="muted" style={{ fontSize: '14px' }}>{tn(lang, 'Har kuni [N]', s.supportHours)}</span></span></a>}
        <Link href={L('/maslahatchi')} className="card" style={{ padding: '22px', textDecoration: 'none', display: 'flex', gap: '14px', alignItems: 'center' }}><Icon name="spark" size={26} /><span><b style={{ fontWeight: 600 }}>{tr('Mahsulot tanlashda')}</b><br /><span className="muted" style={{ fontSize: '14px' }}>{tr('AI maslahatchi — kecha-kunduz')}</span></span></Link>
      </section>
    </div>
  )
}
