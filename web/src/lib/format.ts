import type { Lang } from './i18n'

/** 245000 -> "245 000" (design format, thin groups with a normal space). */
export const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export const sum = (lang: Lang) => (lang === 'ru' ? 'сум' : 'soʻm')
/** Time helpers kept out of components (React's purity lint flags Date.now in render bodies). */
export const nowMs = () => Date.now()
export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)
