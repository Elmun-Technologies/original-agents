import { NextResponse, type NextRequest } from 'next/server'

// Remembers the language (HANDOFF §5.8): "/" -> the last chosen "/uz" | "/ru"; visiting a language saves it.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/') {
    const lang = req.cookies.get('lang')?.value === 'ru' ? 'ru' : 'uz'
    return NextResponse.redirect(new URL(`/${lang}`, req.url))
  }
  const lang = pathname.slice(1, 3)
  const res = NextResponse.next()
  if (req.cookies.get('lang')?.value !== lang) res.cookies.set('lang', lang, { path: '/', maxAge: 365 * 86400, sameSite: 'lax' })
  return res
}

export const config = { matcher: ['/', '/uz/:path*', '/ru/:path*', '/uz', '/ru'] }
