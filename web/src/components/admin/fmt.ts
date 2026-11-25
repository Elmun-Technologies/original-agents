// Number formats for the admin screens (Uzbek reader: spaces between thousands).
const nf = new Intl.NumberFormat('ru-RU')
export const int = (n: number) => nf.format(Math.round(n)).replace(/ /g, ' ')
export const som = (n: number) => `${int(n)} soʻm`
export const pct = (r: number, digits = 1) => `${(r * 100).toFixed(digits).replace(/\.0+$/, '')}%`
export const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')} mln` : n >= 1000 ? `${Math.round(n / 1000)} ming` : String(Math.round(n)))
/** change against the previous period: "+12%" / "−5%" / "—" when there is nothing to compare */
export function delta(cur: number, prev: number): { text: string; dir: 'up' | 'down' | 'flat' } {
  if (!prev) return { text: cur ? 'yangi' : '—', dir: 'flat' }
  const d = (cur - prev) / prev
  if (Math.abs(d) < 0.005) return { text: '0%', dir: 'flat' }
  return { text: `${d > 0 ? '+' : '−'}${Math.round(Math.abs(d) * 100)}%`, dir: d > 0 ? 'up' : 'down' }
}
export const ago = (iso: string, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  return s < 60 ? `${s} soniya oldin` : s < 3600 ? `${Math.round(s / 60)} daqiqa oldin` : `${Math.round(s / 3600)} soat oldin`
}
