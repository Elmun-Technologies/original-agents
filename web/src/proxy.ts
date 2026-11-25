import { NextResponse, type NextRequest } from 'next/server'

// 1) Closed test site (SITE_PASSWORD set): every page asks for a password (HTTP Basic, user "yeppo") and tells
//    search engines not to index anything. /api stays open (payment callbacks, the agents; Payload access rules apply)
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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const password = process.env.SITE_PASSWORD
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
  if (process.env.SITE_NOINDEX === '1' || password) res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] }
