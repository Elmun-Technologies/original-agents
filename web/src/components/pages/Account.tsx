'use client'
// Account — design/preview/Account.html. Data comes from the server (orders by the signed-in phone, bonus points);
// favourites from the browser; profile, addresses and the saved routine are edited through PATCH /api/account.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Icon } from '@/components/icons'

import { CONCERNS, SKIN } from '@/collections/catalog'
import { useShop } from '@/components/shop'
import type { HomeCard } from '@/lib/catalog'
import { fmt, sum } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'

export type AccOrder = { number: string; token: string; date: string; status: string; paid: boolean; total: number; items: { sku: string; slug: string; brand: string; name: string; img: string; price: number; qty: number }[] }
export type AccData = {
  phone: string; name: string; skin: string; concerns: string[]; addresses: { city: string; address: string }[]; routine: Record<string, string> | null
  orders: AccOrder[]; points: { balance: number; tier: string | null; percent: number; expiresAt?: string | null } | null; telegram: string
}
const STATUS: Record<string, [string, string]> = {
  new: ['Toʻlov kutilmoqda', '#F0EBE5'], accepted: ['Qabul qilindi', '#F5DCC9'], assembling: ['Yigʻilmoqda', '#F5DCC9'], shipping: ['Yoʻlda', '#F5DCC9'],
  delivered: ['Yetkazildi', '#E8F0E4'], cancelled: ['Bekor qilindi', '#F0EBE5'],
}
const TABS = ['Buyurtmalar', 'Sevimlilar', 'Teri profilim', 'Saqlangan rutina', 'Manzillar'] as const
const mask = (p: string) => `+${p.slice(0, 3)} ${p.slice(3, 5)} ••• •• ${p.slice(-2)}`

export function AccountPage({ lang, d, products }: { lang: Lang; d: AccData; products: HomeCard[] }) {
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const shop = useShop()
  const router = useRouter()
  const [tab, setTab] = useState<(typeof TABS)[number]>('Buyurtmalar')
  const [name, setName] = useState(d.name)
  const [skin, setSkin] = useState(d.skin)
  const [concerns, setConcerns] = useState(d.concerns)
  const [addrs, setAddrs] = useState(d.addresses)
  const [routine, setRoutine] = useState(d.routine)
  const [saved, setSaved] = useState('')
  // phone (design MobileAccount): a menu list first, a section opens on tap
  const [mOpen, setMOpen] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read the browser copy after hydration
  useEffect(() => { if (!d.routine) try { setRoutine(JSON.parse(localStorage.getItem('yeppo-routine') || '{}').pick ?? null) } catch {} }, [d.routine])
  const save = async (body: object, what: string) => {
    const r = await fetch('/api/account', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    setSaved(r.ok ? what : '')
    router.refresh()
  }
  const reorder = (o: AccOrder) => o.items.filter((i) => !i.sku.startsWith('GC-')).forEach((i) => shop.add({ ...i, tags: [] }, i.qty))
  const live = d.orders.find((o) => o.paid && ['accepted', 'assembling', 'shipping'].includes(o.status))
  const favs = shop.favs.map((s) => products.find((p) => p.slug === s)).filter((p): p is HomeCard => !!p)
  const picks = routine ? Object.entries(routine).map(([k, slug]) => [k, products.find((p) => p.slug === slug)] as const).filter(([, p]) => p) : []
  const count: Record<string, number | string> = { Buyurtmalar: d.orders.length, Sevimlilar: favs.length, Manzillar: addrs.length || '' }
  const tabBtn = (x: (typeof TABS)[number]) => (
    <button key={x} role="tab" aria-selected={tab === x} onClick={() => { setTab(x); setSaved('') }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '46px', padding: '0 14px', borderRadius: '14px', border: 'none', background: tab === x ? '#2A211E' : 'transparent', color: tab === x ? '#FBFAF7' : '#2A211E', cursor: 'pointer', font: 'inherit', fontSize: '15px', textAlign: 'left' }}>{tr(x)}<span style={{ fontSize: '13px', opacity: 0.7 }}>{count[x] ?? ''}</span></button>
  )
  const row = { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', padding: '18px 0', borderTop: '1px solid #EFE9E3', marginTop: '14px' } as const
  const ok = (w: string) => saved === w && <span style={{ color: '#2F5228', fontSize: '14px' }}>{tr('Saqlandi ✓')}</span>
  const label = (list: { value: string; label: { uz: string; ru: string } }[], v: string) => list.find((x) => x.value === v)?.label[lang] ?? v
  const sub: Record<string, string> = {
    'Teri profilim': [skin && label(SKIN, skin), ...concerns.slice(0, 1).map((c) => label(CONCERNS, c))].filter(Boolean).join(', '),
    'Saqlangan rutina': picks.length ? tr('Ertalab · kechqurun') : '',
  }
  const open = (x: (typeof TABS)[number]) => { setTab(x); setSaved(''); setMOpen(true); window.scrollTo(0, 0) }
  const mRow = { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '56px', padding: '0 16px', border: 'none', borderTop: '1px solid #EFE9E3', background: 'none', width: '100%', font: '500 16px Inter, sans-serif', color: '#2A211E', textDecoration: 'none', textAlign: 'left', cursor: 'pointer' } as const
  return (
    <div className="wrap" style={{ marginTop: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* phone top bar: greeting on the menu, back + title inside a section */}
      <div className="m-top m-only" style={{ alignItems: 'center', gap: '12px', margin: '-20px -12px 0', width: 'calc(100% + 24px)' }}>
        {mOpen
          ? <><button className="ib" aria-label={tr('Orqaga')} onClick={() => setMOpen(false)}><Icon name="left" /></button><h1 className="h" style={{ fontSize: '22px', margin: 0 }}>{tr(tab === 'Buyurtmalar' ? 'Buyurtmalarim' : tab)}</h1></>
          : <><span style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F2D6D0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: "500 20px 'Inter Tight'", color: '#A8475C', flex: 'none' }}>{(d.name || 'Y')[0].toUpperCase()}</span>
            <span><b className="h" style={{ fontSize: '20px' }}>{d.name ? tn(lang, 'Salom, [N]', d.name) : tr('Salom!')}</b><br /><span className="muted" style={{ fontSize: '13px' }}>{d.points?.tier ? `${d.points.tier} · ${d.points.percent}% ${tr('ball')}` : mask(d.phone)}</span></span></>}
      </div>
      <aside className="card hide-m" style={{ flex: '1 1 280px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'sticky', top: '20px' }}>
        <span style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}><span style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F2D6D0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: "500 22px 'Inter Tight'" }}>{(d.name || 'Y')[0].toUpperCase()}</span><span><b style={{ fontWeight: 600, fontSize: '17px' }}>{d.name ? tn(lang, 'Salom, [N]', d.name) : tr('Salom!')}</b><br /><span className="muted" style={{ fontSize: '13px' }}>{mask(d.phone)}</span></span></span>
        <nav role="tablist" aria-orientation="vertical" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{TABS.map(tabBtn)}</nav>
        <a href={`${d.telegram}${d.telegram.includes('?') ? '&' : '?'}start=account`} className="pill line" style={{ marginTop: '12px' }} target="_blank" rel="noopener">{tr('Telegram botni ulash')}</a>
        <button className="pill ghost" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.replace(L('/')); router.refresh() }}>{tr('Chiqish')}</button>
      </aside>

      <div style={{ flex: '999 1 760px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <section className={mOpen ? 'hide-m' : ''} data-g="acc-sum" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {d.points && <div className="card" style={{ padding: '22px', background: '#F2D6D0', display: 'flex', flexDirection: 'column', gap: '4px' }}><span className="eyebrow" style={{ color: '#2A211E' }}>{tr('Bonus ballar')}</span><span className="num" style={{ fontSize: '36px' }}>{fmt(d.points.balance)}</span><span style={{ fontSize: '13px' }}>{tr('1 ball = 1 soʻm · keyingi xaridda ishlatasiz')}</span>{d.points.expiresAt && <span className="muted" style={{ fontSize: '13px' }}>{tn(lang, 'Ballar [N] gacha amal qiladi', new Date(d.points.expiresAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { timeZone: 'Asia/Tashkent' }))}</span>}<Link href={L('/bonus')} style={{ fontSize: '13px', fontWeight: 600 }}>{d.points.tier ? `${d.points.tier} · ${d.points.percent}% ›` : tr('Bonus dasturi ›')}</Link></div>}
          {live && <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '4px' }}><span className="eyebrow">{tr('Yoʻldagi buyurtma')}</span><b style={{ fontWeight: 600, fontSize: '18px' }}>№ {live.number} · {tr(STATUS[live.status][0])}</b><Link href={L(`/buyurtma/${live.number}?t=${live.token}`)} style={{ fontSize: '14px', fontWeight: 600 }}>{tr('Kuzatish ›')}</Link></div>}
          {!skin && <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '4px', background: '#E8F0E4' }}><span className="eyebrow" style={{ color: '#2F5228' }}>{tr('Eslatma')}</span><b style={{ fontWeight: 600, fontSize: '16px' }}>{tr('Teri turingizni belgilang — mos mahsulotlarni tezroq topasiz')}</b><button className="pill dark" style={{ alignSelf: 'flex-start', minHeight: '40px', marginTop: '6px' }} onClick={() => setTab('Teri profilim')}>{tr('Belgilash')}</button></div>}
        </section>

        {!mOpen && (
          <nav className="card m-only" aria-label={tr('Kabinet')} style={{ flexDirection: 'column', padding: 0 }}>
            {TABS.map((x, i) => (
              <button key={x} onClick={() => open(x)} style={{ ...mRow, borderTop: i ? mRow.borderTop : 'none' }}>
                <span style={{ flex: 1 }}>{tr(x === 'Buyurtmalar' ? 'Buyurtmalarim' : x)}</span>
                <span className="muted" style={{ fontSize: '14px' }}>{sub[x] ?? count[x] ?? ''}</span><Icon name="right" size={16} />
              </button>
            ))}
            <Link href={L('/yordam/yetkazish')} style={mRow}><span style={{ flex: 1 }}>{tr('Yordam')}</span><Icon name="right" size={16} /></Link>
          </nav>
        )}
        {!mOpen && (
          <div className="m-only" style={{ flexDirection: 'column', gap: '8px' }}>
            <a href={`${d.telegram}${d.telegram.includes('?') ? '&' : '?'}start=account`} className="pill line" target="_blank" rel="noopener"><Icon name="tg" size={16} /> {tr('Telegram botni ulash')}</a>
            <button className="pill ghost" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.replace(L('/')); router.refresh() }}>{tr('Chiqish')}</button>
          </div>
        )}
        <section className={`card pad-m${mOpen ? '' : ' hide-m'}`} style={{ padding: '28px' }} aria-labelledby="t-h">
          <h1 id="t-h" className="h hide-m" style={{ fontSize: '30px' }}>{tr(tab === 'Buyurtmalar' ? 'Buyurtmalarim' : tab)}</h1>

          {tab === 'Buyurtmalar' && (d.orders.length ? d.orders.map((o) => (
            <div key={o.number} style={row}>
              <span style={{ display: 'flex' }}>{o.items.slice(0, 3).map((i) => <img loading="lazy" decoding="async" key={i.sku} src={i.img} alt="" style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover', border: '2px solid #FBFAF7', marginRight: '-12px' }} />)}</span>
              <span style={{ flex: '1 1 240px', marginLeft: '14px', display: 'flex', flexDirection: 'column', gap: '2px' }}><Link href={L(`/buyurtma/${o.number}?t=${o.token}`)} style={{ textDecoration: 'none' }}><b style={{ fontWeight: 600 }}>№ {o.number} · {new Date(o.date).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'long', timeZone: 'Asia/Tashkent' })}</b></Link><span className="muted" style={{ fontSize: '13px' }}>{[...new Set(o.items.map((i) => i.brand))].join(', ')}</span></span>
              <span className="chip" style={{ background: STATUS[o.status]?.[1] }}>{tr(STATUS[o.status]?.[0] ?? o.status)}</span>
              <span className="num" style={{ fontSize: '18px', minWidth: '120px', textAlign: 'right' }}>{fmt(o.total)} {sum(lang)}</span>
              <button className="pill line" style={{ minHeight: '42px' }} onClick={() => reorder(o)}>{tr('Yana buyurtma')}</button>
            </div>
          )) : <p className="muted" style={{ marginTop: '14px' }}>{tr('Hali buyurtma yoʻq.')} <Link href={L('/yuz-parvarishi')}>{tr('Katalogga oʻtish')}</Link></p>)}

          {tab === 'Sevimlilar' && (favs.length ? favs.map((p) => (
            <div key={p.slug} style={row}>
              <img loading="lazy" decoding="async" src={p.img} alt="" style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover' }} />
              <Link href={L(`/mahsulot/${p.slug}`)} style={{ flex: '1 1 240px', textDecoration: 'none' }}><b style={{ fontWeight: 600 }}>{p.brand}</b> {p.name}</Link>
              <span className="num" style={{ fontSize: '18px' }}>{fmt(p.price)} {sum(lang)}</span>
              {p.stock > 0 && <button className="pill line" style={{ minHeight: '42px' }} onClick={() => shop.add(p)}>{tr('Savatga')}</button>}
            </div>
          )) : <p className="muted" style={{ marginTop: '14px' }}>{tr('Hali hech narsa saqlanmagan')}</p>)}

          {tab === 'Teri profilim' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <label className="lbl">{tr('Ismingiz')}<input className="inp" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>
              <span className="lbl">{tr('Teri turi')}</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{SKIN.map((s) => <button key={s.value} className={skin === s.value ? 'pill dark' : 'pill line'} aria-pressed={skin === s.value} onClick={() => setSkin(s.value)}>{s.label[lang]}</button>)}</div>
              <span className="lbl">{tr('Nima bezovta qiladi')}</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{CONCERNS.map((c) => { const on = concerns.includes(c.value); return <button key={c.value} className={on ? 'pill dark' : 'pill line'} aria-pressed={on} onClick={() => setConcerns(on ? concerns.filter((x) => x !== c.value) : [...concerns, c.value])}>{c.label[lang]}</button> })}</div>
              <span style={{ display: 'flex', gap: '12px', alignItems: 'center' }}><button className="pill dark" onClick={() => save({ name, skin, concerns }, 'profile')}>{tr('Saqlash')}</button>{ok('profile')}</span>
            </div>
          )}

          {tab === 'Saqlangan rutina' && (picks.length ? (
            <>
              {picks.map(([k, p]) => <div key={k} style={row}><span className="muted" style={{ minWidth: '90px' }}>{tr(k.startsWith('am') ? 'Ertalab' : 'Kechqurun')}</span><img loading="lazy" decoding="async" src={p!.img} alt="" style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover' }} /><Link href={L(`/mahsulot/${p!.slug}`)} style={{ flex: '1 1 240px', textDecoration: 'none' }}><b style={{ fontWeight: 600 }}>{p!.brand}</b> {p!.name}</Link></div>)}
              <span style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}><Link href={L('/rutina')} className="pill line">{tr('Oʻzgartirish')}</Link>{!d.routine && <button className="pill dark" onClick={() => save({ routine: { pick: routine } }, 'routine')}>{tr('Kabinetga saqlash')}</button>}{ok('routine')}</span>
            </>
          ) : <p className="muted" style={{ marginTop: '14px' }}>{tr('Rutina hali saqlanmagan.')} <Link href={L('/rutina')}>{tr('Rutina konstruktori')}</Link></p>)}

          {tab === 'Manzillar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {addrs.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input className="inp" style={{ flex: '1 1 160px' }} placeholder={tr('Shahar')} value={a.city} onChange={(e) => setAddrs(addrs.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))} />
                  <input className="inp" style={{ flex: '3 1 280px' }} placeholder={tr('Manzil')} value={a.address} onChange={(e) => setAddrs(addrs.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))} />
                  <button className="ib" aria-label={tr('Oʻchirish')} onClick={() => setAddrs(addrs.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>{addrs.length < 5 && <button className="pill line" onClick={() => setAddrs([...addrs, { city: '', address: '' }])}>{tr('+ Manzil qoʻshish')}</button>}<button className="pill dark" onClick={() => save({ addresses: addrs }, 'addr')}>{tr('Saqlash')}</button>{ok('addr')}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
