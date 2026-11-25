// The one table that describes every integration the owner can connect from the admin panel: which keys it
// needs, where to get them, how they are checked. The database schema, the admin screen, the validation and
// the "connected / not connected" status are all generated from it. No server-only code here (used by the browser too).

export type FieldDef = {
  key: string
  label: string
  kind?: 'text' | 'secret' | 'select' | 'checkbox'
  options?: { value: string; label: string }[]
  placeholder?: string
  hint?: string
  /** value must match (checked before it is saved; also stops a pasted <script> from reaching a page) */
  pattern?: RegExp
  patternError?: string
  /** server environment variable used when the admin panel has no value (how the site was set up before) */
  env?: string
}

export type ServiceDef = {
  id: string
  group: 'analytics' | 'search' | 'payments' | 'sms' | 'telegram'
  name: string
  logo: string
  what: string
  /** where the owner gets the keys: shown as a link and numbered steps */
  where: { label: string; url: string }
  steps: string[]
  fields: FieldDef[]
  /** the keys that must all be filled for it to work */
  required: string[]
  /** what to paste into the provider's cabinet (shown with the real domain, copyable) */
  callbacks?: { label: string; path: string }[]
  test?: boolean
  /** a second button that registers this site's address at the provider (Telegram webhook) */
  webhook?: boolean
}

const MODE = [{ value: 'mock', label: 'Sinov (pul yechilmaydi)' }, { value: 'live', label: 'Haqiqiy' }]

export const GROUPS: Record<ServiceDef['group'], string> = {
  analytics: 'Analitika va reklama',
  search: 'Qidiruv tizimlari',
  payments: 'Toʻlov',
  sms: 'SMS',
  telegram: 'Telegram',
}

export const SERVICES: ServiceDef[] = [
  {
    id: 'ga4', group: 'analytics', name: 'Google Analytics 4', logo: '/integrations/google-analytics.svg',
    what: 'Google hisobotlari uchun. Saytning oʻz analitikasi bunga bogʻliq emas — u tayyor ishlaydi.',
    where: { label: 'analytics.google.com', url: 'https://analytics.google.com' },
    steps: ['analytics.google.com → Admin → Create → Property', 'Data streams → Web → saytingiz manzilini kiriting', 'Chiqqan «Measurement ID» (G- bilan boshlanadi) ni pastga qoʻying'],
    fields: [{ key: 'ga4Id', label: 'Measurement ID', placeholder: 'G-XXXXXXXXXX', pattern: /^G-[A-Z0-9]{4,12}$/, patternError: 'G- bilan boshlanishi kerak, masalan G-AB12CD34EF' }],
    required: ['ga4Id'],
  },
  {
    id: 'metrica', group: 'analytics', name: 'Yandex Metrika', logo: '/integrations/yandex-metrica.svg',
    what: 'Yandex hisobotlari, klik-xarita va (xohlasangiz) sessiya yozuvi.',
    where: { label: 'metrika.yandex.ru', url: 'https://metrika.yandex.ru' },
    steps: ['metrika.yandex.ru → «Добавить счётчик»', 'Sayt manzilini kiriting va hisoblagich yarating', 'Hisoblagich raqamini (faqat raqamlar) pastga qoʻying'],
    fields: [
      { key: 'metricaId', label: 'Hisoblagich raqami', placeholder: '12345678', pattern: /^\d{5,12}$/, patternError: 'Faqat raqamlar, 5–12 ta' },
      { key: 'metricaWebvisor', label: 'Vebvizor (mijoz sessiyasi yozuvi) — mijoz roziligi kerak boʻlishi mumkin', kind: 'checkbox' },
    ],
    required: ['metricaId'],
  },
  {
    id: 'meta', group: 'analytics', name: 'Meta Pixel (Instagram / Facebook)', logo: '/integrations/meta.svg',
    what: 'Instagram va Facebook reklamasi natijasini oʻlchash va qayta reklama uchun.',
    where: { label: 'business.facebook.com/events_manager', url: 'https://business.facebook.com/events_manager' },
    steps: ['Events Manager → Connect data sources → Web', 'Pixel yarating', 'Pixel ID (raqam) ni pastga qoʻying'],
    fields: [{ key: 'metaPixelId', label: 'Pixel ID', placeholder: '1234567890123456', pattern: /^\d{8,20}$/, patternError: 'Faqat raqamlar' }],
    required: ['metaPixelId'],
  },
  {
    id: 'gsc', group: 'search', name: 'Google Search Console', logo: '/integrations/google-search-console.svg',
    what: 'Google qidiruvida sayt qanday koʻrinayotganini va qaysi soʻrovlar olib kelayotganini koʻrasiz.',
    where: { label: 'search.google.com/search-console', url: 'https://search.google.com/search-console' },
    steps: ['search.google.com/search-console → Add property → URL prefix', 'Tasdiqlash usuli: «HTML tag»', 'content="…" ichidagi uzun kodni pastga qoʻying (butun teg emas, faqat kod)', 'Saqlang, keyin Search Console’da «Verify» ni bosing', 'Sitemaps boʻlimiga pastdagi sitemap manzilini qoʻshing'],
    fields: [{ key: 'googleVerification', label: 'Tasdiqlash kodi', placeholder: 'abcDEF123…', pattern: /^[A-Za-z0-9_-]{20,100}$/, patternError: 'Faqat content="…" ichidagi kod' }],
    required: ['googleVerification'],
    callbacks: [{ label: 'Sitemap manzili', path: '/sitemap.xml' }],
  },
  {
    id: 'ywm', group: 'search', name: 'Yandex Vebmaster', logo: '/integrations/yandex-webmaster.svg',
    what: 'Yandex qidiruvi uchun: indekslash, xatolar va soʻrovlar.',
    where: { label: 'webmaster.yandex.ru', url: 'https://webmaster.yandex.ru' },
    steps: ['webmaster.yandex.ru → «Добавить сайт»', 'Tasdiqlash: «Meta-тег»', 'content="…" ichidagi kodni pastga qoʻying', 'Saqlang, keyin Vebmaster’da «Проверить» ni bosing', 'Indexing → Sitemap boʻlimiga pastdagi manzilni qoʻshing'],
    fields: [{ key: 'yandexVerification', label: 'Tasdiqlash kodi', placeholder: '1a2b3c4d5e6f7a8b', pattern: /^[A-Za-z0-9]{8,64}$/, patternError: 'Faqat content="…" ichidagi kod' }],
    required: ['yandexVerification'],
    callbacks: [{ label: 'Sitemap manzili', path: '/sitemap.xml' }],
  },
  {
    id: 'bing', group: 'search', name: 'Bing Webmaster', logo: '/integrations/bing.svg',
    what: 'Bing va u orqali ishlaydigan boshqa qidiruvlar uchun (ixtiyoriy).',
    where: { label: 'bing.com/webmasters', url: 'https://www.bing.com/webmasters' },
    steps: ['bing.com/webmasters → Add a site', 'Tasdiqlash: «HTML Meta Tag»', 'content="…" ichidagi kodni pastga qoʻying'],
    fields: [{ key: 'bingVerification', label: 'Tasdiqlash kodi', placeholder: 'ABCDEF0123456789', pattern: /^[A-Za-z0-9]{8,64}$/, patternError: 'Faqat content="…" ichidagi kod' }],
    required: ['bingVerification'],
  },
  {
    id: 'indexnow', group: 'search', name: 'IndexNow (tez indekslash)', logo: '/integrations/indexnow.svg',
    what: 'Mahsulot yoki maqola oʻzgarganda Yandex va Bing’ga darrov xabar beradi. Kalitni hech qayerdan olish shart emas — oʻzimiz yaratamiz.',
    where: { label: 'indexnow.org', url: 'https://www.indexnow.org' },
    steps: ['Kalit avtomatik yaratilgan', 'Faqat yoqing. Sayt ochiq (parolsiz) boʻlgandagina ishlaydi'],
    fields: [
      { key: 'indexNowOn', label: 'Yoqilgan', kind: 'checkbox' },
      { key: 'indexNowKey', label: 'Kalit (avtomatik)', pattern: /^[a-f0-9]{16,64}$/, patternError: '16–64 ta kichik harf/raqam' },
    ],
    required: ['indexNowOn'],
    callbacks: [{ label: 'Kalit fayli', path: '/indexnow/{indexNowKey}' }],
  },
  {
    id: 'mode', group: 'payments', name: 'Toʻlov rejimi', logo: '/integrations/payments.svg',
    what: 'Sinov rejimida pul yechilmaydi va mijoz test sahifa koʻradi. Haqiqiy rejim faqat kalitlar toʻliq kiritilganda yoqiladi.',
    where: { label: 'Click va Payme kabinetlari', url: 'https://merchant.click.uz' },
    steps: ['Avval pastdagi Click yoki Payme kartasini toʻldiring', 'Sinov rejimida bitta toʻlovni sinab koʻring', 'Keyin bu yerda «Haqiqiy» ni tanlab saqlang'],
    fields: [
      { key: 'paymentsMode', label: 'Rejim', kind: 'select', options: MODE, env: 'PAYMENTS_MODE' },
      { key: 'cardProvider', label: 'Uzcard/Humo kartasi qaysi tizim orqali oʻtadi', kind: 'select', options: [{ value: 'payme', label: 'Payme' }, { value: 'click', label: 'Click' }], env: 'CARD_PROVIDER' },
    ],
    required: [],
  },
  {
    id: 'click', group: 'payments', name: 'Click', logo: '/integrations/click.svg',
    what: 'Click orqali toʻlov qabul qilish.',
    where: { label: 'merchant.click.uz', url: 'https://merchant.click.uz' },
    steps: ['Click Merchant kabinetida servis yarating', 'Pastdagi «Prepare» va «Complete» manzillarini ikkalasiga bir xil yozing', 'Service ID, Merchant ID va Secret key ni pastga qoʻying'],
    fields: [
      { key: 'clickServiceId', label: 'Service ID', env: 'CLICK_SERVICE_ID', pattern: /^\d{1,12}$/, patternError: 'Faqat raqamlar' },
      { key: 'clickMerchantId', label: 'Merchant ID', env: 'CLICK_MERCHANT_ID', pattern: /^\d{1,12}$/, patternError: 'Faqat raqamlar' },
      { key: 'clickSecret', label: 'Secret key', kind: 'secret', env: 'CLICK_SECRET_KEY' },
    ],
    required: ['clickServiceId', 'clickMerchantId', 'clickSecret'],
    callbacks: [{ label: 'Prepare va Complete manzili (ikkalasiga)', path: '/api/pay/click' }],
  },
  {
    id: 'payme', group: 'payments', name: 'Payme', logo: '/integrations/payme.svg',
    what: 'Payme orqali toʻlov qabul qilish.',
    where: { label: 'merchant.payme.uz', url: 'https://merchant.payme.uz' },
    steps: ['Payme Business kabinetida kassa yarating', 'Endpoint URL ga pastdagi manzilni, hisob maydoni nomiga order_id ni yozing', 'Merchant ID va kalitni (Key) pastga qoʻying', 'Avval «Sinov kassasi» ni yoqib Payme’ning sinovlaridan oʻting'],
    fields: [
      { key: 'paymeMerchantId', label: 'Merchant ID', env: 'PAYME_MERCHANT_ID', pattern: /^[A-Za-z0-9]{10,40}$/, patternError: 'Harf va raqamlar' },
      { key: 'paymeKey', label: 'Key (parol)', kind: 'secret', env: 'PAYME_KEY' },
      { key: 'paymeTest', label: 'Payme sinov kassasi (checkout.test.paycom.uz)', kind: 'checkbox', env: 'PAYME_TEST' },
    ],
    required: ['paymeMerchantId', 'paymeKey'],
    callbacks: [{ label: 'Endpoint URL', path: '/api/pay/payme' }, { label: 'Hisob maydoni nomi', path: 'order_id' }],
  },
  {
    id: 'eskiz', group: 'sms', name: 'Eskiz SMS', logo: '/integrations/eskiz.svg',
    what: 'Mijoz kabinetiga kirish kodini SMS bilan yuboradi. Sinov rejimida SMS ketmaydi va kod ekranda koʻrinadi (faqat test uchun!).',
    where: { label: 'my.eskiz.uz', url: 'https://my.eskiz.uz' },
    steps: ['my.eskiz.uz da roʻyxatdan oʻting va hisobni toʻldiring', 'SMS shablonini tasdiqlating: «Yeppo: kirish kodi XXXX»', 'Email va parolni pastga qoʻying, «Tekshirish» ni bosing'],
    fields: [
      { key: 'smsMode', label: 'Rejim', kind: 'select', options: [{ value: 'mock', label: 'Sinov (SMS ketmaydi, kod ekranda)' }, { value: 'live', label: 'Haqiqiy SMS' }], env: 'SMS_MODE' },
      { key: 'eskizEmail', label: 'Eskiz email', env: 'ESKIZ_EMAIL', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternError: 'Email notoʻgʻri' },
      { key: 'eskizPassword', label: 'Eskiz parol / API kalit', kind: 'secret', env: 'ESKIZ_PASSWORD' },
      { key: 'eskizFrom', label: 'Yuboruvchi nomi', placeholder: '4546', env: 'ESKIZ_FROM', pattern: /^[A-Za-z0-9 ._-]{1,20}$/, patternError: '1–20 belgi' },
    ],
    required: ['eskizEmail', 'eskizPassword'],
    test: true,
  },
  {
    id: 'telegram', group: 'telegram', name: 'Telegram bot (adminga xabarlar)', logo: '/integrations/telegram.svg',
    what: 'Har bir toʻlangan buyurtma haqida sizga Telegramda xabar keladi. Shu bot mijozlar uchun ham ishlaydi: buyurtma holatini yozadi va «Kelganda xabar berish» ni bajaradi (domen ulangach «Webhook oʻrnatish» ni bosing).',
    where: { label: 't.me/BotFather', url: 'https://t.me/BotFather' },
    steps: ['Telegramda @BotFather → /newbot → bot yarating, token oling', 'Botga oʻzingiz /start yozing', 'Oʻz Telegram ID’ingizni @userinfobot dan bilib oling', 'Token va ID’ni pastga qoʻying, «Tekshirish» ni bosing', 'Sayt domeniga ulangach «Webhook oʻrnatish» ni bosing — mijozlar botga yozsa, javob beradi'],
    fields: [
      { key: 'telegramToken', label: 'Bot token', kind: 'secret', env: 'TELEGRAM_BOT_TOKEN' },
      { key: 'telegramAdminIds', label: 'Admin Telegram ID’lari (vergul bilan)', placeholder: '123456789', env: 'TELEGRAM_ADMIN_IDS', pattern: /^\s*\d{4,15}(\s*,\s*\d{4,15})*\s*$/, patternError: 'Faqat raqamlar, vergul bilan' },
    ],
    required: ['telegramToken', 'telegramAdminIds'],
    test: true,
    webhook: true,
  },
]

export const ALL_FIELDS: FieldDef[] = SERVICES.flatMap((s) => s.fields)
export const SECRET_KEYS = ALL_FIELDS.filter((f) => f.kind === 'secret').map((f) => f.key)
export const CHECKBOX_KEYS = ALL_FIELDS.filter((f) => f.kind === 'checkbox').map((f) => f.key)

export type Values = Record<string, string | boolean | undefined>
export type Status = 'on' | 'partial' | 'off'

const filled = (v: unknown) => (typeof v === 'boolean' ? v : typeof v === 'string' && v.trim() !== '')

/** on = every required key present, partial = some, off = none */
export function statusOf(s: ServiceDef, v: Values): Status {
  if (!s.required.length) return 'on'
  const n = s.required.filter((k) => filled(v[k])).length
  return n === s.required.length ? 'on' : n ? 'partial' : 'off'
}

const PAY_KEYS = ['paymentsMode', 'cardProvider', 'clickServiceId', 'clickMerchantId', 'clickSecret', 'paymeMerchantId', 'paymeKey']

/** Rules that protect real money and real customers. Returns messages in Uzbek (empty = fine).
 * `changed` = the keys this save touches: only those are checked, so an unrelated save (a Google ID) is never
 * blocked by a half-finished payment setup. Without it everything is checked (what the screen warns about). */
export function validate(v: Values, changed?: string[]): string[] {
  const out: string[] = []
  const touched = (...keys: string[]) => !changed || keys.some((k) => changed.includes(k))
  for (const f of ALL_FIELDS) {
    const val = v[f.key]
    if (touched(f.key) && f.pattern && typeof val === 'string' && val.trim() && !f.pattern.test(val.trim())) out.push(`${f.label}: ${f.patternError ?? 'notoʻgʻri'}`)
  }
  const svc = (id: string) => SERVICES.find((s) => s.id === id)!
  const ready = (id: string) => statusOf(svc(id), v) === 'on'
  if (v.paymentsMode === 'live' && touched(...PAY_KEYS)) {
    if (!ready('click') && !ready('payme')) out.push('Haqiqiy toʻlov rejimi: Click yoki Payme kalitlarini toʻliq kiriting.')
    if ((v.cardProvider ?? 'payme') === 'click' && !ready('click')) out.push('Uzcard/Humo Click orqali tanlangan, lekin Click kalitlari toʻliq emas.')
    if ((v.cardProvider ?? 'payme') !== 'click' && !ready('payme')) out.push('Uzcard/Humo Payme orqali tanlangan, lekin Payme kalitlari toʻliq emas.')
  }
  // SMS: only when the owner switches the mode itself (an untouched site defaults to "live", see the launch checklist)
  if (v.smsMode === 'live' && changed && changed.includes('smsMode') && !ready('eskiz')) out.push('Haqiqiy SMS: Eskiz email va parolini kiriting.')
  return out
}

type Env = Record<string, string | undefined>

/** The values the site really uses: what the owner saved in the admin panel, else the server's environment
 * variable (how the site was configured before this screen existed), else a safe default. */
export function effective(db: Values, env: Env): Values {
  const out: Values = {}
  for (const f of ALL_FIELDS) {
    const v = db[f.key]
    if (f.kind === 'checkbox') out[f.key] = v === true || (!!f.env && env[f.env] === '1')
    else out[f.key] = (typeof v === 'string' && v.trim()) || (f.env ? env[f.env]?.trim() : '') || ''
  }
  out.paymentsMode = out.paymentsMode === 'live' ? 'live' : 'mock'
  out.cardProvider = out.cardProvider === 'click' ? 'click' : 'payme'
  out.smsMode = out.smsMode === 'mock' ? 'mock' : 'live'
  out.eskizFrom ||= '4546'
  return out
}

/** where each key comes from, for the screen: the owner's own entry, the server environment, or nothing */
export function sourcesOf(db: Values, env: Env): Record<string, 'admin' | 'env' | 'none'> {
  const out: Record<string, 'admin' | 'env' | 'none'> = {}
  for (const f of ALL_FIELDS) {
    const own = f.kind === 'checkbox' ? db[f.key] === true : filled(db[f.key])
    out[f.key] = own ? 'admin' : f.env && filled(env[f.env]) ? 'env' : 'none'
  }
  return out
}
