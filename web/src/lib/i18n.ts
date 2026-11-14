import ru from '@/i18n/ru.json'

export const LANGS = ['uz', 'ru'] as const
export type Lang = (typeof LANGS)[number]

const RU = ru as Record<string, string>

/** Design text is Uzbek; Russian comes from the design's dictionary (data/ru.json). Missing -> Uzbek. */
export function t(lang: Lang, uz: string): string {
  return lang === 'ru' ? (RU[uz] ?? uz) : uz
}

export const isLang = (x: string): x is Lang => (LANGS as readonly string[]).includes(x)

/** '/katalog/serum' -> '/ru/katalog/serum' */
export const href = (lang: Lang, path: string) => `/${lang}${path === '/' ? '' : path}`
