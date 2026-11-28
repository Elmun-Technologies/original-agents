// One place for page metadata: title, description, canonical + hreflang (uz/ru/x-default), Open Graph, Twitter.
// The domain comes from SITE_URL (layout metadataBase), so every URL here is a path.
import type { Metadata } from 'next'

import { t, type Lang } from '@/lib/i18n'

export const SITE_NAME = 'Yeppo'
export const DEFAULT_IMAGE = '/img/hero-dewy.jpg'

const clip = (s: string | null | undefined, n = 160) => {
  const v = (s ?? '').replace(/\s+/g, ' ').trim()
  return v.length > n ? `${v.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : v || undefined
}

export function meta(lang: Lang, path: string, o: {
  title: string // without the " — Yeppo" suffix
  description?: string | null
  image?: string | null
  noindex?: boolean // personal / transactional pages
  follow?: boolean
  type?: 'website' | 'article'
}): Metadata {
  const p = path === '/' ? '' : path
  const title = `${o.title} — ${SITE_NAME}`
  const description = clip(o.description ?? t(lang, 'Original koreys kosmetikasi Toshkentda: serumlar, kremlar, SPF va toʻplamlar. Har partiyaning hujjati bor, tez yetkazib beramiz.'))
  const images = [{ url: o.image || DEFAULT_IMAGE }]
  return {
    title,
    description,
    alternates: { canonical: `/${lang}${p}`, languages: { uz: `/uz${p}`, ru: `/ru${p}`, 'x-default': `/uz${p}` } },
    openGraph: { title, description, url: `/${lang}${p}`, siteName: SITE_NAME, locale: lang === 'ru' ? 'ru_RU' : 'uz_UZ', alternateLocale: lang === 'ru' ? 'uz_UZ' : 'ru_RU', type: o.type ?? 'website', images },
    twitter: { card: 'summary_large_image', title, description, images: images.map((i) => i.url) },
    // personal / transactional pages. The closed test site is handled once, in the [lang] layout (lib/site-state):
    // pages that set no robots of their own inherit its noindex.
    ...(o.noindex ? { robots: { index: false, follow: o.follow ?? false } } : {}),
  }
}
