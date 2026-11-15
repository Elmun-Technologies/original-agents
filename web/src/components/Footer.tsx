'use client'
// Footer + MobileTabBar + Toast (design/source/common.py: FOOTER, TOAST).
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { href, t, type Lang } from '@/lib/i18n'
import { Icon, type IconName } from './icons'
import { useShop } from './shop'

const COLS: [string, [string, string][]][] = [
  ['Doʻkon', [['Katalog', '/yuz-parvarishi'], ['Aksiyalar', '/aksiyalar'], ['Brendlar', '/brendlar'], ['Kim uchun', '/kim-uchun/18-25'], ['Sovgʻalar', '/sovgalar']]],
  ['Xaridorga', [['Buyurtmani kuzatish', '/kabinet'], ['Bonus dasturi', '/bonus'], ['Yetkazish va toʻlov', '/yordam/yetkazish'], ['Qaytarish', '/yordam/qaytarish'], ['Originallikni tekshirish', '/yordam/originallik']]],
  ['Bilim', [['Jurnal', '/jurnal'], ['AI maslahatchi', '/maslahatchi'], ['Rutina quruvchi', '/rutina'], ['Ingredientlar lugʻati', '/jurnal#lugat']]],
]

export function Footer({ lang, telegramUrl }: { lang: Lang; telegramUrl: string }) {
  const tr = (s: string) => t(lang, s)
  const link = { color: '#E9E1DC' }
  return (
    <footer style={{ marginTop: '48px', background: '#2A211E', color: '#E9E1DC' }}>
      <div className="wrap" style={{ paddingTop: '48px', paddingBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '32px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <span style={{ font: "500 30px 'Inter Tight', sans-serif", letterSpacing: '-0.04em', color: '#FBFAF7' }}>Yeppo</span>
            <span style={{ lineHeight: 1.6, fontSize: '15px' }}>{tr('Koreyadan original parvarish vositalari. Bilmasangiz — soʻrang: Telegramda har kuni 9:00 dan 22:00 gacha javob beramiz.')}</span>
            <a href={telegramUrl} className="pill" style={{ borderColor: 'rgba(251,250,247,.3)', color: '#FBFAF7', alignSelf: 'flex-start' }}><Icon name="tg" size={18} /> {tr('Telegramda yozish')}</a>
          </div>
          <div data-g="foot" style={{ display: 'grid', gap: '28px', flex: '2 1 520px', fontSize: '14px' }}>
            {COLS.map(([title, links]) => (
              <div key={title} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <b style={{ color: '#FBFAF7', fontWeight: 600 }}>{tr(title)}</b>
                {links.map(([label, p]) => <Link key={label} href={href(lang, p)} style={link}>{tr(label)}</Link>)}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(251,250,247,.12)', fontSize: '13px', color: '#B9ADA6' }}>
          <span>© 2026 Yeppo · <Link href={href(lang, '/yordam/oferta')} style={{ color: 'inherit' }}>{tr('Ommaviy oferta')}</Link> · <Link href={href(lang, '/yordam/maxfiylik')} style={{ color: 'inherit' }}>{tr('Maxfiylik')}</Link></span>
          <span style={{ display: 'inline-flex', gap: '6px' }}>
            {['Click', 'Payme', 'Uzcard', 'Humo'].map((p) => <span key={p} className="chip" style={{ background: 'rgba(251,250,247,.1)', color: '#FBFAF7' }}>{p}</span>)}
          </span>
        </div>
      </div>
    </footer>
  )
}

const TABS: [string, string, IconName][] = [
  ['/', 'Bosh', 'home'], ['/yuz-parvarishi', 'Katalog', 'grid'], ['/maslahatchi', 'Maslahat', 'spark'], ['/savat', 'Savat', 'bag'], ['/kabinet', 'Kabinet', 'user'],
]

export function MobileTabBar({ lang }: { lang: Lang }) {
  const shop = useShop()
  const path = usePathname() || ''
  return (
    <nav className="mtabs" aria-label={t(lang, 'Asosiy menyu')}>
      {TABS.map(([p, label, icon]) => {
        const target = href(lang, p)
        const rest = path.replace(/^\/(uz|ru)/, '')
        const on = p === '/' ? path === target
          : p === '/yuz-parvarishi' ? /^\/(yuz-parvarishi|katalog|mahsulot|brend|kim-uchun)/.test(rest)
          : path.startsWith(target)
        return (
          <Link key={p} href={target} aria-current={on ? 'page' : undefined} style={{ position: 'relative', ...(on ? { color: '#2A211E', fontWeight: 600 } : {}) }}>
            <Icon name={icon} size={22} />{t(lang, label)}
            {p === '/savat' && shop.count > 0 && <span className="badge" style={{ top: '2px', right: '50%', marginRight: '-22px' }}>{shop.count}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export function Toast({ lang }: { lang: Lang }) {
  const { toast } = useShop()
  if (!toast) return null
  return (
    <div className="toast" role="status">
      <img loading="lazy" decoding="async" src={toast.img} alt="" style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover' }} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: '14px', fontWeight: 600 }}>{t(lang, 'Savatga qoʻshildi')}</b>
        <span style={{ fontSize: '13px', color: '#D9CFC9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast.name}</span>
      </span>
      <Link href={href(lang, '/savat')} className="pill" style={{ minHeight: '40px', background: '#F2D6D0', borderColor: '#F2D6D0', color: '#2A211E', fontSize: '13px' }}>{t(lang, 'Savatga')}</Link>
    </div>
  )
}
