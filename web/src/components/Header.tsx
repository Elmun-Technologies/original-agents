'use client'
// AnnouncementBar + Header + CategoryNav + MegaMenu (design/source/common.py: header(), MEGA).
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { fmt } from '@/lib/format'
import { href, t, tn, type Lang } from '@/lib/i18n'
import { Icon } from './icons'
import { useShop } from './shop'

export type StoreInfo = { tashkentDays: number; freeDeliveryFrom: number; telegramUrl: string }

const NAV: [string, string, string][] = [
  ['/yuz-parvarishi', 'Yuz parvarishi', 'face'],
  ['/katalog/tozalash', 'Tozalash', 'clean'],
  ['/katalog/spf', 'SPF', 'spf'],
  ['/katalog/niqoblar', 'Niqoblar', 'mask'],
  ['/katalog/makiyaj', 'Makiyaj', 'makeup'],
  ['/katalog/soch-va-tana', 'Soch va tana', 'body'],
  ['/kim-uchun/18-25', 'Kim uchun', 'who'],
  ['/brendlar', 'Brendlar', 'brand'],
]

type MegaItem = [string, string, number | string]
const MEGA: [string, MegaItem[]][] = [
  ['Yuz parvarishi', [
    ['Tozalovchilar', '/katalog/tozalash', ''], ['Tonerlar va padlar', '/katalog/toner', ''], ['Essensiyalar', '/katalog/essensiya', ''],
    ['Serum va ampulalar', '/katalog/serum', ''], ['Kremlar', '/katalog/krem', ''], ['Quyoshdan himoya', '/katalog/spf', ''], ['Niqoblar', '/katalog/niqoblar', ''],
  ]],
  ['Muammo boʻyicha', [
    ['Toshma va qizarish', '/katalog/serum?muammo=acne', ''], ['Kengaygan poralar', '/katalog/serum?muammo=pores', ''], ['Pigment dogʻlar', '/katalog/serum?muammo=pigment', ''],
    ['Quruqlik, tortishish', '/katalog/krem?muammo=dryness', ''], ['Birinchi ajinlar', '/katalog/serum?muammo=wrinkles', ''], ['Xira rang', '/katalog/serum?muammo=dull', ''],
  ]],
  ['Teri turi va kimga', [
    ['Quruq teri', '/katalog/krem?teri=dry', ''], ['Yogʻli teri', '/katalog/serum?teri=oily', ''], ['Sezgir teri', '/katalog/serum?teri=sens', ''],
    ['Erkaklar uchun', '/kim-uchun/erkaklar', ''], ['Boʻlajak onalar', '/kim-uchun/onalar', ''], ['35+ yosh', '/kim-uchun/35', ''],
  ]],
  ['Brendlar', [
    ['SKIN1004', '/brend/skin1004', ''], ['Beauty of Joseon', '/brend/beauty-of-joseon', ''], ['Round Lab', '/brend/round-lab', ''],
    ['Torriden', '/brend/torriden', ''], ['Mediheal', '/brend/mediheal', ''], ['Barcha brendlar →', '/brendlar', ''],
  ]],
]

export function Header({ lang, store, active = '' }: { lang: Lang; store: StoreInfo; active?: string }) {
  const [mega, setMega] = useState(false)
  const shop = useShop()
  const path = usePathname() || `/${lang}`
  const other: Lang = lang === 'uz' ? 'ru' : 'uz'
  const otherPath = path.replace(/^\/(uz|ru)(?=\/|$)/, `/${other}`)
  const L = (p: string) => href(lang, p)
  const tr = (s: string) => t(lang, s)
  // highlighted nav item: exact section first; any other catalog page belongs to "Yuz parvarishi" (design: Catalog.jpg)
  const rest = path.replace(/^\/(uz|ru)/, '')
  const current = active || NAV.find(([p]) => rest === p || rest.startsWith(p + '/'))?.[2]
    || (rest.startsWith('/katalog/') || rest.startsWith('/mahsulot/') ? 'face' : '')
    || (rest.startsWith('/aksiyalar') ? 'sale' : rest.startsWith('/maslahatchi') ? 'ai' : '')

  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 600px)')
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const [seenPath, setSeenPath] = useState(path)
  if (seenPath !== path) {
    // navigation closes the mega menu (state adjusted during render, not in an effect)
    setSeenPath(path)
    setMega(false)
  }
  useEffect(() => {
    if (!mega) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMega(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [mega])

  const megaIcon = mega ? '✕' : '☰'
  return (
    <>
      <div className="ann" style={{ background: '#2A211E', color: '#FBFAF7', fontSize: '13px' }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', minHeight: '38px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
            <Icon name="truck" size={16} /> {tn(lang, 'Toshkent boʻylab [N] kunda ·', store.tashkentDays)}{' '}
            <b style={{ fontWeight: 600 }}>{tr('[300 000] soʻmdan yetkazish bepul').replace('[300 000]', fmt(store.freeDeliveryFrom))}</b>
          </span>
          <span className="hide-m" style={{ display: 'inline-flex', gap: '18px', alignItems: 'center', color: '#D9CFC9' }}>
            <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}><Icon name="shield" size={15} /> {tr('Faqat original, hujjatlari bilan')}</span>
            <a href={store.telegramUrl} style={{ color: '#FBFAF7', textDecoration: 'none', display: 'inline-flex', gap: '6px', alignItems: 'center' }}><Icon name="tg" size={15} /> {tr('Savol? Telegramda yozing')}</a>
            <span>
              {lang === 'uz' ? <>UZ · <Link href={otherPath} style={{ color: 'inherit', opacity: 0.6 }} hrefLang="ru">RU</Link></>
                : <><Link href={otherPath} style={{ color: 'inherit', opacity: 0.6 }} hrefLang="uz">UZ</Link> · RU</>}
            </span>
          </span>
        </div>
      </div>
      <header className="hdr" style={{ background: '#FBFAF7', borderBottom: '1px solid #ECE6E0', position: 'sticky', top: 0, zIndex: 20 }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: '16px', minHeight: '76px', flexWrap: 'wrap' }}>
          <button className="ib show-m hdr-burger" aria-label={tr('Menyu')} aria-expanded={mega} aria-controls="mega" onClick={() => setMega(!mega)} style={{ marginLeft: '-8px' }}>{megaIcon}</button>
          <Link href={L('/')} className="hdr-logo" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', font: "500 26px 'Inter Tight', sans-serif", letterSpacing: '-0.04em' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#E8B4B8', boxShadow: '8px 0 0 #2A211E' }} />
            <span style={{ marginLeft: '8px' }}>Yeppo</span>
          </Link>
          <button className="pill dark hide-m" style={{ minHeight: '48px' }} aria-expanded={mega} aria-controls="mega" onClick={() => setMega(!mega)}>{megaIcon} {tr('Katalog')}</button>
          <form action={L('/qidiruv')} role="search" className="hdr-search" style={{ flex: '1 1 320px', display: 'flex', alignItems: 'center', gap: '10px', height: '48px', padding: '0 6px 0 18px', borderRadius: '999px', background: '#F0EBE5', color: '#6B5F59', boxSizing: 'border-box', minWidth: 0 }}>
            <Icon name="search" size={19} />
            <input name="q" aria-label={tr('Qidiruv')} placeholder={phone ? tr('Krem, SPF yoki muammoni yozing') : tr('Masalan: quruq teri uchun krem, SPF, centella…')}
              style={{ flex: 1, minWidth: 0, fontSize: '15px', border: 'none', background: 'transparent', outline: 'none', color: '#2A211E', height: '100%', textOverflow: 'ellipsis' }} />
            <Link href={L('/maslahatchi')} className="hide-m" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: '999px', background: '#FBFAF7', color: '#2A211E', font: '600 13px Inter, sans-serif', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              <Icon name="spark" size={15} /> {tr('AI bilan topish')}
            </Link>
          </form>
          <nav aria-label={tr('Foydalanuvchi')} className="hdr-icons" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <Link href={L('/kabinet')} className="ib hdr-acc" aria-label={tr('Kabinet')}><Icon name="user" /></Link>
            <Link href={L('/sevimlilar')} className="ib" aria-label={tr('Sevimlilar')}><Icon name="heart" />{shop.favs.length > 0 && <span className="badge">{shop.favs.length}</span>}</Link>
            <a href={store.telegramUrl} className="ib phone-only" aria-label="Telegram"><Icon name="tg" /></a>
            <Link href={L('/savat')} className="pill dark hdr-cart" style={{ minHeight: '48px', padding: '0 16px 0 14px', marginLeft: '6px' }} aria-label={tr('Savat')}>
              <Icon name="bag" size={19} /><span className="num" style={{ fontSize: '15px' }}>{fmt(shop.total)}</span>
              <span style={{ minWidth: '22px', height: '22px', borderRadius: '999px', background: '#F2D6D0', color: '#2A211E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{shop.count}</span>
            </Link>
          </nav>
        </div>
        <nav aria-label={tr('Katalog')} className="wrap hide-m" style={{ display: 'flex', alignItems: 'center', gap: '2px', minHeight: '52px', overflowX: 'auto' }}>
          {NAV.map(([p, label, k]) => <Link key={k} href={L(p)} className={`navlink${k === current ? ' on' : ''}`}>{tr(label)}</Link>)}
          <span style={{ flex: 1 }} />
          <Link href={L('/aksiyalar')} className={`navlink${current === 'sale' ? ' on' : ''}`} style={{ color: '#A8475C', fontWeight: 600 }}>{tr('Aksiyalar')}</Link>
          <Link href={L('/aksiyalar#top')} className={`navlink${active === 'top' ? ' on' : ''}`}>Top-10</Link>
          <Link href={L('/maslahatchi')} className={`navlink${current === 'ai' ? ' on' : ''}`} style={{ gap: '6px' }}><Icon name="spark" size={15} /> {tr('AI maslahatchi')}</Link>
        </nav>
        {mega && <MegaMenu lang={lang} />}
      </header>
    </>
  )
}

function MegaMenu({ lang }: { lang: Lang }) {
  const tr = (s: string) => t(lang, s)
  return (
    <div id="mega" role="region" aria-label={tr('Katalog')} style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: '#FBFAF7', borderBottom: '1px solid #ECE6E0', boxShadow: '0 30px 60px rgba(42,33,30,.14)', zIndex: 30, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
      <div className="wrap" data-g="mega" style={{ display: 'grid', gap: '32px', paddingTop: '28px', paddingBottom: '32px' }}>
        {MEGA.map(([title, items]) => (
          <div key={title} style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <span className="eyebrow" style={{ marginBottom: '8px' }}>{tr(title)}</span>
            {items.map(([label, p, n]) => (
              <Link key={label} href={href(lang, p)} style={{ textDecoration: 'none', fontSize: '15px', padding: '5px 0', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                {tr(label)}<span className="muted" style={{ fontSize: '13px' }}>{n}</span>
              </Link>
            ))}
          </div>
        ))}
        <Link href={href(lang, '/maslahatchi')} className="card zoom" style={{ textDecoration: 'none', minHeight: '280px', display: 'flex', alignItems: 'flex-end', color: '#FBFAF7' }}>
          <img className="ph" src="/img/face-flower.jpg" alt="" style={{ position: 'absolute', inset: 0, objectPosition: '50% 25%' }} />
          <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 35%, rgba(42,33,30,.75))' }} />
          <span style={{ position: 'relative', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <b className="h" style={{ fontSize: '22px', lineHeight: 1.15 }}>{tr('Nima kerakligini bilmayapsizmi?')}</b>
            <span style={{ fontSize: '14px' }}>{tr('3 ta savol — va sizga mosini tanlab beraman ›')}</span>
          </span>
        </Link>
      </div>
    </div>
  )
}
