'use client'
// Cart + favourites in the browser (until login: HANDOFF stage 2 moves them to the account).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { track } from '@/lib/track-client'

export type CardProduct = {
  slug: string
  sku: string
  brand: string
  name: string
  img: string
  vol?: string
  type?: string // shown instead of the rating until there are verified reviews
  price: number
  old?: number // real price within the last 30 days, else undefined
  rating?: number // only from verified reviews
  reviews?: number
  tags: { t: string; cls: string }[]
}

export type Line = { sku: string; slug: string; brand: string; name: string; img: string; vol?: string; price: number; qty: number }

type Shop = {
  lines: Line[]
  favs: string[]
  count: number
  total: number
  toast: { img: string; name: string } | null
  add: (p: CardProduct, qty?: number) => void
  setQty: (sku: string, qty: number) => void
  inCart: (sku: string) => boolean
  isFav: (slug: string) => boolean
  toggleFav: (slug: string) => void
  promo: string
  setPromo: (code: string) => void
  /** server says: these SKUs are gone / their price changed -> keep the browser copy in sync */
  sync: (priced: { sku: string; price: number; qty: number }[], missing: string[]) => void
  clear: () => void
}

const Ctx = createContext<Shop | null>(null)
const KEY = 'yeppo:shop:v1'

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<Line[]>([])
  const [favs, setFavs] = useState<string[]>([])
  const [toast, setToast] = useState<Shop['toast']>(null)
  const [promo, setPromo] = useState('')
  const loaded = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}')
      // read after mount on purpose: the server render has no localStorage (avoids a hydration mismatch)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(s.lines)) setLines(s.lines)
      if (Array.isArray(s.favs)) setFavs(s.favs)
      if (typeof s.promo === 'string') setPromo(s.promo)
    } catch {}
    loaded.current = true
  }, [])
  useEffect(() => {
    if (!loaded.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify({ lines, favs, promo }))
    } catch {}
  }, [lines, favs, promo])

  const add = useCallback((p: CardProduct, qty = 1) => {
    track('add_to_cart', location.pathname, { sku: p.sku, slug: p.slug, price: p.price, qty })
    setLines((ls) => {
      const i = ls.findIndex((l) => l.sku === p.sku)
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l))
      return [...ls, { sku: p.sku, slug: p.slug, brand: p.brand, name: p.name, img: p.img, vol: p.vol, price: p.price, qty }]
    })
    clearTimeout(timer.current)
    setToast({ img: p.img, name: `${p.brand} ${p.name}` })
    timer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const value = useMemo<Shop>(() => ({
    lines,
    favs,
    toast,
    count: lines.reduce((a, l) => a + l.qty, 0),
    total: lines.reduce((a, l) => a + l.qty * l.price, 0),
    add,
    setQty: (sku, qty) => setLines((ls) => (qty <= 0 ? ls.filter((l) => l.sku !== sku) : ls.map((l) => (l.sku === sku ? { ...l, qty } : l)))),
    inCart: (sku) => lines.some((l) => l.sku === sku),
    isFav: (slug) => favs.includes(slug),
    toggleFav: (slug) => setFavs((f) => (f.includes(slug) ? f.filter((x) => x !== slug) : [...f, slug])),
    promo,
    setPromo,
    sync: (priced, missing) => setLines((ls) => {
      const next = ls.filter((l) => !missing.includes(l.sku)).map((l) => {
        const p = priced.find((x) => x.sku === l.sku)
        return p && (p.price !== l.price || p.qty !== l.qty) ? { ...l, price: p.price, qty: p.qty } : l
      })
      return next.length === ls.length && next.every((l, i) => l === ls[i]) ? ls : next
    }),
    clear: () => { setLines([]); setPromo('') },
  }), [lines, favs, toast, add, promo])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useShop(): Shop {
  const s = useContext(Ctx)
  if (!s) throw new Error('useShop outside ShopProvider')
  return s
}
