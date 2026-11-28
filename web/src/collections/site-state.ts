import type { GlobalConfig } from 'payload'

import { SITE_MODES } from '@/lib/site-state-def'

// Admin → Sozlamalar → Sayt holati: open / close the site and switch orders on or off without touching the server.
// Read by the proxy through /api/site-state (only the resolved flags, never a password).
const admin = ({ req }: { req: { user?: unknown } }) => !!req.user

export const SiteState: GlobalConfig = {
  slug: 'site-state',
  label: 'Sayt holati',
  admin: { group: 'Sozlamalar', description: 'Saytni ochish yoki yopish va buyurtma qabul qilishni yoqish/oʻchirish. Saqlangandan keyin 15 soniya ichida kuchga kiradi, serverni qayta ishga tushirish shart emas.' },
  access: { read: admin, update: admin },
  fields: [
    { name: 'mode', label: 'Sayt kimga koʻrinadi', type: 'radio', defaultValue: 'env', options: SITE_MODES,
      admin: { description: '«Ochiq» tanlansa sayt parolsiz ochiladi va Google’ga koʻrinadi. «Yopiq» — test rejimi: kirish uchun parol soʻraladi (foydalanuvchi: yeppo, parol Coolify’dagi SERVICE_PASSWORD_SITE).' } },
    { name: 'ordersEnabled', label: 'Buyurtma qabul qilinadi', type: 'checkbox', defaultValue: true,
      admin: { description: 'Oʻchirilsa sayt ishlayveradi, mahsulotlar koʻrinadi, lekin rasmiylashtirish sahifasida pastdagi xabar chiqadi va yangi buyurtma qabul qilinmaydi.' } },
    { name: 'ordersOffText', label: 'Buyurtma oʻchiq paytdagi xabar', type: 'textarea', localized: true,
      admin: { description: 'Boʻsh boʻlsa: «Buyurtma qabul qilish vaqtincha toʻxtatilgan. Tez orada qayta ochamiz.»' } },
  ],
  hooks: {
    afterChange: [async () => { if (process.env.YEPPO_SCRIPT === '1') return; try { (await import('@/lib/site-state')).invalidateSiteState() } catch { /* a script outside the site has no cache */ } }],
  },
}
