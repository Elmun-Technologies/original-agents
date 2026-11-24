'use client'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { flush, start, track } from '@/lib/track-client'

declare global { interface Window { __ymId?: string; ym?: (id: string, ev: string, url: string) => void } }

const label = (el: Element | null) => {
  const t = el?.closest('a,button,[role=button],summary,label')
  if (!t) return ''
  const tag = t.tagName.toLowerCase()
  if (tag === 'a') { try { return `a:${new URL((t as HTMLAnchorElement).href).pathname}`.slice(0, 40) } catch { return 'a' } }
  return `${tag}:${(t.getAttribute('aria-label') || t.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)}`
}

export function Tracker() {
  const path = usePathname()

  // page views (also for in-app navigation), scroll depth of the page just left, clicks on the current page
  useEffect(() => {
    start()
    track('pageview', path)
    if (window.__ymId && window.ym && history.length > 1) window.ym(window.__ymId, 'hit', path) // Yandex Metrika: in-app navigation
    let depth = 0, clicks = 0
    const onScroll = () => {
      const h = document.documentElement.scrollHeight
      depth = Math.max(depth, Math.min(100, Math.round(((scrollY + innerHeight) / h) * 100 / 5) * 5))
    }
    const onClick = (e: MouseEvent) => {
      if (clicks++ >= 40) return
      track('click', path, { x: e.clientX / innerWidth, y: e.pageY, w: innerWidth, h: document.documentElement.scrollHeight, t: label(e.target as Element) })
    }
    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('click', onClick, { capture: true, passive: true })
    return () => {
      removeEventListener('scroll', onScroll)
      document.removeEventListener('click', onClick, { capture: true })
      track('scroll', path, { depth })
    }
  }, [path])

  // page speed of the first load: LCP, CLS, INP
  useEffect(() => {
    if (!('PerformanceObserver' in window)) return
    const first = location.pathname
    let lcp = 0, cls = 0, inp = 0
    const watch = (type: string, fn: (e: PerformanceEntry & Record<string, number | boolean>) => void, extra: object = {}) => {
      try { const o = new PerformanceObserver((l) => l.getEntries().forEach((e) => fn(e as never))); o.observe({ type, buffered: true, ...extra } as PerformanceObserverInit); return o } catch { return null }
    }
    watch('largest-contentful-paint', (e) => { lcp = e.startTime })
    watch('layout-shift', (e) => { if (!e.hadRecentInput) cls += e.value as number })
    watch('event', (e) => { if (e.interactionId) inp = Math.max(inp, e.duration) }, { durationThreshold: 40 })
    let sent = false
    const send = () => {
      if (sent || document.visibilityState !== 'hidden') return
      sent = true
      track('vitals', first, { ...(lcp ? { lcp } : {}), cls, ...(inp ? { inp } : {}) })
      flush()
    }
    document.addEventListener('visibilitychange', send)
    return () => document.removeEventListener('visibilitychange', send)
  }, [])

  return null
}
