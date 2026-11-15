'use client'
// Cart (design/preview/Cart.html, p_cart.py; phone: p_mobile.py "cart"). Prices from the server quote.
import Link from 'next/link'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { useShop, type CardProduct } from '@/components/shop'
import { fmt, sum } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'
import type { Quote } from '@/lib/pricing'
import { useQuote, type QuoteResponse } from './useQuote'

export const PROMO_ERR: Record<NonNullable<Quote['promoError']>, string> = {
  not_found: 'Bunday promokod topilmadi',
  inactive: 'Bu promokod hozir ishlamaydi',
  expired: 'Promokod muddati tugagan',
  min_total: 'Bu promokod uchun buyurtma summasi yetarli emas',
  first_order: 'Bu promokod faqat birinchi buyurtmaga',
}

/** "✓ SALOM10 qoʻllandi — birinchi buyurtmaga −10%" / routine bundle / error. */
export function promoLine(lang: Lang, q: Quote, code: string) {
  const tr = (s: string) => t(lang, s)
  if (q.discountLabel === 'routine') return { ok: true, text: `✓ ${tr('Tayyor rutina uchun chegirma')} — −${fmt(q.discount)} ${sum(lang)}` }
  if (q.discountLabel) return { ok: true, text: `✓ ${q.discountLabel} ${tr('qoʻllandi')} — ${q.discountNote ?? `−${fmt(q.discount)} ${sum(lang)}`}` }
  if (code && q.promoError) return { ok: false, text: tr(PROMO_ERR[q.promoError]) }
  return null
}

const toCard = (s: NonNullable<QuoteResponse['suggest']>): CardProduct =>
  ({ slug: s.slug, sku: s.sku, brand: s.brand, name: s.name, img: s.img, vol: s.volume, price: s.price, tags: [] })

export function CartView({ lang }: { lang: Lang }) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const shop = useShop()
  const { data, loading } = useQuote(lang)
  const [code, setCode] = useState<string | null>(null)
  const q = data?.quote
  const lines = q?.lines ?? []
  const promoInput = code ?? shop.promo
  const promo = q ? promoLine(lang, q, shop.promo) : null
  const ship = q && (q.freeLeft > 0
    ? { say: tn(lang, 'Yana [N] soʻmlik mahsulot qoʻshsangiz — yetkazish bepul', fmt(q.freeLeft)), pct: Math.min(100, Math.round(((data!.freeFrom - q.freeLeft) / data!.freeFrom) * 100)), bg: '#FBFAF7' }
    : { say: tr('Zoʻr! Yetkazish bepul — tejadingiz'), pct: 100, bg: '#E8F0E4' })
  const suggest = data?.suggest
  const reason = suggest?.reason === 'spf' ? tr('Savatingizda serum bor, lekin SPF yoʻq. Kunduzi himoyasiz serum yarim ishlaydi.') : tr('Tonerdan keyin serum yaxshiroq singadi.')
  const qtyBox = (sku: string, qty: number, small = false) => (
    <div style={small ? { display: 'flex', alignItems: 'center', borderRadius: '999px', background: '#F0EEE9' } : { display: 'flex', alignItems: 'center', gap: '2px', padding: '4px', borderRadius: '14px', background: '#F0EBE5' }}>
      <button className="ib" style={small ? { width: '36px', height: '36px' } : { width: '38px', height: '38px', background: '#FBFAF7', borderRadius: '10px' }} aria-label={tr('Kamaytirish')} onClick={() => shop.setQty(sku, qty - 1)}><Icon name="minus" size={small ? 14 : 15} sw={2} /></button>
      <span className="num" style={small ? { width: '20px', textAlign: 'center', fontSize: '14px' } : { minWidth: '30px', textAlign: 'center', fontSize: '17px' }}>{qty}</span>
      <button className="ib" style={small ? { width: '36px', height: '36px' } : { width: '38px', height: '38px', background: '#FBFAF7', borderRadius: '10px' }} aria-label={tr('Koʻpaytirish')} onClick={() => shop.setQty(sku, qty + 1)} disabled={qty >= 9}><Icon name="plus" size={small ? 14 : 15} sw={2} /></button>
    </div>
  )
  const empty = !loading && shop.lines.length === 0
  const applyCode = () => { shop.setPromo(promoInput.trim().toUpperCase()); setCode(null) }
  const rows = q && (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}><span className="muted">{tr('Mahsulotlar')} ({q.count})</span><span>{fmt(q.oldTotal)} {sum(lang)}</span></div>
      {q.saleSaving + q.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}><span className="muted">{tr('Chegirma')}</span><span style={{ color: '#A8475C' }}>−{fmt(q.saleSaving + q.discount)} {sum(lang)}</span></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}><span className="muted">{tr('Yetkazish')}</span><span>{q.deliveryFee ? `${fmt(q.deliveryFee)} ${sum(lang)}` : tr('Bepul')}</span></div>
    </>
  )
  const promoForm = (
    <form style={{ display: 'flex', gap: '8px' }} onSubmit={(e) => { e.preventDefault(); applyCode() }}>
      <label htmlFor="promo" className="sr">{tr('Promokod')}</label>
      <input id="promo" className="inp" value={promoInput} onChange={(e) => setCode(e.target.value)} placeholder={tr('Promokod, masalan SALOM10')} style={{ height: '46px', textTransform: 'uppercase' }} autoComplete="off" />
      <button className="pill line" style={{ minHeight: '46px' }}>{tr('Qoʻllash')}</button>
    </form>
  )

  if (empty) return (
    <div className="wrap" style={{ marginTop: '20px' }}>
      <div className="card" style={{ padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        <b className="h" style={{ fontSize: '28px' }}>{tr('Savat hozircha boʻsh')}</b>
        <span className="muted" style={{ fontSize: '15px' }}>{tr('Nimadan boshlashni bilmasangiz — maslahatchidan soʻrang')}</span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href={L('/maslahatchi')} className="pill dark"><Icon name="spark" size={16} /> {tr('Tanlab ber')}</Link>
          <Link href={L('/katalog/serum')} className="pill line">{tr('Katalog')}</Link>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* phone (MobileCart.jpg) */}
      <div className="m-only" style={{ flexDirection: 'column' }}>
        <div className="m-top"><b className="h" style={{ fontSize: '28px' }}>{tr('Savat')}</b> <span className="muted" style={{ fontSize: '14px' }}>{tn(lang, '[N] ta mahsulot', q?.count ?? shop.count)}</span></div>
        <div style={{ padding: '0 16px 110px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {ship && (
            <div style={{ padding: '14px 16px', borderRadius: '20px', background: '#FBFAF7', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px' }}>{q!.freeLeft ? tn(lang, 'Bepul yetkazishgacha yana [N] soʻm', fmt(q!.freeLeft)) : tr('Yetkazish bepul ✓')}</span>
              <span style={{ height: '6px', borderRadius: '3px', background: '#EFE9E3', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${ship.pct}%`, background: '#2F5228', borderRadius: '3px' }} /></span>
            </div>
          )}
          {lines.map((l) => (
            <div key={l.sku} style={{ padding: '12px', borderRadius: '20px', background: '#FBFAF7', display: 'flex', gap: '12px' }}>
              <img loading="lazy" decoding="async" src={l.img} alt="" style={{ width: '84px', height: '84px', borderRadius: '14px', objectFit: 'cover' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                <span style={{ fontSize: '13px', lineHeight: 1.3 }}><b style={{ fontWeight: 600 }}>{l.brand}</b> {l.name}</span>
                <span style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}><b className="num" style={{ fontSize: '16px', fontWeight: 500 }}>{fmt(l.line)} {sum(lang)}</b>{l.old && <span className="old" style={{ fontSize: '12px' }}>{fmt(l.lineOld)}</span>}</span>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{qtyBox(l.sku, l.qty, true)}<button className="ib" aria-label={tr('Oʻchirish')} onClick={() => shop.setQty(l.sku, 0)}><Icon name="x" size={18} /></button></span>
              </div>
            </div>
          ))}
          {suggest && (
            <div style={{ padding: '14px', borderRadius: '20px', background: '#F2D6D0', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <img loading="lazy" decoding="async" src={suggest.img} alt="" style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover' }} />
              <span style={{ flex: 1, fontSize: '13px', lineHeight: 1.4 }}>{suggest.reason === 'spf' ? tr('Serum bor, SPF yoʻq. Usiz dogʻlar qaytadi —') : `${suggest.brand} ${suggest.name} —`} <b>{fmt(suggest.price)} {sum(lang)}</b></span>
              <button className="pill dark" style={{ minHeight: '38px', fontSize: '13px' }} onClick={() => shop.add(toCard(suggest))}>{tr('Qoʻshish')}</button>
            </div>
          )}
          {q && (
            <div style={{ padding: '16px', borderRadius: '20px', background: '#FBFAF7', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              {promoForm}
              {promo && <span style={{ fontSize: '13px', color: promo.ok ? '#2F5228' : '#A8475C' }}>{promo.text}</span>}
              {rows}
            </div>
          )}
        </div>
        {q && (
          <div className="m-bar above-tabs">
            <span style={{ flex: 1 }}><span className="muted" style={{ fontSize: '12px' }}>{tr('Jami')}</span><br /><b className="num" style={{ fontSize: '20px', fontWeight: 500 }}>{fmt(q.total)} {sum(lang)}</b></span>
            <Link href={L('/rasmiylashtirish')} className="pill dark" style={{ minHeight: '52px' }}>{tr('Rasmiylashtirish')}</Link>
          </div>
        )}
      </div>

      {/* desktop / tablet (Cart.jpg) */}
      <div className="wrap d-only" style={{ marginTop: '20px' }}>
        <h1 className="h h1" style={{ fontSize: '44px' }}>{tr('Savatingiz')} <span className="muted" style={{ font: '500 18px Inter, sans-serif', letterSpacing: 0 }}>{tn(lang, '[N] ta mahsulot', q?.count ?? shop.count)}</span></h1>
        {q && q.missing.length > 0 && <p style={{ color: '#A8475C', margin: '10px 0 0' }}>{tr('Baʼzi mahsulotlar tugadi va savatdan olib tashlandi.')}</p>}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '18px', alignItems: 'flex-start', opacity: loading ? 0.6 : 1 }}>
          <section style={{ flex: '999 1 640px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }} aria-label={tr('Mahsulotlar')}>
            {ship && (
              <div className="card" style={{ padding: '16px 20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '10px', background: ship.bg }}>
                <span style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '15px' }}><Icon name="truck" /><span>{ship.say}</span></span>
                <span style={{ height: '8px', borderRadius: '999px', background: 'rgba(42,33,30,.1)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${ship.pct}%`, background: '#2A211E', borderRadius: '999px', transition: 'width .4s' }} /></span>
              </div>
            )}
            {lines.map((l) => (
              <article key={l.sku} className="card" style={{ padding: '12px 16px 12px 12px', borderRadius: '20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Link href={L(`/mahsulot/${l.slug}`)} style={{ width: '112px', height: '112px', borderRadius: '14px', overflow: 'hidden', flex: 'none' }}><img loading="lazy" decoding="async" className="ph" src={l.img} alt={l.name} /></Link>
                <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <Link href={L(`/mahsulot/${l.slug}`)} style={{ textDecoration: 'none', fontSize: '15px', lineHeight: 1.35 }}><b style={{ fontWeight: 600 }}>{l.brand}</b> {l.name}</Link>
                  <span className="muted" style={{ fontSize: '13px' }}>{[l.volume, l.capped ? tn(lang, 'Omborda faqat [N] ta', l.stock) : tr('Omborda bor')].filter(Boolean).join(' · ')}</span>
                  <span style={{ display: 'flex', gap: '14px', fontSize: '13px' }}>
                    <button style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#6B5F59', textDecoration: 'underline', font: 'inherit' }} onClick={() => { if (!shop.isFav(l.slug)) shop.toggleFav(l.slug); shop.setQty(l.sku, 0) }}>{tr('Sevimlilarga')}</button>
                    <button style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#6B5F59', textDecoration: 'underline', font: 'inherit' }} onClick={() => shop.setQty(l.sku, 0)}>{tr('Oʻchirish')}</button>
                  </span>
                </div>
                {qtyBox(l.sku, l.qty)}
                <div style={{ minWidth: '150px', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span className="num" style={{ fontSize: '20px' }}>{fmt(l.line)} {sum(lang)}</span>
                  {l.old && <span className="old">{fmt(l.lineOld)} {sum(lang)}</span>}
                </div>
              </article>
            ))}
            {suggest && (
              <div className="card" style={{ padding: '20px', borderRadius: '20px', marginTop: '6px' }}>
                <b style={{ font: "600 18px 'Inter Tight', sans-serif" }}>{tr('Rutinangizni toʻldiradi')}</b>
                <span className="muted" style={{ fontSize: '14px', display: 'block', marginTop: '4px' }}>{reason}</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', marginTop: '14px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '8px', borderRadius: '14px', background: '#F6F3EF' }}>
                    <img loading="lazy" decoding="async" src={suggest.img} alt="" style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover' }} />
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}><span><b style={{ fontWeight: 600 }}>{suggest.brand}</b> {suggest.name}</span><span className="num" style={{ fontSize: '15px' }}>{fmt(suggest.price)} {sum(lang)}</span></span>
                    <button className="ib" style={{ background: '#2A211E', color: '#FBFAF7' }} aria-label={tr('Savatga qoʻshish')} onClick={() => shop.add(toCard(suggest))}><Icon name="plus" size={16} sw={2} /></button>
                  </div>
                </div>
              </div>
            )}
          </section>
          {q && (
            <aside className="card" style={{ flex: '1 1 360px', padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '14px', position: 'sticky', top: '140px' }} aria-label={tr('Buyurtma xulosasi')}>
              <b className="h" style={{ fontSize: '26px' }}>{tr('Jami')}</b>
              {rows}
              {promoForm}
              {promo && <span style={{ fontSize: '13px', color: promo.ok ? '#2F5228' : '#A8475C' }} role="status">{promo.text}</span>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '14px', borderTop: '1px solid #EFE9E3' }}><b style={{ fontWeight: 600 }}>{tr('Toʻlashga')}</b><span className="num" style={{ fontSize: '32px' }}>{fmt(q.total)} {sum(lang)}</span></div>
              <Link href={L('/rasmiylashtirish')} className="pill dark" style={{ minHeight: '56px', fontSize: '16px' }}>{tr('Rasmiylashtirishga oʻtish')} <Icon name="right" size={16} /></Link>
              <span className="muted" style={{ fontSize: '13px', lineHeight: 1.5, textAlign: 'center' }}>{tr('Keyingi qadamda manzil va toʻlov usulini tanlaysiz. Hech narsa hali yechilmaydi.')}</span>
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>{['Click', 'Payme', 'Uzcard', 'Humo'].map((x) => <span key={x} className="chip">{x}</span>)}</div>
            </aside>
          )}
        </div>
      </div>
    </>
  )
}
