'use client'
// Product page interactive parts (design/preview/Product.html, p_product.py; phone: p_mobile.py "prod").
import { RichText } from '@payloadcms/richtext-lexical/react'
import Link from 'next/link'
import { useState } from 'react'

import { Icon } from '@/components/icons'
import { ProductCard } from '@/components/ProductCard'
import { RememberView } from '@/components/Recent'
import { useShop, type CardProduct } from '@/components/shop'
import { fmt, sum } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'

export type Variant = { sku: string; volume: string; price: number; old?: number; stock: number; perMl: number | null }
export type Shot = { url: string; alt: string; caption?: string }
export type Fit = { skin: string; ok: boolean; note: string }
type Rich = Parameters<typeof RichText>[0]['data'] | null | undefined

export type ProductProps = {
  lang: Lang
  self: CardProduct
  brand: { name: string; slug: string }
  name: string
  summary?: string
  variants: Variant[]
  images: Shot[]
  tags: CardProduct['tags']
  fit: Fit[]
  skin: string[]
  stats?: { count: number; avg: number }
  faqCount: number
  store: { tashkentPrice: number; regionPrice: number; regionDays: string; orderCutoff: string; returnDays: number; freeDeliveryFrom: number; telegramBotUrl: string }
  batch?: string
  expiresAt?: string
  certificateUrl?: string
  info: { description: Rich; ingredients: Rich; howTo: Rich }
  pairs: CardProduct[]
  backHref: string
}

const SKINS: [string, string][] = [['dry', 'Quruq'], ['oily', 'Yogʻli'], ['combo', 'Aralash'], ['sens', 'Sezgir'], ['normal', 'Normal']]

function useBuy(p: ProductProps) {
  const shop = useShop()
  const [vi, setVi] = useState(0)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const v = p.variants[vi]
  const card: CardProduct = { ...p.self, sku: v.sku, price: v.price, old: v.old, vol: v.volume || undefined }
  return {
    v, vi, setVi, qty, setQty, added, card,
    add: () => { shop.add(card, qty); setAdded(true) },
    fav: shop.isFav(p.self.slug), toggleFav: () => shop.toggleFav(p.self.slug),
  }
}

/** Verdict for "Teringizga mosmi?": the admin's note per skin, else a plain rule from the product's skin types. */
function verdict(lang: Lang, p: ProductProps, skin: string): { ok: boolean; text: string } {
  const own = p.fit.find((f) => f.skin === skin)
  if (own) return { ok: own.ok, text: own.note }
  return p.skin.includes(skin) || skin === 'normal'
    ? { ok: true, text: t(lang, 'Mos: ushbu teri turi uchun tavsiya etiladi.') }
    : { ok: false, text: t(lang, 'Asosiy tanlov emas — maslahatchidan soʻrang, mosrogʻini topamiz.') }
}

/** Telegram bot deep link: https://t.me/bot?start=<payload> (payload: letters, digits, _ and -). */
const botLink = (bot: string, payload: string) => `${bot}${bot.includes('?') ? '&' : '?'}start=${payload.replace(/[^\w-]/g, '_')}`

const perMl = (lang: Lang, v: Variant) => (v.perMl ? `${fmt(v.perMl)} ${sum(lang)}/ml` : '')

export function ProductMain(p: ProductProps) {
  const { lang } = p
  const tr = (s: string) => t(lang, s)
  const b = useBuy(p)
  const [shot, setShot] = useState(0)
  const [skin, setSkin] = useState('sens')
  const cur = p.images[shot] ?? p.images[0]
  const fit = verdict(lang, p, skin)
  const free = b.v.price * b.qty >= p.store.freeDeliveryFrom
  const row = { display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 0', fontSize: '14px', borderBottom: '1px solid #EFE9E3' }
  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '14px', alignItems: 'flex-start' }}>
      <RememberView slug={p.self.slug} brand={p.self.brand} name={p.self.name} img={p.self.img} price={p.self.price} />
      <section aria-label={tr('Rasmlar')} style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', gap: '10px' }}>
        {p.images.length > 1 && (
          <div className="hide-m" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {p.images.map((im, i) => (
              <button key={im.url} aria-label={`${tr('Rasm')} ${i + 1}`} aria-pressed={shot === i} onClick={() => setShot(i)}
                style={{ width: '76px', height: '76px', padding: 0, borderRadius: '14px', overflow: 'hidden', border: `2px solid ${shot === i ? '#2A211E' : 'transparent'}`, cursor: 'pointer', background: '#F2D6D0' }}>
                <img className="ph" src={im.url} alt="" />
              </button>
            ))}
          </div>
        )}
        <div className="card" style={{ flex: 1, aspectRatio: '1/1', maxHeight: '680px', background: '#F2D6D0', borderRadius: '24px' }}>
          {cur && <img className="ph" src={cur.url} alt={cur.alt} style={{ position: 'absolute', inset: 0 }} />}
          {p.tags.length > 0 && (
            <span style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '6px' }}>
              {p.tags.map((tg) => <span key={tg.t} className={`chip ${tg.cls}`} style={{ height: '30px' }}>{tr(tg.t)}</span>)}
            </span>
          )}
          {cur?.caption && <span className="chip glass" style={{ position: 'absolute', bottom: '16px', left: '16px', height: '34px', fontSize: '13px' }}>{cur.caption}</span>}
        </div>
      </section>

      <section aria-label={tr('Xarid')} style={{ flex: '1 1 440px', display: 'flex', flexDirection: 'column', gap: '14px', position: 'sticky', top: '140px' }}>
        <Link href={href(lang, `/brend/${p.brand.slug}`)} style={{ font: '600 13px Inter, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', color: '#6B5F59', textDecoration: 'none' }}>{p.brand.name} ›</Link>
        <h1 className="h h1" style={{ fontSize: '36px', lineHeight: 1.08 }}>{p.name}</h1>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', fontSize: '14px' }}>
          {p.stats ? <><span><span className="stars" style={{ fontSize: '15px' }}>★★★★★</span> <b style={{ fontWeight: 600 }}>{p.stats.avg.toFixed(1).replace('.', ',')}</b></span>
            <a href="#reviews" style={{ color: '#2A211E' }}>{tn(lang, '[N] sharh', p.stats.count)}</a></>
            : <a href="#reviews" style={{ color: '#2A211E' }}>{tr('Hali sharh yoʻq')}</a>}
          {p.faqCount > 0 && <a href="#qa" style={{ color: '#2A211E' }}>{tn(lang, '[N] savol-javob', p.faqCount)}</a>}
        </div>
        {p.summary && <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.55, color: '#4A3F3A' }}>{p.summary}</p>}

        {p.variants.length > 1 && (
          <div role="radiogroup" aria-label={tr('Hajm')} style={{ display: 'flex', gap: '8px' }}>
            {p.variants.map((v, i) => (
              <button key={v.sku} role="radio" aria-checked={b.vi === i} onClick={() => b.setVi(i)}
                style={{ flex: 1, minHeight: '64px', borderRadius: '16px', border: `1.5px solid ${b.vi === i ? '#2A211E' : '#E2DAD2'}`, background: b.vi === i ? '#FBFAF7' : 'transparent', cursor: 'pointer', textAlign: 'left', padding: '10px 14px', font: 'inherit', color: '#2A211E', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <b style={{ fontWeight: 600, fontSize: '15px' }}>{v.volume}</b>
                <span className="muted" style={{ fontSize: '13px' }}>{fmt(v.price)} {sum(lang)}{v.perMl ? ` · ${perMl(lang, v)}` : ''}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <span className="num" style={{ fontSize: '40px' }}>{fmt(b.v.price)} {sum(lang)}</span>
          {b.v.old && <><span className="old" style={{ fontSize: '18px' }}>{fmt(b.v.old)}</span><span className="chip tag-sale">−{fmt(b.v.old - b.v.price)} {sum(lang)}</span></>}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Qty lang={lang} qty={b.qty} setQty={b.setQty} />
          {b.v.stock > 0
            ? <button className="addbtn" style={{ flex: 1, minHeight: '52px', borderRadius: '14px', fontSize: '16px' }} onClick={b.add}>
                <Icon name="bag" size={18} /> {b.added ? tr('Savatda ✓ · yana qoʻshish') : tr('Savatga qoʻshish')}
              </button>
            : <a className="addbtn" style={{ flex: 1, minHeight: '52px', borderRadius: '14px', fontSize: '16px', textDecoration: 'none' }} href={botLink(p.store.telegramBotUrl, `notify_${b.v.sku}`)}>
                <Icon name="tg" size={18} /> {tr('Kelganda xabar berish')}
              </a>}
          <button className="ib" style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#F0EBE5', color: b.fav ? '#A8475C' : '#2A211E' }} aria-label={tr('Sevimlilarga')} aria-pressed={b.fav} onClick={b.toggleFav}><Icon name="heart" /></button>
        </div>
        <a href={botLink(p.store.telegramBotUrl, `buy_${b.v.sku}`)} className="pill line" style={{ minHeight: '46px' }}><Icon name="tg" size={17} /> {tr('Telegramda bir bosishda buyurtma')}</a>

        <div className="card" style={{ borderRadius: '18px', padding: '4px 16px' }}>
          <div style={row}><Icon name="truck" /><span style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{tr('Toshkent: ertaga')}</b>{tr(', agar bugun 18:00 gacha buyurtma bersangiz').replace('18:00', p.store.orderCutoff)}</span><span className="muted">{free ? tr('bepul') : `${fmt(p.store.tashkentPrice)} ${sum(lang)}`}</span></div>
          <div style={row}><Icon name="truck" /><span style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{tr('Viloyatlarga')}</b> {tn(lang, '— [N] kun', p.store.regionDays)}</span><span className="muted">{free ? tr('bepul') : `${fmt(p.store.regionPrice)} ${sum(lang)}`}</span></div>
          <div style={row}><Icon name="shield" /><span style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{tr('Original.')}</b> {p.batch && p.expiresAt
            ? tr('Partiya [raqam], yaroqli [sana]gacha').replace('[raqam]', p.batch).replace('[sana]', new Date(p.expiresAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ'))
            : tr('Rasmiy distribyutordan, har partiyaning hujjati bor')}</span>{p.certificateUrl && <a href={p.certificateUrl} style={{ fontSize: '13px' }}>{tr('Sertifikat')}</a>}</div>
          <div style={{ ...row, borderBottom: 'none' }}><Icon name="ret" /><span style={{ flex: 1 }}>{tn(lang, 'Ochilmagan boʻlsa — [N] kun ichida qaytarasiz', p.store.returnDays)}</span></div>
        </div>

        <div style={{ borderRadius: '18px', background: '#F2D6D0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <b style={{ font: "600 16px 'Inter Tight', sans-serif" }}>{tr('Teringizga mosmi? Tanlang:')}</b>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {SKINS.map(([id, label]) => <button key={id} className={skin === id ? 'pill dark' : 'pill ghost'} aria-pressed={skin === id} style={{ minHeight: '38px', fontSize: '13px', padding: '0 14px' }} onClick={() => setSkin(id)}>{tr(label)}</button>)}
          </div>
          <span aria-live="polite" style={{ fontSize: '14px', lineHeight: 1.5, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ color: fit.ok ? '#3F6B3A' : '#8A4B12', fontWeight: 700 }}>{fit.ok ? '✓' : '!'}</span>{fit.text}
          </span>
        </div>
      </section>
    </div>
  )
}

function Qty({ lang, qty, setQty, round = false }: { lang: Lang; qty: number; setQty: (n: number) => void; round?: boolean }) {
  const btn = round ? {} : { width: '42px', height: '42px', background: '#FBFAF7', borderRadius: '10px' }
  return (
    <div style={round ? { display: 'flex', alignItems: 'center', borderRadius: '999px', background: '#F0EEE9' } : { display: 'flex', alignItems: 'center', gap: '2px', padding: '4px', borderRadius: '14px', background: '#F0EBE5' }}>
      <button className="ib" style={btn} aria-label={t(lang, 'Kamaytirish')} onClick={() => setQty(Math.max(1, qty - 1))}><Icon name="minus" size={16} sw={round ? 1.8 : 2} /></button>
      <span className="num" style={round ? { width: '22px', textAlign: 'center' } : { minWidth: '34px', textAlign: 'center', fontSize: '18px' }} aria-live="polite">{qty}</span>
      <button className="ib" style={btn} aria-label={t(lang, 'Koʻpaytirish')} onClick={() => setQty(Math.min(9, qty + 1))}><Icon name="plus" size={16} sw={round ? 1.8 : 2} /></button>
    </div>
  )
}

/** Tabs (Tavsif / Tarkib / Qoʻllash / Sertifikat) + "Maslahatchi aytadi". Empty tabs are not shown. */
export function ProductInfo({ lang, info, summary, expertNote, certificateUrl, batch }: { lang: Lang; info: ProductProps['info']; summary?: string; expertNote?: string; certificateUrl?: string; batch?: string }) {
  const tr = (s: string) => t(lang, s)
  const tabs = ([
    ['Tavsif', info.description ? <RichText data={info.description} /> : summary ? <p style={{ margin: 0 }}>{summary}</p> : null],
    ['Tarkib', info.ingredients ? <RichText data={info.ingredients} /> : null],
    ['Qoʻllash', info.howTo ? <RichText data={info.howTo} /> : null],
    ['Sertifikat', certificateUrl ? <p style={{ margin: 0 }}>{batch ? `${tr('Partiya')}: ${batch}. ` : ''}<a id="cert" href={certificateUrl}>{tr('Sertifikatni ochish')}</a></p> : null],
  ] as const).filter(([, c]) => c)
  const [tab, setTab] = useState(0)
  if (!tabs.length && !expertNote) return null
  return (
    <section style={{ marginTop: '32px', display: 'flex', gap: '16px', flexWrap: 'wrap' }} aria-label={tr('Maʼlumot')}>
      {tabs.length > 0 && (
        <div className="card pad-m" style={{ flex: '999 1 640px', minWidth: 0, padding: '32px' }}>
          <div role="tablist" aria-label={tr('Maʼlumot')} style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: '1px solid #EFE9E3', paddingBottom: '12px' }}>
            {tabs.map(([label], i) => <button key={label} role="tab" aria-selected={tab === i} className={tab === i ? 'pill dark' : 'pill ghost'} style={{ minHeight: '42px' }} onClick={() => setTab(i)}>{tr(label)}</button>)}
          </div>
          <div role="tabpanel" className="rich" style={{ paddingTop: '22px', fontSize: '16px', lineHeight: 1.7 }}>{tabs[tab]?.[1]}</div>
        </div>
      )}
      {expertNote && (
        <aside className="card pad-m" style={{ flex: '1 1 360px', padding: '28px', background: '#2A211E', color: '#FBFAF7', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <span style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><span style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden' }}><img className="ph" src="/img/face-touch.jpg" alt="" style={{ objectPosition: '50% 25%' }} /></span><b style={{ fontWeight: 600 }}>{tr('Maslahatchi aytadi')}</b></span>
          <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.6, color: '#E9E1DC' }}>«{expertNote}»</p>
          <Link href={href(lang, '/maslahatchi')} className="pill" style={{ borderColor: 'rgba(251,250,247,.3)', color: '#FBFAF7', alignSelf: 'flex-start', marginTop: 'auto' }}>{tr('Savolim bor')}</Link>
        </aside>
      )}
    </section>
  )
}

/** "Koʻpincha birga olinadi": this product + pairs, tick to include. */
export function Together({ lang, items }: { lang: Lang; items: CardProduct[] }) {
  const tr = (s: string) => t(lang, s)
  const shop = useShop()
  const [off, setOff] = useState<string[]>([])
  const [added, setAdded] = useState(false)
  if (items.length < 2) return null
  const on = items.filter((p) => !off.includes(p.sku))
  const total = on.reduce((a, p) => a + p.price, 0)
  return (
    <section className="card pad-m" style={{ marginTop: '16px', padding: '28px' }} aria-labelledby="fbt-h">
      <h2 id="fbt-h" className="h" style={{ fontSize: '28px' }}>{tr('Koʻpincha birga olinadi')}</h2>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginTop: '18px' }}>
        {items.map((p) => (
          <label key={p.sku} style={{ flex: '1 1 200px', display: 'flex', gap: '12px', alignItems: 'center', padding: '10px', borderRadius: '16px', background: '#F6F3EF', cursor: 'pointer' }}>
            <input type="checkbox" checked={!off.includes(p.sku)} onChange={() => setOff(off.includes(p.sku) ? off.filter((x) => x !== p.sku) : [...off, p.sku])} style={{ width: '20px', height: '20px', accentColor: '#2A211E', margin: 0 }} aria-label={p.name} />
            <img src={p.img} alt="" style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover' }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}><span><b style={{ fontWeight: 600 }}>{p.brand}</b> {p.name}</span><span className="num" style={{ fontSize: '15px' }}>{fmt(p.price)} {sum(lang)}</span></span>
          </label>
        ))}
        <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
          <span className="muted" style={{ fontSize: '14px' }}>{tn(lang, '[N] ta mahsulot', on.length)}</span>
          <span className="num" style={{ fontSize: '28px' }}>{fmt(total)} {sum(lang)}</span>
          <button className="pill dark" style={{ minHeight: '48px' }} disabled={!on.length} onClick={() => { on.forEach((p) => shop.add(p)); setAdded(true) }}>{added ? tr('Savatga qoʻshildi ✓') : tr('Tanlanganlarni savatga')}</button>
        </div>
      </div>
    </section>
  )
}

export type ReviewItem = { id: number | string; name: string; skin?: string | null; rating: number; text: string; helpful?: number | null }

/** Reviews: verified purchases only. Without any — an honest empty state, no placeholders. */
export function Reviews({ lang, stats, items }: { lang: Lang; stats?: { count: number; avg: number; dist: number[] }; items: ReviewItem[] }) {
  const tr = (s: string) => t(lang, s)
  const [skin, setSkin] = useState<string | null>(null)
  const skinLabel = (s?: string | null) => SKINS.find((x) => x[0] === s)?.[1]
  const list = items.filter((r) => !skin || r.skin === skin)
  return (
    <section id="reviews" style={{ marginTop: '32px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }} aria-labelledby="rev-h">
      <div className="card" style={{ flex: '1 1 300px', maxWidth: '360px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 id="rev-h" className="h" style={{ fontSize: '28px' }}>{tr('Sharhlar')}</h2>
        {stats ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}><span className="num" style={{ fontSize: '52px' }}>{stats.avg.toFixed(1).replace('.', ',')}</span><span className="stars" style={{ fontSize: '18px' }}>★★★★★</span></div>
            <span className="muted" style={{ fontSize: '14px' }}>{tn(lang, '[N] ta tasdiqlangan xarid asosida', stats.count)}</span>
            {stats.dist.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ width: '24px' }}>{5 - i}★</span>
                <span style={{ flex: 1, height: '8px', borderRadius: '999px', background: '#F0EBE5', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.round((n / stats.count) * 100)}%`, background: '#C98A3A' }} /></span>
                <span className="muted" style={{ width: '34px', textAlign: 'right' }}>{n}</span>
              </div>
            ))}
          </>
        ) : (
          <span className="muted" style={{ fontSize: '15px', lineHeight: 1.55 }}>{tr('Hali sharh yoʻq. Sharhni faqat shu mahsulotni sotib olganlar yoza oladi — soxta sharh yoʻq.')}</span>
        )}
        <Link href={href(lang, '/kabinet')} className="pill dark" style={{ marginTop: '8px' }}>{tr('Sharh yozish')}</Link>
      </div>
      {items.length > 0 && (
        <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: '14px', alignSelf: 'center' }}>{tr('Teri turi boʻyicha:')}</span>
            {([[null, 'Hammasi'], ['sens', 'Sezgir'], ['oily', 'Yogʻli'], ['dry', 'Quruq']] as const).map(([id, label]) => (
              <button key={label} className={skin === id ? 'pill dark' : 'pill ghost'} style={{ minHeight: '38px', fontSize: '13px', padding: '0 14px' }} onClick={() => setSkin(id)}>{tr(label)}</button>
            ))}
          </div>
          {list.map((r) => (
            <article key={r.id} className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '10px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ fontWeight: 600 }}>{r.name}</b>
                  {skinLabel(r.skin) && <span className="chip">{tr(`${skinLabel(r.skin)} teri`)}</span>}
                  <span className="chip tag-new">{tr('Tasdiqlangan xarid')}</span>
                </span>
                <span className="stars" aria-label={`${r.rating}/5`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
              </div>
              <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.55 }}>{r.text}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

/** Phone layout (MobileProduct.jpg): full-bleed photo, chips, volumes, fit card, delivery strip, accordions, sticky bar. */
export function ProductPhone(p: ProductProps & { faq: { q: string; a: string }[] }) {
  const { lang } = p
  const tr = (s: string) => t(lang, s)
  const b = useBuy(p)
  const [shot, setShot] = useState(0)
  const [skin, setSkin] = useState(0)
  const [acc, setAcc] = useState(-1)
  const fits: [string, string][] = [['sens', 'Sezgir'], ['oily', 'Yogʻli'], ['dry', 'Quruq'], ['combo', 'Aralash']]
  const fit = verdict(lang, p, fits[skin][0])
  const accs = ([
    ['Tarkibi', p.info.ingredients ? <RichText data={p.info.ingredients} /> : null],
    ['Qanday surtiladi', p.info.howTo ? <RichText data={p.info.howTo} /> : null],
    ['Original ekanini tekshirish', <p key="o" style={{ margin: 0 }}>{tr('Qutidagi partiya raqamini sertifikat bilan solishtiring — sertifikat ilova qilinadi.')}</p>],
  ] as const).filter(([, c]) => c)
  const glass = { background: 'rgba(251,250,247,.82)', WebkitBackdropFilter: 'blur(14px)', backdropFilter: 'blur(14px)' }
  return (
    <div className="m-only" style={{ flexDirection: 'column' }}>
      <span className="no-phone-hdr" hidden />
      <div style={{ position: 'relative', height: '430px', background: '#F2D6D0' }}>
        {p.images[shot] && <img className="ph" src={p.images[shot].url} alt={p.images[shot].alt} style={{ position: 'absolute', inset: 0 }} />}
        <div style={{ position: 'absolute', top: '12px', left: '16px', right: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <Link href={href(lang, p.backHref)} className="ib" style={glass} aria-label={tr('Orqaga')}><Icon name="left" size={22} /></Link>
          <span style={{ display: 'flex', gap: '6px' }}>
            <button className="ib" style={{ ...glass, color: b.fav ? '#A8475C' : '#2A211E' }} aria-label={tr('Sevimlilarga')} aria-pressed={b.fav} onClick={b.toggleFav}><Icon name="heart" /></button>
            <button className="ib" style={glass} aria-label={tr('Ulashish')} onClick={() => navigator.share?.({ title: `${p.brand.name} ${p.name}`, url: location.href }).catch(() => {})}><Icon name="arrow" /></button>
          </span>
        </div>
        {p.images.length > 1 && (
          <div style={{ position: 'absolute', bottom: '14px', left: 0, right: 0, display: 'flex', gap: '6px', justifyContent: 'center' }}>
            {p.images.map((im, i) => <button key={im.url} aria-label={`${tr('Rasm')} ${i + 1}`} onClick={() => setShot(i)} style={{ width: shot === i ? '22px' : '6px', height: '6px', borderRadius: '3px', border: 'none', padding: 0, background: shot === i ? '#FBFAF7' : 'rgba(251,250,247,.55)' }} />)}
          </div>
        )}
      </div>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {p.tags.map((tg) => <span key={tg.t} className={`chip ${tg.cls}`}>{tr(tg.t)}</span>)}
          <span className="chip"><Icon name="shield" size={13} /> {tr('Original')}</span>
        </div>
        <div>
          <span className="muted" style={{ fontSize: '13px' }}>{p.brand.name}</span>
          <h1 className="h" style={{ fontSize: '26px', lineHeight: 1.1, marginTop: '2px' }}>{p.name}</h1>
          <span style={{ fontSize: '13px' }} className="muted">
            {p.stats ? <><span className="stars">★</span> {p.stats.avg.toFixed(1).replace('.', ',')} · {tn(lang, '[N] sharh', p.stats.count)}</> : tr('Hali sharh yoʻq')}
            {p.faqCount > 0 && ` · ${tn(lang, '[N] savol', p.faqCount)}`}
          </span>
        </div>
        {p.summary && <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.55 }}>{p.summary}</p>}
        {p.variants.length > 1 && (
          <div role="radiogroup" aria-label={tr('Hajm')} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {p.variants.map((v, i) => (
              <button key={v.sku} role="radio" aria-checked={b.vi === i} onClick={() => b.setVi(i)} style={{ padding: '12px', borderRadius: '16px', border: `1.5px solid ${b.vi === i ? '#2A211E' : '#E2DAD2'}`, background: '#FBFAF7', textAlign: 'left', font: 'inherit', color: '#2A211E', cursor: 'pointer' }}>
                <b style={{ fontWeight: 600 }}>{v.volume}</b><br /><span className="num" style={{ fontSize: '15px' }}>{fmt(v.price)} {sum(lang)}</span><br /><span className="muted" style={{ fontSize: '11px' }}>{perMl(lang, v)}{v.perMl && v.perMl === Math.min(...p.variants.map((x) => x.perMl ?? Infinity)) ? ` · ${tr('tejamkor')}` : ''}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ padding: '16px', borderRadius: '20px', background: '#FBFAF7', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <b style={{ fontWeight: 600 }}>{tr('Teringizga mosmi?')}</b>
          <div className="hs" style={{ gap: '6px' }}>
            {fits.map(([, label], i) => <button key={label} className={skin === i ? 'pill dark' : 'pill line'} style={{ minHeight: '36px', fontSize: '13px', flex: 'none' }} onClick={() => setSkin(i)}>{tr(label)}</button>)}
          </div>
          <span aria-live="polite" style={{ fontSize: '14px', lineHeight: 1.5, padding: '10px 12px', borderRadius: '12px', background: fit.ok ? '#E8F0E4' : '#F5DCC9' }}>{fit.text}</span>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: '20px', background: '#E8F0E4', fontSize: '13px', lineHeight: 1.5, display: 'flex', gap: '10px', color: '#2F3A2B' }}>
          <Icon name="truck" />
          <span><b style={{ fontWeight: 600 }}>{tr('Ertaga yetkazamiz')}</b>{tr(', agar 18:00 gacha buyurtma bersangiz. 300 000 soʻmdan bepul.').replace('18:00', p.store.orderCutoff).replace('300 000', fmt(p.store.freeDeliveryFrom))}</span>
        </div>
        <div>
          {accs.map(([label, content], i) => (
            <div key={label} style={{ borderTop: '1px solid #E2DAD2' }}>
              <button onClick={() => setAcc(acc === i ? -1 : i)} aria-expanded={acc === i} style={{ width: '100%', border: 'none', background: 'none', padding: '16px 0', display: 'flex', justifyContent: 'space-between', font: 'inherit', fontWeight: 600, fontSize: '15px', color: '#2A211E', cursor: 'pointer' }}>{tr(label)}<span>{acc === i ? '−' : '+'}</span></button>
              {acc === i && <div className="muted rich" style={{ margin: '0 0 16px', fontSize: '14px', lineHeight: 1.55 }}>{content}</div>}
            </div>
          ))}
        </div>
        {p.pairs.length > 0 && (
          <div>
            <b className="h" style={{ fontSize: '20px' }}>{tr('Bunga qoʻshib olishadi')}</b>
            <div className="hs" style={{ gap: '10px', margin: '10px -16px 0', padding: '0 16px' }}>
              {p.pairs.map((x) => <div key={x.sku} style={{ flex: 'none', width: '160px' }}><ProductCard p={x} lang={lang} compact /></div>)}
            </div>
          </div>
        )}
      </div>
      <div className="m-bar">
        <Qty lang={lang} qty={b.qty} setQty={b.setQty} round />
        {b.v.stock <= 0
          ? <a href={botLink(p.store.telegramBotUrl, `notify_${b.v.sku}`)} className="pill dark" style={{ flex: 1, minHeight: '52px' }}>{tr('Kelganda xabar berish')}</a>
          : b.added
          ? <Link href={href(lang, '/savat')} className="pill dark" style={{ flex: 1, minHeight: '52px' }}>{tr('Savatda ✓ · rasmiylashtirish')}</Link>
          : <button className="pill dark" style={{ flex: 1, minHeight: '52px' }} onClick={b.add}>{tr('Savatga')} · {fmt(b.v.price * b.qty)} {sum(lang)}</button>}
      </div>
    </div>
  )
}
