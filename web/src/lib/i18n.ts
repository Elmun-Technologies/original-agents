import ru from '@/i18n/ru.json'
import extra from '@/i18n/ru.extra.json' // texts added for the site (not in the design dictionary)

export const LANGS = ['uz', 'ru'] as const
export type Lang = (typeof LANGS)[number]

const RU = { ...(ru as Record<string, string>), ...(extra as Record<string, string>) }

/** Design text is Uzbek; Russian comes from the design's dictionary (data/ru.json). Missing -> Uzbek. */
export function t(lang: Lang, uz: string): string {
  return lang === 'ru' ? (RU[uz] ?? uz) : uz
}

export const isLang = (x: string): x is Lang => (LANGS as readonly string[]).includes(x)

/** '/katalog/serum' -> '/ru/katalog/serum' */
export const href = (lang: Lang, path: string) => `/${lang}${path === '/' ? '' : path}`

const rules = new Intl.PluralRules('ru')

/** Minimal ICU plural: "{n1, plural, one {# день} few {# дня} many {# дней} other {# дня}}" (# = the number).
 * A range like "2–4" takes its form from the last number. */
export function icu(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+), plural,((?:\s*\w+\s*\{[^{}]*\})+)\s*\}/g, (_, name: string, body: string) => {
    const v = String(vars[name] ?? '')
    const last = Number((v.match(/\d+(?!.*\d)/) ?? ['0'])[0])
    const forms = Object.fromEntries([...body.matchAll(/(\w+)\s*\{([^{}]*)\}/g)].map((m) => [m[1], m[2]]))
    return (forms[rules.select(last)] ?? forms.other ?? '').replace(/#/g, v)
  }).replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) // plain {n1}
}

/** Translate a text with numbers: Uzbek "[N]" placeholders are filled in order (n1, n2 …);
 * Russian uses ICU plural forms from the dictionary (Uzbek nouns do not change with numbers). */
export function tn(lang: Lang, uz: string, ...nums: (string | number)[]): string {
  const vars = Object.fromEntries(nums.map((n, i) => [`n${i + 1}`, typeof n === 'number' ? n.toLocaleString('ru-RU').replace(/\u00a0/g, ' ') : n]))
  let i = 0
  const filled = t(lang, uz).replace(/\[N\]/g, () => String(vars[`n${++i}`] ?? '[N]'))
  return icu(filled, vars)
}
