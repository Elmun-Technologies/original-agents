// "Ishga tushirishga tayyorlik": a plain list of what must be done before the shop takes real money, computed from the
// real state of the site (not a static to-do). Pure function (tested); the data comes from lib/readiness-load.ts.

export type Facts = {
  closed: boolean; https: boolean; ownDomain: boolean
  paymentsLive: boolean; clickReady: boolean; paymeReady: boolean; cardProvider: 'click' | 'payme'
  smsLive: boolean; eskizReady: boolean; telegramReady: boolean; secretsUnreadable: number
  google: boolean; yandex: boolean; ga4: boolean; metrica: boolean; meta: boolean; indexNow: boolean
  contacts: { phone: boolean; telegramUrl: boolean; telegramBot: boolean }
  legal: { oferta: boolean; maxfiylik: boolean }
  products: { real: number; sample: number; noStock: number; noBatch: number }
  admins: number; trackerEvents: number
}
export type Check = {
  id: string; must: boolean; title: string; status: 'ok' | 'todo' | 'warn' | 'manual'; detail: string
  link?: string; steps?: string[]
}

export function buildChecklist(f: Facts): { checks: Check[]; done: number; total: number; blockers: number } {
  const c: Check[] = []
  const add = (x: Omit<Check, 'status'> & { ok: boolean; warn?: boolean }) => { const { ok, warn, ...rest } = x; c.push({ ...rest, status: ok ? 'ok' : warn ? 'warn' : 'todo' }) }

  add({ id: 'domain', must: true, ok: f.ownDomain, title: 'Oʻz domeningiz ulangan (masalan yeppo.uz)', detail: f.ownDomain ? 'Domen ulangan.' : 'Hozir vaqtinchalik manzil ishlayapti. Mijozlarga va Google’ga haqiqiy domen kerak.',
    steps: ['Domen sotib oling (uz domenlari uchun uz.uz yoki registrator)', 'DNS’da A yozuvini server IP’siga yoʻnaltiring', 'Coolify → resurs → Domains ga domenni yozing (https avtomatik)', 'Coolify → Environment Variables → SITE_URL ni https://yeppo.uz qiling va qayta ishga tushiring'] })
  add({ id: 'https', must: true, ok: f.https, title: 'Sayt https orqali ochiladi', detail: f.https ? 'Xavfsiz ulanish ishlayapti.' : 'Sayt manzili https bilan boshlanmaydi.', steps: ['Domen ulangach Coolify sertifikatni oʻzi beradi'] })
  add({ id: 'open', must: true, ok: !f.closed, title: 'Sayt hamma uchun ochiq (parol olib tashlangan)', detail: f.closed ? 'Sayt hozir parol bilan yopiq va qidiruv tizimlariga koʻrinmaydi. Bu test uchun toʻgʻri; sotuvdan oldin ochiladi.' : 'Sayt ochiq.',
    steps: ['Coolify → Environment Variables’dan SITE_PASSWORD va SITE_NOINDEX ni oʻchiring', 'Qayta ishga tushiring (Redeploy)', 'Ochilgach: Integratsiyalar → IndexNow ni yoqing va Google/Yandex’ga sitemap’ni yuboring'] })

  const payKeys = f.cardProvider === 'click' ? f.clickReady : f.paymeReady
  add({ id: 'pay-keys', must: true, ok: payKeys && (f.clickReady || f.paymeReady), title: `Toʻlov tizimi kalitlari kiritilgan (${f.cardProvider === 'click' ? 'Click' : 'Payme'})`, link: '/admin/integratsiyalar#' + (f.cardProvider === 'click' ? 'click' : 'payme'),
    detail: payKeys ? 'Kalitlar bor.' : 'Click yoki Payme akkaunti va kalitlari kiritilmagan.', steps: ['Click yoki Payme’da biznes akkaunt oching (shartnoma kerak)', 'Integratsiyalar sahifasidagi kartada koʻrsatilgan manzillarni ularning kabinetiga yozing', 'Merchant ID va kalitlarni Integratsiyalarga kiriting'] })
  add({ id: 'pay-live', must: true, ok: f.paymentsLive, title: 'Haqiqiy toʻlov rejimi yoqilgan', link: '/admin/integratsiyalar#mode', detail: f.paymentsLive ? 'Haqiqiy toʻlovlar qabul qilinadi.' : 'Hozir sinov rejimi: mijoz pul toʻlamaydi, test sahifa chiqadi.',
    steps: ['Avval sinov rejimida bitta buyurtma berib koʻring', 'Provayder sinov kassasi tekshiruvlaridan oʻting (Payme: sandbox)', 'Integratsiyalar → «Toʻlov rejimi» → «Haqiqiy» → Saqlash (kalitlarsiz yoqilmaydi)', 'Eng kam summali bitta haqiqiy xarid qilib, pul kelganini tekshiring'] })
  add({ id: 'sms', must: true, ok: f.smsLive && f.eskizReady, title: 'SMS kodlar haqiqiy yuboriladi (Eskiz)', link: '/admin/integratsiyalar#eskiz',
    detail: f.smsLive && f.eskizReady ? 'SMS ishlayapti.' : f.smsLive ? 'Eskiz email/paroli kiritilmagan: mijoz kabinetga kira olmaydi.' : 'Sinov rejimi: kod ekranda koʻrinadi — har kim istalgan raqam bilan kirishi mumkin. Haqiqiy saytda ruxsat etilmaydi.',
    steps: ['my.eskiz.uz da akkaunt oching va hisobni toʻldiring', 'Shablonni tasdiqlating: «Yeppo: kirish kodi XXXX»', 'Integratsiyalar → Eskiz: email va parolni kiriting, «Tekshirish» ni bosing', 'Rejimni «Haqiqiy SMS» qiling'] })
  add({ id: 'tg', must: true, ok: f.telegramReady, title: 'Yangi buyurtma haqida Telegramda xabar keladi', link: '/admin/integratsiyalar#telegram', detail: f.telegramReady ? 'Bot ulangan.' : 'Bot tokeni yoki admin ID kiritilmagan: buyurtmani oʻz vaqtida koʻrmay qolishingiz mumkin.',
    steps: ['@BotFather orqali bot yarating', 'Integratsiyalar → Telegram: token va oʻz ID’ingizni kiriting, «Tekshirish» ni bosing'] })
  if (f.secretsUnreadable) c.push({ id: 'secrets', must: true, status: 'todo', title: 'Saqlangan kalitlarni qayta kiriting', detail: `${f.secretsUnreadable} ta kalit oʻqilmayapti (serverning maxfiy kaliti almashgan).`, link: '/admin/integratsiyalar' })

  add({ id: 'oferta', must: true, ok: f.legal.oferta, title: 'Ommaviy oferta matni yozilgan', link: '/admin/collections/legal-pages', detail: f.legal.oferta ? 'Matn bor.' : 'Sahifa bor, lekin matni boʻsh. Yuridik matnni yurist yozishi kerak.', steps: ['Yurist bilan oferta matnini tayyorlang', 'Huquqiy sahifalar → «Ommaviy oferta» → matnni joylang'] })
  add({ id: 'privacy', must: true, ok: f.legal.maxfiylik, title: 'Maxfiylik siyosati matni yozilgan', link: '/admin/collections/legal-pages', detail: f.legal.maxfiylik ? 'Matn bor.' : 'Matn boʻsh. Mijoz telefon va manzilini beradi — qonun talabi.', steps: ['Yuristdan shaxsiy maʼlumotlarni Hetzner (Yevropa) serverida saqlash masalasini ham soʻrang'] })
  add({ id: 'contacts', must: true, ok: f.contacts.phone && f.contacts.telegramUrl && f.contacts.telegramBot, title: 'Doʻkon aloqa maʼlumotlari kiritilgan', link: '/admin/globals/store',
    detail: f.contacts.phone && f.contacts.telegramUrl && f.contacts.telegramBot ? 'Telefon va Telegram havolalari bor.' : `Yetishmaydi: ${[!f.contacts.phone && 'telefon', !f.contacts.telegramUrl && 'Telegram kanal havolasi', !f.contacts.telegramBot && 'Telegram bot havolasi'].filter(Boolean).join(', ')}.`, steps: ['Doʻkon sozlamalari → telefon, Telegram kanal va bot havolalarini yozing'] })
  add({ id: 'products', must: true, ok: f.products.real > 0 && f.products.sample === 0, title: 'Saytda faqat haqiqiy mahsulotlar bor', link: '/admin/collections/products',
    detail: f.products.sample ? `${f.products.sample} ta NAMUNA mahsulot hali saytda (haqiqiy: ${f.products.real}). Mijoz ularni koʻradi va sotib olishga urinadi.` : f.products.real ? `${f.products.real} ta mahsulot.` : 'Hali mahsulot yoʻq.',
    steps: ['Q-Depot agentlari yoki qoʻlda haqiqiy mahsulotlarni qoʻshing', 'Namuna mahsulotlarni oʻchiring (Mahsulotlar → «Namuna maʼlumot» belgisi bor)'] })
  add({ id: 'stock', must: true, ok: f.products.real > 0 && f.products.noStock === 0, warn: f.products.noStock > 0 && f.products.noStock < f.products.real, title: 'Haqiqiy mahsulotlarning qoldigi kiritilgan', link: '/admin/collections/products',
    detail: !f.products.real ? 'Avval haqiqiy mahsulotlarni qoʻshing (yuqoridagi band).' : f.products.noStock ? `${f.products.noStock} ta mahsulotda qoldiq 0 — saytda «tugagan» koʻrinadi.` : 'Hammasida qoldiq bor.', steps: ['Tovar kelganda mahsulotni oching → «Hajmlar» → qoldiqni kiriting'] })
  add({ id: 'batch', must: false, ok: f.products.real > 0 && f.products.noBatch === 0, warn: true, title: 'Partiya raqami va yaroqlilik muddati kiritilgan', link: '/admin/collections/products', detail: !f.products.real ? 'Haqiqiy mahsulot hali yoʻq.' : f.products.noBatch ? `${f.products.noBatch} ta mahsulotda yoʻq. Sayt har sahifada «partiya va muddat bor» deb yozadi — boʻsh qolmasin.` : 'Hammasida bor.', steps: ['Mahsulotni oching → «Partiya va hujjatlar»'] })
  add({ id: 'admin', must: true, ok: f.admins > 0, title: 'Admin akkaunt yaratilgan', link: '/admin/collections/users', detail: f.admins ? `${f.admins} ta admin.` : 'Admin yoʻq.', steps: ['pnpm admin:create (serverda)'] })

  c.push({ id: 'backup', must: true, status: 'manual', title: 'Maʼlumotlar bazasining nusxasi serverdan tashqariga koʻchiriladi', detail: 'Bu yerdan tekshirib boʻlmaydi. Server buzilsa, buyurtmalar va mijozlar yoʻqolmasligi uchun kerak. Nusxa har kuni olinadi, lekin tashqi joy (Hetzner Storage Box yoki S3) sozlanmagan boʻlsa, faqat shu serverda turadi.',
    steps: ['Hetzner Storage Box (BX11) buyurtma qiling', 'Coolify → Environment Variables: OFFSITE_TYPE, OFFSITE_HOST, OFFSITE_USER, OFFSITE_PASS_OBSCURED (web/deploy/README.md da yozilgan)', 'Serverda: docker exec <backup> restore-test.sh — tiklash sinovi muvaffaqiyatli boʻlishi kerak'] })
  c.push({ id: 'e2e', must: true, status: 'manual', title: 'Bitta haqiqiy buyurtma boshidan oxirigacha sinalgan', detail: 'Telefon orqali: sayt → savat → toʻlov → Telegramga xabar → buyurtma sahifasi. Tizim buni oʻzi bilmaydi.', steps: ['Eng arzon mahsulotni oʻzingiz sotib oling', 'Toʻlov hisobingizga tushganini va Telegramga xabar kelganini tekshiring', 'Keyin buyurtmani bekor qilib, pulni qaytaring'] })

  add({ id: 'gsc', must: false, ok: f.google, title: 'Google Search Console ulangan', link: '/admin/integratsiyalar#gsc', detail: f.google ? 'Ulangan.' : 'Google qidiruvida sayt qanday koʻrinayotganini koʻrish uchun.', steps: ['Integratsiyalar → Google Search Console'] })
  add({ id: 'ywm', must: false, ok: f.yandex, title: 'Yandex Vebmaster ulangan', link: '/admin/integratsiyalar#ywm', detail: f.yandex ? 'Ulangan.' : 'Yandex qidiruvi uchun.', steps: ['Integratsiyalar → Yandex Vebmaster'] })
  add({ id: 'ga', must: false, ok: f.ga4 || f.metrica, title: 'Google Analytics yoki Yandex Metrika ulangan (ixtiyoriy)', link: '/admin/integratsiyalar#ga4', detail: 'Saytning oʻz analitikasi (Analitika sahifasi) bunga bogʻliq emas va allaqachon ishlaydi. Bular Google/Yandex hisobotlari va reklama uchun.', steps: ['Integratsiyalar → Google Analytics 4 / Yandex Metrika'] })
  add({ id: 'meta', must: false, ok: f.meta, title: 'Meta Pixel ulangan (Instagram reklamasi uchun)', link: '/admin/integratsiyalar#meta', detail: f.meta ? 'Ulangan.' : 'Instagram/Facebook reklamasini yurgizsangiz kerak boʻladi.', steps: ['Integratsiyalar → Meta Pixel'] })
  add({ id: 'tracker', must: false, ok: f.trackerEvents > 0, title: 'Oʻz analitikamiz tashrifchilarni qayd etyapti', link: '/admin/analitika', detail: f.trackerEvents ? `${f.trackerEvents} ta hodisa qayd etilgan.` : 'Hali hodisa yoʻq. Saytni admin sifatida emas, boshqa brauzerda oching.', })

  for (const x of c) if (!x.must && x.status === 'todo') x.status = 'warn' // a recommendation is never shown as a blocker
  const must = c.filter((x) => x.must)
  const done = must.filter((x) => x.status === 'ok').length
  const order = { todo: 0, warn: 1, manual: 2, ok: 3 } as const
  c.sort((a, b) => Number(b.must) - Number(a.must) || order[a.status] - order[b.status])
  return { checks: c, done, total: must.length, blockers: must.filter((x) => x.status === 'todo').length }
}
