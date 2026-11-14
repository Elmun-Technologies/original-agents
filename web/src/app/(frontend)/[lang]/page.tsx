// Home page — built in stage 1 from design/screens/Main.jpg. Stage 0: the hit grid only.
import { ProductCard } from '@/components/ProductCard'
import { findCards } from '@/lib/catalog'
import { isLang, t } from '@/lib/i18n'

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLang(lang)) return null
  const cards = await findCards(lang, {}, 10, 'createdAt')
  return (
    <section className="wrap" style={{ marginTop: '56px' }}>
      <div className="sec-h">
        <h2 className="h h2" style={{ fontSize: '44px' }}>{t(lang, 'Hozir eng koʻp')} <span className="serif">{t(lang, 'olinmoqda')}</span></h2>
      </div>
      <div className="pgrid">{cards.map((p) => <ProductCard key={p.slug} p={p} lang={lang} />)}</div>
    </section>
  )
}
