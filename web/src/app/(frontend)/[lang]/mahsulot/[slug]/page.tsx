// Product — design/screens/Product.jpg (+ Product.ru, TabletProduct, MobileProduct).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ProductCard } from '@/components/ProductCard'
import { ProductInfo, ProductMain, ProductPhone, Reviews, Together, type ProductProps } from '@/components/product/Product'
import { getStore, productData } from '@/lib/catalog'
import { href, isLang, t } from '@/lib/i18n'
import type { Media } from '@/payload-types'
import { siteUrl } from '@/lib/payments/config'
import { fmt, sum } from '@/lib/format'
import { meta } from '@/lib/seo'

type Props = { params: Promise<{ lang: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params
  if (!isLang(lang)) return {}
  const d = await productData(slug, lang)
  if (!d) return {}
  const price = Math.min(...d.variants.map((v) => v.price))
  return meta(lang, `/mahsulot/${slug}`, {
    title: d.pr.seoTitle || `${d.brand?.name ?? ''} ${d.pr.name}`.trim(),
    // the snippet carries what people search for: what it does + price
    description: d.pr.seoDescription || [d.pr.need ?? d.pr.summary, `${t(lang, 'Narxi')}: ${fmt(price)} ${sum(lang)}`].filter(Boolean).join(' · '),
    image: d.images[0]?.url,
  })
}

export default async function ProductPage({ params }: Props) {
  const { lang, slug } = await params
  if (!isLang(lang)) notFound()
  const [d, store] = await Promise.all([productData(slug, lang), getStore()])
  if (!d) notFound()
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const { pr } = d
  const cert = pr.certificate && typeof pr.certificate === 'object' ? (pr.certificate as Media).url ?? undefined : undefined
  const faq = (pr.faq ?? []).map((x) => ({ q: x.q, a: x.a }))
  const props: ProductProps = {
    lang, self: d.self, brand: { name: d.brand?.name ?? '', slug: d.brand?.slug ?? '' }, name: pr.name, summary: pr.summary ?? undefined,
    variants: d.variants, images: d.images, tags: d.self.tags, fit: (pr.fit ?? []).map((f) => ({ skin: f.skin, ok: f.ok ?? true, note: f.note })),
    skin: pr.skin ?? [], stats: d.stats, faqCount: faq.length,
    store: { tashkentPrice: store.tashkentPrice, regionPrice: store.regionPrice, regionDays: store.regionDays, orderCutoff: store.orderCutoff, returnDays: store.returnDays, freeDeliveryFrom: store.freeDeliveryFrom, telegramBotUrl: store.telegramBotUrl },
    batch: pr.batch ?? undefined, expiresAt: pr.expiresAt ?? undefined, certificateUrl: cert,
    info: { description: pr.description, ingredients: pr.ingredients, howTo: pr.howTo },
    pairs: d.pairs, backHref: d.cat ? `/katalog/${d.cat.slug}` : '/',
  }

  const site = siteUrl()
  const ld = [{
    '@context': 'https://schema.org', '@type': 'Product', name: `${d.brand?.name ?? ''} ${pr.name}`.trim(), sku: d.variants[0]?.sku,
    brand: d.brand ? { '@type': 'Brand', name: d.brand.name } : undefined, image: d.images.map((i) => site + i.url), description: pr.summary ?? undefined,
    offers: d.variants.map((v) => ({ '@type': 'Offer', sku: v.sku, price: v.price, priceCurrency: 'UZS', availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Organization', name: 'Yeppo' }, url: `${site}/${lang}/mahsulot/${slug}` })),
    // only real, verified reviews
    ...(d.stats ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: d.stats.avg.toFixed(1), reviewCount: d.stats.count } } : {}),
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [[tr('Bosh sahifa'), `/${lang}`], ...(d.cat ? [[d.cat.title, `/${lang}/katalog/${d.cat.slug}`]] : []), [pr.name, `/${lang}/mahsulot/${slug}`]]
      .map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: site + url })),
  }]

  return (
    <>
      <ProductPhone {...props} faq={faq} />
      <div className="wrap d-only" style={{ marginTop: '16px' }}>
        <nav aria-label={tr('Yoʻl')} className="muted" style={{ fontSize: '13px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link href={L('/')} style={{ color: '#6B5F59' }}>{tr('Bosh sahifa')}</Link><span>/</span>
          {d.cat && <><Link href={L(`/katalog/${d.cat.slug}`)} style={{ color: '#6B5F59' }}>{d.cat.title}</Link><span>/</span></>}
          {d.brand && <><Link href={L(`/brend/${d.brand.slug}`)} style={{ color: '#6B5F59' }}>{d.brand.name}</Link><span>/</span></>}
          <span style={{ color: '#2A211E' }}>{pr.name}</span>
        </nav>
        <ProductMain {...props} />
        <ProductInfo lang={lang} info={props.info} summary={props.summary} expertNote={pr.expertNote ?? undefined} certificateUrl={cert} batch={props.batch} />
        <Together lang={lang} items={[{ ...d.self }, ...d.pairs]} />
        <Reviews lang={lang} stats={d.stats} items={d.reviews.map((r) => ({ id: r.id, name: r.name, skin: r.skin, rating: r.rating, text: r.text }))} />
        <section id="qa" className="card pad-m" style={{ marginTop: '16px', padding: '28px' }} aria-labelledby="qa-h">
          <div className="sec-h" style={{ marginBottom: '10px' }}>
            <h2 id="qa-h" className="h" style={{ fontSize: '28px' }}>{tr('Savol-javob')}</h2>
            <a href={store.telegramUrl} className="pill line">{tr('Savol berish')}</a>
          </div>
          {faq.length === 0 && <p className="muted" style={{ margin: 0 }}>{tr('Hali savol yoʻq. Savolingizni Telegramda yozing — javob shu yerda chiqadi.')}</p>}
          {faq.map((x, i) => (
            <div key={i} style={{ borderBottom: i < faq.length - 1 ? '1px solid #EFE9E3' : 'none', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <b style={{ fontWeight: 600, fontSize: '15px' }}>{x.q}</b>
              <span style={{ display: 'flex', gap: '10px', fontSize: '15px', lineHeight: 1.55 }}><span className="chip" style={{ background: '#F2D6D0', flex: 'none' }}>Yeppo</span><span>{x.a}</span></span>
            </div>
          ))}
        </section>
        {d.similar.length > 0 && (
          <section style={{ marginTop: '32px' }} aria-labelledby="sim-h">
            <h2 id="sim-h" className="h" style={{ fontSize: '28px', marginBottom: '16px' }}>{tr('Bunga oʻxshash')}</h2>
            <div className="pgrid">{d.similar.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>
          </section>
        )}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
    </>
  )
}
