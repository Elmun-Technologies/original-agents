// SEO audit: what is missing on the site that search engines and customers need. Pure function `buildAudit` (tested)
// plus a loader that reads the data. Every finding links to the admin page where it is fixed.

export type Product = { id: number | string; name: string; hasDescription: boolean; hasSummary: boolean; images: number; price: number; hasRuText: boolean; hasBatch: boolean; hasSeoDescription: boolean }
export type Article = { id: number | string; title: string; hasExcerpt: boolean; hasCover: boolean; hasRuTitle: boolean }
export type Category = { id: number | string; title: string; hasSeoText: boolean }
export type Brand = { id: number | string; name: string; hasAbout: boolean }
export type SiteFacts = { closed: boolean; https: boolean; ownDomain: boolean; google: boolean; yandex: boolean; analytics: boolean; indexNow: boolean }

export type Item = { label: string; href: string }
export type Finding = { id: string; severity: 'high' | 'mid' | 'low'; title: string; why: string; fix: string; items: Item[]; total: number; site?: boolean; link?: string }

const W = { high: 3, mid: 2, low: 1 } as const
const edit = (c: string, id: number | string) => `/admin/collections/${c}/${id}`

export function buildAudit(d: { products: Product[]; articles: Article[]; categories: Category[]; brands: Brand[]; site: SiteFacts }) {
  const out: Finding[] = []
  const list = <T extends { id: number | string }>(rows: T[], bad: (r: T) => boolean, name: (r: T) => string, coll: string, f: Omit<Finding, 'items' | 'total'>) => {
    const items = rows.filter(bad).map((r) => ({ label: name(r), href: edit(coll, r.id) }))
    out.push({ ...f, items, total: rows.length })
  }
  const P = d.products
  list(P, (p) => p.price <= 0, (p) => p.name, 'products', { id: 'price0', severity: 'high', title: 'Narxi 0 yoki yoʻq mahsulotlar', why: 'Narxsiz mahsulot qidiruvda «narx» bilan chiqmaydi va xarid qilib boʻlmaydi.', fix: 'Mahsulotni oching → «Hajmlar» → narxni kiriting.' })
  list(P, (p) => !p.hasDescription, (p) => p.name, 'products', { id: 'desc', severity: 'high', title: 'Tavsifi yoʻq mahsulotlar', why: 'Google va Yandex faqat matnga qarab sahifani tushunadi. Matnsiz sahifa qidiruvda deyarli koʻrinmaydi, mijoz ham ishonmaydi.', fix: 'Mahsulotni oching → «Tavsif» ga 3–4 gap yozing: nima uchun, kimga mos, qancha vaqtda natija.' })
  list(P, (p) => p.images === 0, (p) => p.name, 'products', { id: 'noimg', severity: 'high', title: 'Rasmi yoʻq mahsulotlar', why: 'Rasmsiz mahsulot sotilmaydi va qidiruvning rasmlar boʻlimiga tushmaydi.', fix: 'Mahsulotni oching → «Rasmlar» ga asl suratni yuklang.' })
  list(P, (p) => !p.hasSummary, (p) => p.name, 'products', { id: 'summary', severity: 'mid', title: 'Qisqacha tavsifi yoʻq mahsulotlar', why: 'Qidiruv natijasidagi matn va kartochka shundan olinadi.', fix: 'Mahsulotni oching → «Qisqacha tavsif» ga bir-ikki gap yozing.' })
  list(P, (p) => !p.hasRuText, (p) => p.name, 'products', { id: 'ru', severity: 'mid', title: 'Ruscha matni yoʻq mahsulotlar', why: 'Ruscha sahifa oʻzbekcha matn bilan chiqadi — Yandex va ruscha oʻqiydigan mijozlar uchun yomon.', fix: 'Mahsulotni oching → yuqoridagi «Oʻzbekcha» tilini «Русский» ga almashtiring va qisqacha tavsifni yozing.' })
  list(P, (p) => !p.hasBatch, (p) => p.name, 'products', { id: 'batch', severity: 'mid', title: 'Partiya raqami yoki yaroqlilik muddati yoʻq mahsulotlar', why: 'Sayt «original, hujjatlari bor» deb va’da beradi: partiya va muddat har sahifada koʻrinishi kerak. Bu ishonch va Google’ning «E-E-A-T» talabi.', fix: 'Tovar kelganda mahsulotni oching → «Partiya va hujjatlar».' })
  list(P, (p) => !p.hasSeoDescription, (p) => p.name, 'products', { id: 'seodesc', severity: 'low', title: 'Qidiruv uchun maxsus tavsif yozilmagan mahsulotlar', why: 'Yozilmasa sayt oʻzi yaratadi (yomon emas). Eng koʻp sotiladiganlar uchun oʻzingiz yozsangiz, qidiruvda bosish koʻproq boʻladi.', fix: 'Mahsulotni oching → «SEO» boʻlimi.' })
  list(d.categories, (c) => !c.hasSeoText, (c) => c.title, 'categories', { id: 'cat', severity: 'mid', title: 'SEO matni yoʻq toifalar', why: 'Toifa sahifalari (Serum, SPF …) eng koʻp qidiriladigan sahifalar. Pastdagi izohli matn ularni qidiruvda koʻtaradi.', fix: 'Toifani oching → «SEO sarlavha» va «SEO matn» (120–200 soʻz).' })
  list(d.articles, (a) => !a.hasExcerpt, (a) => a.title, 'articles', { id: 'artx', severity: 'mid', title: 'Qisqa matni yoʻq maqolalar', why: 'Maqola qidiruvda shu matn bilan koʻrinadi.', fix: 'Maqolani oching → «Qisqa matn».' })
  list(d.articles, (a) => !a.hasCover, (a) => a.title, 'articles', { id: 'artimg', severity: 'low', title: 'Muqova rasmi yoʻq maqolalar', why: 'Ijtimoiy tarmoqda ulashilganda rasmsiz chiqadi.', fix: 'Maqolani oching → «Muqova rasmi».' })
  list(d.articles, (a) => !a.hasRuTitle, (a) => a.title, 'articles', { id: 'artru', severity: 'low', title: 'Ruscha sarlavhasi yoʻq maqolalar', why: 'Ruscha sahifa oʻzbekcha chiqadi.', fix: 'Maqolani oching → tilni «Русский» ga almashtirib sarlavhani yozing.' })
  list(d.brands, (b) => !b.hasAbout, (b) => b.name, 'brands', { id: 'brand', severity: 'low', title: 'Tavsifi yoʻq brendlar', why: 'Brend sahifasi «SKIN1004 original Toshkentda» kabi soʻrovlarda chiqadi — matn boʻlsa kuchliroq.', fix: 'Brendni oching → «Brend haqida».' })

  const s = d.site
  const site = (id: string, severity: Finding['severity'], bad: boolean, title: string, why: string, fix: string, link: string) =>
    out.push({ id, severity, title, why, fix, items: bad ? [{ label: 'Hozir: tayyor emas', href: link }] : [], total: 1, site: true, link })
  site('closed', 'high', s.closed, 'Sayt qidiruv tizimlariga yopiq', 'Hozir sayt parol bilan yopiq yoki «noindex» qilingan: Google va Yandex uni umuman koʻrmaydi. Test uchun toʻgʻri, lekin sotuv boshlanganda ochish shart.', 'Coolify’da SITE_PASSWORD va SITE_NOINDEX ni oʻchirib, qayta ishga tushiring.', '/admin/tayyorlik')
  site('https', 'high', !s.https, 'Sayt https emas', 'Google https’siz saytni past baholaydi, brauzer «xavfsiz emas» deydi.', 'Domenni ulang (Coolify avtomatik sertifikat beradi).', '/admin/tayyorlik')
  site('domain', 'mid', !s.ownDomain, 'Oʻz domeni ulanmagan', 'Vaqtinchalik manzil (sslip.io) bilan Google’da brend yigʻib boʻlmaydi.', 'yeppo.uz kabi domen oling va Coolify’da ulang.', '/admin/tayyorlik')
  site('google', 'mid', !s.google, 'Google Search Console ulanmagan', 'Google qaysi soʻrovlar saytga olib kelayotganini va xatolarni faqat shu orqali koʻrsatadi.', 'Integratsiyalar → Google Search Console.', '/admin/integratsiyalar#gsc')
  site('yandex', 'mid', !s.yandex, 'Yandex Vebmaster ulanmagan', 'Oʻzbekistonda Yandex ham koʻp ishlatiladi.', 'Integratsiyalar → Yandex Vebmaster.', '/admin/integratsiyalar#ywm')
  site('indexnow', 'low', !s.indexNow, 'IndexNow yoqilmagan', 'Yangi mahsulot Yandex va Bing’da kunlar emas, daqiqalarda paydo boʻladi.', 'Integratsiyalar → IndexNow → «Yoqilgan».', '/admin/integratsiyalar#indexnow')

  // 0–100: every check counts by weight; an item check counts by the share of items that are wrong
  let total = 0, lost = 0
  for (const f of out) {
    if (!f.total) continue
    total += W[f.severity]
    lost += W[f.severity] * (f.site ? (f.items.length ? 1 : 0) : f.items.length / f.total)
  }
  const score = total ? Math.round(100 * (1 - lost / total)) : 100
  out.sort((a, b) => (b.items.length > 0 ? 1 : 0) - (a.items.length > 0 ? 1 : 0) || W[b.severity] - W[a.severity] || b.items.length - a.items.length)
  return { findings: out, score, problems: out.filter((f) => f.items.length).length }
}
