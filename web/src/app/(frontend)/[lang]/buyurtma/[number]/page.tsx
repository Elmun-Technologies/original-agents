// Order accepted / tracking — design/screens/Order.jpg. Opened only with the secret token from the checkout.
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Icon } from '@/components/icons'
import { ProductCard } from '@/components/ProductCard'
import { findCards, getStore, payload } from '@/lib/catalog'
import { fmt, sum } from '@/lib/format'
import { href, isLang, t, tn } from '@/lib/i18n'
import { payable } from '@/lib/order-state'
import { getOrder } from '@/lib/orders'
import { payUrl, providerOf } from '@/lib/payments'

export const metadata = { robots: { index: false } }
export const dynamic = 'force-dynamic'

const STAGES = [
  ['accepted', 'Qabul qilindi', 'Buyurtmangizni oldik va toʻlov oʻtdi. Hozir omborda yigʻishni boshlaymiz.'],
  ['assembling', 'Yigʻilmoqda', 'Mahsulotlarni tekshirib, partiya va muddatini yana bir bor koʻrib, qadoqlayapmiz.'],
  ['shipping', 'Yoʻlda', 'Kuryer yoʻlda. U sizga 30 daqiqa oldin qoʻngʻiroq qiladi.'],
  ['delivered', 'Yetkazildi', 'Topshirildi. Mahsulot yoqdimi? Bir-ikki soʻz bilan sharh qoldirsangiz, boshqalarga katta yordam boʻladi.'],
] as const

export default async function OrderPage({ params, searchParams }: { params: Promise<{ lang: string; number: string }>; searchParams: Promise<{ t?: string }> }) {
  const { lang, number } = await params
  const { t: token } = await searchParams
  if (!isLang(lang)) notFound()
  const o = await getOrder(number, token ?? '')
  if (!o) notFound()
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const store = await getStore()
  const recs = (await findCards(lang, { slug: { not_in: o.items.map((i) => i.slug ?? '') } }, 5, 'createdAt') /* by product, not SKU: other volumes of a bought product are not 'new' */)
  const paid = o.paymentStatus === 'paid' || o.paymentStatus === 'refund'
  const codes = paid ? (await (await payload()).find({ collection: 'gift-cards', where: { orderNumber: { equals: o.number } }, depth: 0, limit: 50, overrideAccess: true })).docs : []
  const stage = Math.max(0, STAGES.findIndex((s) => s[0] === o.status))
  const time = (d?: string | null) => (d ? new Date(d).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' }) : '')
  const when = o.delivery === 'tashkent' ? tr('Ertaga') : tn(lang, '[N] kun ichida', store.regionDays)
  const dates = [`${tr('Bugun')}, ${time(o.paidAt)}`, tr('Bugun'), when, o.delivery === 'tashkent' && o.slot ? `${tr('Ertaga')}, ${o.slot}` : when]
  const provider = await providerOf(o.payment)
  const payHref = await payUrl(o)
  const canPay = payable(o)
  const tgLink = `${store.telegramBotUrl}${store.telegramBotUrl.includes('?') ? '&' : '?'}start=order_${o.number}`

  return (
    <div className="wrap" style={{ marginTop: '20px' }}>
      {paid ? (
        <section className="card pad-m" style={{ padding: '36px', display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center', background: '#E8F0E4' }}>
          <span style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#2F5228', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="check" size={34} sw={2.2} /></span>
          <div style={{ flex: '1 1 420px' }}>
            <h1 className="h h1" style={{ fontSize: '40px' }}>{tn(lang, 'Rahmat, [N]! Buyurtmangiz qabul qilindi', o.name)}</h1>
            <p style={{ margin: '10px 0 0', fontSize: '16px', lineHeight: 1.55, color: '#2F3A2B' }}>
              {tr('Buyurtma')} <b>№ {o.number}</b>. {o.delivery === 'tashkent' && o.slot
                ? tn(lang, 'Ertaga [N] oraligʻida olib boramiz.', o.slot)
                : tn(lang, 'Pochta orqali [N] kunda yetib boradi.', store.regionDays)} {o.telegramUpdates ? tr('Kuryer yoʻlga chiqqanda Telegramda xabar beramiz.') : ''}
            </p>
          </div>
          {o.telegramUpdates && <a href={tgLink} className="pill dark" style={{ minHeight: '52px' }}><Icon name="tg" size={18} /> {tr('Telegramda kuzatish')}</a>}
        </section>
      ) : (
        <section className="card pad-m" style={{ padding: '36px', display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center', background: '#F5DCC9' }}>
          <div style={{ flex: '1 1 420px' }}>
            <h1 className="h h1" style={{ fontSize: '40px' }}>{tr(o.status === 'cancelled' ? 'Buyurtma bekor qilingan' : !canPay ? 'Toʻlov muddati tugadi' : o.paymentStatus === 'cancelled' ? 'Toʻlov oʻtmadi' : 'Toʻlov kutilmoqda')}</h1>
            <p style={{ margin: '10px 0 0', fontSize: '16px', lineHeight: 1.55 }}>{tr('Buyurtma')} <b>№ {o.number}</b>. {tr(o.status === 'cancelled' ? 'Savolingiz boʻlsa, Telegramda yozing — yordam beramiz.'
              : !canPay ? 'Buyurtma 12 soat ichida toʻlanmadi, shuning uchun yopildi. Pul yechilmagan. Narx va qoldiq oʻzgargan boʻlishi mumkin — savatdan qaytadan rasmiylashtiring.'
              : 'Toʻlov oʻtgach buyurtmani yigʻishni boshlaymiz. Pul faqat toʻlov tizimi tasdiqlagandan keyin hisobga olinadi.')}</p>
          </div>
          {canPay
            ? <a href={payHref} className="pill dark" style={{ minHeight: '52px' }}>{tn(lang, '[N] orqali [N] toʻlash', provider === 'click' ? 'Click' : 'Payme', `${fmt(o.total)} ${sum(lang)}`)}</a>
            : <Link href={L(o.status === 'cancelled' ? '/yordam/aloqa' : '/savat')} className="pill dark" style={{ minHeight: '52px' }}>{tr(o.status === 'cancelled' ? 'Bogʻlanish' : 'Savatga oʻtish')}</Link>}
        </section>
      )}

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px', alignItems: 'flex-start' }}>
        <section className="card pad-m" style={{ flex: '999 1 620px', minWidth: 0, padding: '30px' }} aria-labelledby="tr-h">
          {paid && o.status !== 'cancelled' && (
            <>
              <h2 id="tr-h" className="h" style={{ fontSize: '26px' }}>{tr('Buyurtma qayerda?')}</h2>
              <ol data-g="4" style={{ listStyle: 'none', margin: '22px 0 0', padding: 0, display: 'grid', gap: '8px' }}>
                {STAGES.map(([id, label], i) => (
                  <li key={id} aria-current={i === stage ? 'step' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ height: '6px', borderRadius: '999px', background: i <= stage ? '#2F5228' : '#E2DAD2' }} />
                    <b style={{ fontSize: '14px', fontWeight: 600, color: i <= stage ? '#2A211E' : '#8A7F79' }}>{tr(label)}</b>
                    <span className="muted" style={{ fontSize: '12px' }}>{dates[i]}</span>
                  </li>
                ))}
              </ol>
              <div style={{ marginTop: '22px', padding: '16px 18px', borderRadius: '16px', background: '#F6F3EF', fontSize: '15px', lineHeight: 1.55 }}>{tr(STAGES[stage][2])}</div>
            </>
          )}
          <h3 className="h" style={{ fontSize: '20px', marginTop: paid ? '26px' : 0 }} id={paid ? undefined : 'tr-h'}>{tr('Tarkibi')}</h3>
          {o.items.map((it) => (
            <div key={it.sku} style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #EFE9E3' }}>
              {it.img && <img loading="lazy" decoding="async" src={it.img} alt="" style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover' }} />}
              <span style={{ flex: 1, fontSize: '14px' }}><Link href={L(`/mahsulot/${it.slug}`)} style={{ textDecoration: 'none' }}><b style={{ fontWeight: 600 }}>{it.brand}</b> {it.name}</Link><br /><span className="muted">{[it.volume, tn(lang, '[N] dona', it.qty)].filter(Boolean).join(' · ')}</span></span>
              <span className="num" style={{ fontSize: '16px' }}>{fmt(it.price * it.qty)} {sum(lang)}</span>
            </div>
          ))}
          {(o.discount ?? 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '14px' }}><span className="muted">{o.discountLabel === 'routine' ? tr('Tayyor rutina') : `${tr('Promokod')} ${o.discountLabel}`}</span><span style={{ color: '#A8475C' }}>−{fmt(o.discount!)} {sum(lang)}</span></div>}
          {(o.pointsUsed ?? 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '14px' }}><span className="muted">{tr('Bonus ballar')}</span><span style={{ color: '#A8475C' }}>−{fmt(o.pointsUsed!)} {sum(lang)}</span></div>}
          {(o.deliveryFee ?? 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '14px' }}><span className="muted">{tr('Yetkazish')}</span><span>{fmt(o.deliveryFee!)} {sum(lang)}</span></div>}
          {(o.giftFee ?? 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '14px' }}><span className="muted">{tr('Sovgʻa qutisi')}</span><span>{fmt(o.giftFee!)} {sum(lang)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontSize: '15px' }}>
            <span className="muted">{paid ? `${tr('Toʻlandi')} · ${provider === 'click' ? 'Click' : 'Payme'}` : tr('Toʻlanishi kerak')}</span><b className="num" style={{ fontSize: '20px' }}>{fmt(o.total)} {sum(lang)}</b>
          </div>
        </section>
        {paid && (
          <aside style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="card" style={{ padding: '24px', background: '#2A211E', color: '#FBFAF7', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden' }}><img loading="lazy" decoding="async" className="ph" src="/img/face-touch.jpg" alt="" style={{ objectPosition: '50% 25%' }} /></span><b style={{ fontWeight: 600 }}>{tr('Kelganda qanday ishlatasiz')}</b></span>
              <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.7, fontSize: '15px', color: '#E9E1DC' }}>
                <li>{tr('Ertalab: yuvish → toner → serum → krem → SPF')}</li>
                <li>{tr('Kechqurun: yuvish → toner → serum → krem')}</li>
                <li>{tr('Yangi vositani birinchi 3 kun alohida sinab koʻring')}</li>
              </ol>
              <Link href={L('/rutina')} className="pill" style={{ borderColor: 'rgba(251,250,247,.3)', color: '#FBFAF7', alignSelf: 'flex-start' }}>{tr('Rutinani saqlash')}</Link>
            </div>
            {codes.length > 0 && (
              <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <b style={{ fontWeight: 600, fontSize: '17px' }}>{tr('Sertifikat kodlari')}</b>
                {codes.map((c) => <span key={c.code} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 14px', borderRadius: '12px', background: '#F6F3EF' }}><b className="num" style={{ letterSpacing: '.04em' }}>{c.code}</b><span>{fmt(c.balance)} {sum(lang)}</span></span>)}
                <span className="muted" style={{ fontSize: '13px' }}>{tr('Kodni savatdagi «Promokod» maydoniga kiriting. 12 oy amal qiladi.')}</span>
              </div>
            )}
            {(o.pointsEarned ?? 0) > 0 && <div className="card" style={{ padding: '24px', background: '#F2D6D0', display: 'flex', flexDirection: 'column', gap: '6px' }}><b className="num" style={{ fontSize: '28px' }}>+{fmt(o.pointsEarned!)}</b><span>{tr('ball hisobingizga tushdi')}</span><Link href={L('/bonus')} style={{ fontSize: '14px', fontWeight: 600 }}>{tr('Bonus dasturi ›')}</Link></div>}
          </aside>
        )}
      </div>

      {recs.length > 0 && (
        <section style={{ marginTop: '32px' }} aria-labelledby="nx-h">
          <h2 id="nx-h" className="h" style={{ fontSize: '28px', marginBottom: '16px' }}>{tr('Keyingi safar sizga yoqishi mumkin')}</h2>
          <div className="pgrid">{recs.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>
        </section>
      )}
    </div>
  )
}
