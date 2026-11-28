import { NextResponse, type NextRequest } from 'next/server'

import { resolveSite } from '@/lib/site-state-def'

// 1) Closed test site: every page asks for a password (HTTP Basic, user "yeppo", password SITE_PASSWORD) and tells
//    search engines not to index anything. Open or closed is decided in the admin panel (Sayt holati), read through
//    /api/site-state and kept for 10 s; when that cannot be read, the server environment decides (as before). /api stays open (payment callbacks, the agents; Payload access rules apply)
//    and robots.txt stays open so crawlers read "Disallow: /".
// 2) Remembers the language (HANDOFF §5.8): "/" -> the last chosen "/uz" | "/ru"; visiting a language saves it.
const OPEN = /^\/(api\/|robots\.txt$|indexnow\/)/

function sameText(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

function authorized(req: NextRequest, password: string) {
  const h = req.headers.get('authorization') ?? ''
  if (!h.startsWith('Basic ')) return false
  try {
    const [user, ...rest] = atob(h.slice(6)).split(':')
    return user === 'yeppo' && sameText(rest.join(':'), password)
  } catch {
    return false
  }
}

type Flags = { locked: boolean; noindex: boolean }
let flags: { at: number; v: Flags } | null = null
const TTL = 10_000
const fromEnv = (): Flags => resolveSite('env', true, process.env)

async function siteFlags(req: NextRequest): Promise<Flags> {
  if (flags && Date.now() - flags.at < TTL) return flags.v
  let v = fromEnv()
  // the site itself, inside the container (no round trip through the internet); the request's own origin as a fallback
  for (const base of [`http://127.0.0.1:${process.env.PORT || 3000}`, req.nextUrl.origin]) {
    try {
      const r = await fetch(`${base}/api/site-state`, { cache: 'no-store', signal: AbortSignal.timeout(2_000) })
      if (r.ok) { const j = await r.json(); v = { locked: !!j.locked, noindex: !!j.noindex }; break }
    } catch { /* try the next address */ }
  }
  flags = { at: Date.now(), v }
  return v
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  // /api and the IndexNow key never need the state (and /api/site-state must not ask itself)
  const site = OPEN.test(pathname) && pathname !== '/robots.txt' ? fromEnv() : await siteFlags(req)
  const password = site.locked ? process.env.SITE_PASSWORD : undefined
  if (password && !OPEN.test(pathname) && !authorized(req, password)) {
    return new NextResponse('Yeppo — test sayt. / Тестовый сайт.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Yeppo test", charset="UTF-8"', 'X-Robots-Tag': 'noindex, nofollow' },
    })
  }
  let res: NextResponse
  if (pathname === '/') {
    const lang = req.cookies.get('lang')?.value === 'ru' ? 'ru' : 'uz'
    res = NextResponse.redirect(new URL(`/${lang}`, req.url))
  } else {
    res = NextResponse.next()
    const lang = pathname.slice(1, 3)
    if ((lang === 'uz' || lang === 'ru') && (pathname.length === 3 || pathname[3] === '/') && req.cookies.get('lang')?.value !== lang) {
      res.cookies.set('lang', lang, { path: '/', maxAge: 365 * 86400, sameSite: 'lax' })
    }
  }
  if (site.noindex) res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] }
