// "Kim uchun" — design/screens/Segment.jpg. Products flagged "not for" this group never appear (HANDOFF §5.2).
import { notFound } from 'next/navigation'

import { SegmentPage } from '@/components/pages/Segment'
import { payload, toCards } from '@/lib/catalog'
import { isLang } from '@/lib/i18n'
import type { Media, Product } from '@/payload-types'

type Props = { params: Promise<{ lang: string; segment: string }> }

async function segments(lang: 'uz' | 'ru') {
  return (await payload()).find({ collection: 'segments', sort: 'order', locale: lang, depth: 2, limit: 50, pagination: false })
}

export async function generateMetadata({ params }: Props) {
  const { lang, segment } = await params
  if (!isLang(lang)) return {}
  const s = (await segments(lang)).docs.find((d) => d.slug === segment)
  return s ? { title: `${s.title} — Yeppo`, description: s.say ?? undefined, alternates: { canonical: `/${lang}/kim-uchun/${segment}` } } : {}
}

export default async function Page({ params }: Props) {
  const { lang, segment } = await params
  if (!isLang(lang)) notFound()
  const all = await segments(lang)
  const s = all.docs.find((d) => d.slug === segment)
  if (!s) notFound()
  const exclude = s.exclude ?? []
  const ok = (p: Product) => !(p.notFor ?? []).some((x) => exclude.includes(x))
  const setProducts = (s.set ?? []).map((x) => x.product).filter((x): x is Product => typeof x === 'object' && ok(x))
  const gridProducts = (s.grid ?? []).filter((x): x is Product => typeof x === 'object' && ok(x))
  const [setCards, gridCards] = await Promise.all([toCards(setProducts, lang), toCards(gridProducts, lang)])
  return (
    <SegmentPage lang={lang}
      tabs={all.docs.map((d) => ({ slug: d.slug, title: d.title, img: (d.image as Media | null)?.url ?? undefined, pos: d.imagePos ?? undefined }))}
      seg={{
        slug: s.slug, title: s.title, tag: s.tag ?? undefined, img: (s.image as Media | null)?.url ?? undefined, pos: s.imagePos ?? undefined,
        h1: s.h1, say: s.say ?? undefined, setName: s.setName ?? undefined, setWhy: s.setWhy ?? undefined,
        set: (s.set ?? []).filter((x) => typeof x.product === 'object' && ok(x.product as Product))
          .map((x, i) => ({ step: x.step ?? undefined, why: x.why ?? undefined, p: setCards[i] })).filter((x) => x.p),
        gridTitle: s.gridTitle ?? undefined, grid: gridCards, avoid: (s.avoid ?? []).map((a) => a.text), faq: (s.faq ?? []).map((f) => ({ q: f.q, a: f.a })),
      }} />
  )
}
