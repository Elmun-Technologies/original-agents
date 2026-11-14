// Catalog — design/screens/Catalog.jpg (+ Catalog.ru, TabletCatalog, MobileCatalog).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CatalogShell, PhoneCatalogTop, SkinBar } from '@/components/catalog/Controls'
import { Icon } from '@/components/icons'
import { ProductCard } from '@/components/ProductCard'
import { RecentlyViewed } from '@/components/Recent'
import { catalogData } from '@/lib/catalog'
import { applyFilters, parseFilters } from '@/lib/filters'
import { href, isLang, t, tn } from '@/lib/i18n'

// reads searchParams on every request (the layout is ISR otherwise)
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { lang, slug } = await params
  if (!isLang(lang)) return {}
  const data = await catalogData(slug, lang)
  if (!data) return {}
  const filtered = Object.keys(await searchParams).length > 0
  return {
    title: `${data.cat.title} — Yeppo`,
    description: data.cat.seoText?.slice(0, 160),
    alternates: { canonical: `/${lang}/katalog/${slug}`, languages: { uz: `/uz/katalog/${slug}`, ru: `/ru/katalog/${slug}` } },
    // filter combinations are for people, the plain category page is for search engines
    robots: filtered ? { index: false, follow: true } : undefined,
  }
}

export default async function Catalog({ params, searchParams }: Props) {
  const { lang, slug } = await params
  if (!isLang(lang)) notFound()
  const data = await catalogData(slug, lang)
  if (!data) notFound()
  const tr = (s: string) => t(lang, s)
  const L = (p: string) => href(lang, p)
  const f = parseFilters(await searchParams)
  const list = applyFilters(data.items, f)
  const shown = list.slice(0, f.n)
  const parent = data.parent

  const pill = (on: boolean) => ({ className: on ? 'pill dark' : 'pill ghost', style: { minHeight: '44px', flex: 'none', gap: '8px', paddingLeft: '6px' } as const })
  const thumb = (src?: string) => (src ? <img src={src} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} /> : null)

  return (
    <>
      <PhoneCatalogTop lang={lang} title={data.cat.title} total={list.length} back={parent ? `/${parent.slug}` : '/'} />
      <div className="m-only" style={{ padding: '10px 16px 0', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {shown.map((p) => <ProductCard key={p.slug} p={p} lang={lang} compact />)}
        </div>
        <Link href={L('/maslahatchi')} style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center', padding: '14px', borderRadius: '20px', background: '#F2D6D0', textDecoration: 'none', fontSize: '13px' }}>
          <Icon name="spark" size={18} /><span style={{ flex: 1 }}>{tr('Qaysi biri sizga — aniq aytib beraman')}</span><Icon name="right" size={18} />
        </Link>
      </div>

      <div className="wrap d-only" style={{ marginTop: '16px' }}>
        <nav aria-label={tr('Yoʻl')} className="muted" style={{ fontSize: '13px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link href={L('/')} style={{ color: '#6B5F59' }}>{tr('Bosh sahifa')}</Link><span>/</span>
          {parent && <><Link href={L(`/${parent.slug}`)} style={{ color: '#6B5F59' }}>{parent.title}</Link><span>/</span></>}
          <span style={{ color: '#2A211E' }}>{data.cat.title}</span>
        </nav>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginTop: '10px' }}>
          <h1 className="h h1" style={{ fontSize: '44px' }}>{data.cat.title} <span className="muted" style={{ font: '500 18px Inter, sans-serif', letterSpacing: 0 }}>{tn(lang, '[N] ta mahsulot', data.items.length)}</span></h1>
        </div>
        {(data.subs.length > 0 || data.siblings.length > 0) && (
          <div className="hs" style={{ marginTop: '16px' }}>
            <Link href={L(`/katalog/${slug}`)} {...pill(!f.type)}>{thumb(data.allImg)}{tr('Hammasi')}</Link>
            {data.subs.map((s) => <Link key={s.href} href={L(s.href)} {...pill(f.type === s.type)}>{thumb(s.img)}{tr(s.label)}</Link>)}
            {data.siblings.map((s) => <Link key={s.href} href={L(s.href)} {...pill(false)}>{thumb(s.img)}{s.label}</Link>)}
          </div>
        )}
        <SkinBar lang={lang} />
        <CatalogShell lang={lang} brands={data.brands} priceMin={data.priceMin} priceMax={data.priceMax} total={list.length}>
          {shown.length > 0 && (
            <div className="pgrid" style={{ gridAutoFlow: 'dense' }}>
              {shown.slice(0, 3).map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}
              {shown.length > 3 && (
                <Link href={L('/maslahatchi')} className="card zoom" style={{ gridColumn: 'span 2', minHeight: '380px', textDecoration: 'none', background: '#2A211E', color: '#FBFAF7', borderRadius: '20px' }}>
                  <img src="/img/face-white.jpg" alt="" style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }} />
                  <span style={{ position: 'relative', width: '54%', height: '100%', padding: '28px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px', minHeight: '380px' }}>
                    <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', color: '#F2D6D0', fontSize: '13px' }}><Icon name="spark" size={15} /> {tr('AI maslahatchi')}</span>
                    <span className="h" style={{ fontSize: '30px', lineHeight: 1.1 }}>{tr('Serumlar koʻp, teringiz bitta. Qaysi biri sizniki — 1 daqiqada aytib beraman.')}</span>
                    <span className="pill" style={{ background: '#F2D6D0', borderColor: '#F2D6D0', color: '#2A211E', alignSelf: 'flex-start' }}>{tr('Suhbatni boshlash')}</span>
                  </span>
                </Link>
              )}
              {shown.slice(3).map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}
            </div>
          )}
        </CatalogShell>
        <RecentlyViewed lang={lang} />
        {data.cat.seoText && (
          <section className="card pad-m" style={{ marginTop: '32px', padding: '32px' }} aria-labelledby="seo-h">
            <h2 id="seo-h" className="h" style={{ fontSize: '26px' }}>{data.cat.seoTitle || data.cat.title}</h2>
            <p className="muted" style={{ lineHeight: 1.7, fontSize: '15px', maxWidth: '880px', margin: '12px 0 0' }}>{data.cat.seoText}</p>
          </section>
        )}
      </div>
    </>
  )
}
