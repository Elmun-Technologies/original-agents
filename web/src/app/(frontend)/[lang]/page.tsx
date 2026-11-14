// Home page — design/screens/Main.jpg (+ Main.ru, TabletMain, MobileHome).
import Link from 'next/link'

import { Faq, Hits, Routine, Sale } from '@/components/home/Blocks'
import { Chooser } from '@/components/home/Chooser'
import { Hero, type Slide } from '@/components/home/Hero'
import { MobileHome } from '@/components/home/MobileHome'
import { Categories, Guarantees, Journal, Segments, SeoFaq, TelegramCta } from '@/components/home/Static'
import { Icon } from '@/components/icons'
import { getStore, homeCards, payload } from '@/lib/catalog'
import { fmt } from '@/lib/format'
import { href, isLang, t, tn as tnL } from '@/lib/i18n'
import type { Media } from '@/payload-types'

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) return null
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const tn = (s: string, ...n: (string | number)[]) => tnL(lang, s, ...n)
  const p = await payload()
  const [store, cards, banners, brands] = await Promise.all([
    getStore(),
    homeCards(lang),
    p.find({ collection: 'banners', where: { active: { equals: true } }, sort: 'order', locale: lang, depth: 1, limit: 20 }),
    p.find({ collection: 'brands', where: { slug: { not_equals: 'yeppo' } }, sort: 'name', limit: 24, depth: 0 }),
  ])

  const slides: Slide[] = banners.docs.filter((b) => b.kind === 'slide').map((b) => ({
    tagShort: b.tagShort ?? undefined, titleShort: b.titleShort ?? undefined, ctaShort: b.ctaShort ?? undefined, tag: b.tag ?? undefined, tagStyle: b.tagStyle ?? undefined, title: b.title, text: b.text ?? undefined, cta: b.cta ?? undefined,
    link: b.link ?? undefined, img: (b.image as Media | undefined)?.url ?? '', pos: b.imagePos ?? undefined, bg: b.bg ?? undefined,
    alt: (b.image as Media | undefined)?.alt ?? '',
  }))
  const sale = banners.docs.find((b) => b.kind === 'sale' && b.endsAt && new Date(b.endsAt) > new Date())
  const deals = cards.filter((c) => c.old).slice(0, 4)
  const routine = (store.homeRoutine ?? []).flatMap((r) => cards.filter((c) => typeof r === 'object' && c.slug === r.slug))
  const giftFrom = cards.filter((c) => c.category === 'toplamlar').map((c) => c.price).sort((a, b) => a - b)[0]

  const faq: [string, string][] = [
    [tr('Mahsulotlar haqiqatan originalmi?'), tr('Ha. Rasmiy distribyutordan olamiz, har partiyaning hujjati bor. Mahsulot sahifasida partiya raqami va yaroqlilik muddati yozilgan — xohlasangiz, sertifikat nusxasini Telegramda yuboramiz.')],
    [tr('Qachon yetkazasizlar?'), tn('Toshkent boʻylab [N] kunda, viloyatlarga [N] kunda. Buyurtma yoʻlga chiqqanda Telegram bot xabar beradi.', store.tashkentDays, store.regionDays)],
    [tr('Mos kelmasa, qaytarsa boʻladimi?'), tn('Ochilmagan mahsulotni [N] kun ichida qaytarishingiz mumkin. Ochilgan boʻlsa ham yozing — birga yechim topamiz.', store.returnDays)],
    [tr('Qanday toʻlayman?'), tr('Click, Payme, Uzcard yoki Humo kartasi bilan — saytda yoki botda.')],
  ]
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }

  return (
    <>
      <MobileHome lang={lang} slides={slides} hits={cards.slice(0, 4)} cutoff={store.orderCutoff} />
      <div className="d-only">
        <Hero lang={lang} slides={slides} giftFrom={giftFrom ? fmt(giftFrom) : '599 000'} />
        <Guarantees tr={tr} tn={tn} store={store} />
        <Categories tr={tr} L={L} />
        <Chooser lang={lang} products={cards} />
        <Hits lang={lang} products={cards} />
      </div>
      {sale && deals.length > 0 && <Sale lang={lang} title={sale.title} accent={sale.accent ?? undefined} endsAt={sale.endsAt!} products={deals} />}
      <div className="d-only"><Segments tr={tr} L={L} /></div>
      <Routine lang={lang} products={routine} />
      {brands.docs.length > 0 && (
        <section className="wrap" style={{ marginTop: '40px' }} aria-labelledby="brand-h">
          <div className="sec-h"><h2 id="brand-h" className="h h2" style={{ fontSize: '40px' }}>{tr('Brendlar')}</h2><Link href={L('/brendlar')} className="pill line">{tr('Barcha brendlar')} <Icon name="right" size={16} /></Link></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
            {brands.docs.map((b) => (
              <Link key={b.id} href={L(`/brend/${b.slug}`)} className="card" style={{ height: '76px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', font: "600 17px 'Inter Tight', sans-serif", letterSpacing: '-0.02em', borderRadius: '16px' }}>{b.name}</Link>
            ))}
          </div>
        </section>
      )}
      {/* «Xaridorlar nima deydi» appears once there are verified reviews (stage 2) — no placeholder reviews. */}
      <Journal tr={tr} tn={tn} L={L} />
      <TelegramCta tr={tr} L={L} />
      <SeoFaq tr={tr} faq={<Faq items={faq} />} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </>
  )
}
