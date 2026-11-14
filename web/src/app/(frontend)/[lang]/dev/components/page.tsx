// Stage 0 check page (HANDOFF §9): shared components next to each other. Not linked from the site.
import { ProductCard } from '@/components/ProductCard'
import { Icon } from '@/components/icons'
import { findCards } from '@/lib/catalog'
import { isLang } from '@/lib/i18n'

export const metadata = { robots: { index: false } }

export default async function Components({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) return null
  const cards = await findCards(lang, {}, 10, 'createdAt')
  return (
    <div className="wrap" style={{ paddingTop: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <h1 className="h h1" style={{ fontSize: '56px' }}>Komponentlar <span className="serif">tekshiruvi</span></h1>
      <section style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="pill dark">Dark</button>
        <button className="pill">Line</button>
        <button className="pill line">Line soft</button>
        <button className="pill ghost">Ghost</button>
        <button className="pill soft">Soft</button>
        <button className="pill rose">Rose</button>
        <button className="pill" disabled>Disabled</button>
        <span className="chip tag-hit">Hit</span><span className="chip tag-new">Yangi</span><span className="chip tag-sale">−15%</span><span className="chip">Chip</span>
        <span className="eyebrow">Eyebrow</span>
        <button className="ib" aria-label="search"><Icon name="search" /></button>
      </section>
      <section className="pgrid" aria-label="ProductCard">
        {cards.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}
      </section>
    </div>
  )
}
