import 'server-only'

import { isSiteClosed } from '@/lib/site-state'
import { integrations } from '@/lib/integrations'
import { siteUrl } from '@/lib/site'

// IndexNow: tells Yandex and Bing the moment a page is added or changed, instead of waiting for their crawler.
// Works only when the owner switched it on (Integratsiyalar), the site is open and has a real https address.
// Calls are collected for a few seconds and sent as one request.

/** the public URLs (both languages) of the given language-free paths */
export function indexNowUrls(site: string, paths: string[]): string[] {
  const out = new Set<string>()
  for (const p of paths) for (const l of ['uz', 'ru']) out.add(`${site}/${l}${p === '/' ? '' : p}`)
  return [...out].slice(0, 100)
}

export async function submitIndexNow(paths: string[], fetchFn: typeof fetch = fetch): Promise<{ sent: boolean; reason?: string }> {
  const v = await integrations()
  const site = siteUrl()
  if (v.indexNowOn !== true) return { sent: false, reason: 'off' }
  if (!v.indexNowKey || !/^[a-f0-9]{16,64}$/.test(String(v.indexNowKey))) return { sent: false, reason: 'no key' }
  if ((await isSiteClosed()) || !site.startsWith('https://') || /localhost|127\.0\.0\.1/.test(site)) return { sent: false, reason: 'site not public' }
  const key = String(v.indexNowKey)
  try {
    const r = await fetchFn('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/indexnow/${key}`, urlList: indexNowUrls(site, paths) }),
    })
    if (!r.ok && r.status !== 202) console.warn('indexnow: refused', r.status)
    return { sent: r.ok || r.status === 202 }
  } catch (e) {
    console.warn('indexnow: not sent —', (e as Error).name)
    return { sent: false, reason: 'network' }
  }
}

let pending = new Set<string>()
let timer: ReturnType<typeof setTimeout> | undefined
/** called from the admin hooks after a product/article/brand changes */
export function notifyChanged(path: string) {
  pending.add(path)
  clearTimeout(timer)
  timer = setTimeout(() => { const batch = [...pending]; pending = new Set(); void submitIndexNow(batch) }, 5000)
}
