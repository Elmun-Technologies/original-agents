'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

type Click = { x: number; y: number; w: number; h: number; t: string }
type Heat = { views: number; clicks: Click[]; depth: { depth: number; count: number }[]; top: { t: string; count: number }[] }
const DEVICES: [string, string, number][] = [['desktop', 'Kompyuter', 1440], ['tablet', 'Planshet', 834], ['mobile', 'Telefon', 390]]
const RANGES: [string, string][] = [['7', '7 kun'], ['30', '30 kun'], ['90', '90 kun']]

/** classic heat colours: transparent → blue → green → yellow → red */
function palette() {
  const c = document.createElement('canvas'); c.width = 1; c.height = 256
  const g = c.getContext('2d')!, grad = g.createLinearGradient(0, 0, 0, 256)
  for (const [at, col] of [[0.25, 'rgba(0,80,255,0.55)'], [0.5, 'rgba(0,200,120,0.65)'], [0.75, 'rgba(255,220,0,0.75)'], [1, 'rgba(255,40,0,0.85)']] as [number, string][]) grad.addColorStop(at, col)
  g.fillStyle = grad; g.fillRect(0, 0, 1, 256)
  return g.getImageData(0, 0, 1, 256).data
}

export function HeatmapClient({ pages, initial }: { pages: { path: string; clicks: number }[]; initial: string }) {
  const [path, setPath] = useState(initial)
  const [device, setDevice] = useState('desktop')
  const [range, setRange] = useState('30')
  const [lang, setLang] = useState('uz')
  const [res, setRes] = useState<{ key: string; heat?: Heat; err?: boolean } | null>(null)
  const key = `${path}|${device}|${range}`
  const cur = res?.key === key ? res : null // an answer for an older choice is not shown
  const heat = cur?.heat ?? null
  const err = cur?.err ? 'Maʼlumotni yuklab boʻlmadi.' : ''
  const [docH, setDocH] = useState(1200)
  const frame = useRef<HTMLIFrameElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const width = DEVICES.find((d) => d[0] === device)![2]

  useEffect(() => {
    let alive = true
    fetch(`/api/admin/heat?path=${encodeURIComponent(path)}&device=${device}&r=${range}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('heat'))))
      .then((d) => { if (alive) setRes({ key, heat: d }) })
      .catch(() => { if (alive) setRes({ key, err: true }) })
    return () => { alive = false }
  }, [path, device, range, key])

  // fit the page into the screen
  useEffect(() => {
    const fit = () => setScale(Math.min(1, ((box.current?.clientWidth ?? width) - 2) / width))
    fit(); addEventListener('resize', fit)
    return () => removeEventListener('resize', fit)
  }, [width])

  const measure = useCallback(() => {
    const d = frame.current?.contentDocument
    if (d) setDocH(Math.max(600, d.documentElement.scrollHeight))
  }, [])
  useEffect(() => { const t = setInterval(measure, 1500); return () => clearInterval(t) }, [measure])

  // draw the clicks
  useEffect(() => {
    const cv = canvas.current
    if (!cv || !heat) return
    const k = 0.5, W = Math.round(width * k), H = Math.round(docH * k)
    cv.width = W; cv.height = H
    const g = cv.getContext('2d')!
    g.clearRect(0, 0, W, H)
    const off = document.createElement('canvas'); off.width = W; off.height = H
    const o = off.getContext('2d')!
    const R = Math.max(12, 30 * k * 1.4)
    for (const c of heat.clicks) {
      const x = c.x * W, y = c.y * k
      const grd = o.createRadialGradient(x, y, 0, x, y, R)
      grd.addColorStop(0, 'rgba(0,0,0,0.18)'); grd.addColorStop(1, 'rgba(0,0,0,0)')
      o.fillStyle = grd; o.fillRect(x - R, y - R, R * 2, R * 2)
    }
    const img = o.getImageData(0, 0, W, H), pal = palette()
    for (let i = 3; i < img.data.length; i += 4) {
      const a = img.data[i]
      if (!a) continue
      const j = Math.min(255, a * 2) * 4 // stronger alpha → hotter colour
      img.data[i - 3] = pal[j]; img.data[i - 2] = pal[j + 1]; img.data[i - 1] = pal[j + 2]; img.data[i] = pal[j + 3]
    }
    g.putImageData(img, 0, 0)
  }, [heat, docH, width])

  const total = heat?.depth.reduce((a, d) => a + d.count, 0) ?? 0
  const reach = (d: number) => (total ? (heat!.depth.filter((x) => x.depth >= d).reduce((a, x) => a + x.count, 0) / total) * 100 : 0)

  return (
    <>
      <div className="yp-row" style={{ marginBottom: 16 }}>
        <select aria-label="Sahifa" value={path} onChange={(e) => setPath(e.target.value)} style={{ maxWidth: 360 }}>
          {!pages.some((p) => p.path === path) && <option value={path}>{path}</option>}
          {pages.map((p) => <option key={p.path} value={p.path}>{p.path} — {p.clicks} bosish</option>)}
        </select>
        <div className="yp-tabs" style={{ margin: 0, border: 0 }} role="group" aria-label="Qurilma">
          {DEVICES.map(([k, l]) => <a key={k} href="#" className={k === device ? 'on' : ''} onClick={(e) => { e.preventDefault(); setDevice(k) }}>{l}</a>)}
        </div>
        <div className="yp-tabs" style={{ margin: 0, border: 0 }} role="group" aria-label="Davr">
          {RANGES.map(([k, l]) => <a key={k} href="#" className={k === range ? 'on' : ''} onClick={(e) => { e.preventDefault(); setRange(k) }}>{l}</a>)}
        </div>
        <div className="yp-tabs" style={{ margin: 0, border: 0 }} role="group" aria-label="Til">
          {['uz', 'ru'].map((k) => <a key={k} href="#" className={k === lang ? 'on' : ''} onClick={(e) => { e.preventDefault(); setLang(k) }}>{k.toUpperCase()}</a>)}
        </div>
      </div>
      {err && <div className="yp-msg err">{err}</div>}
      {heat && !heat.clicks.length && <div className="yp-msg warn">Bu sahifa, qurilma va davr uchun hali bosishlar yoʻq (koʻrishlar: {heat.views}). Boshqa qurilma yoki davrni tanlang.</div>}
      <div className="yp-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px', alignItems: 'start' }}>
        <div ref={box} className="yp-card pad0" style={{ overflow: 'hidden' }}>
          <div style={{ width: width * scale, height: docH * scale, position: 'relative' }}>
            <div style={{ width, height: docH, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', inset: 0 }}>
              <iframe ref={frame} title="Sahifa" src={`/${lang}${path === '/' ? '' : path}`} width={width} height={docH} onLoad={measure} style={{ border: 0, display: 'block', background: '#fff' }} />
              <canvas ref={canvas} aria-label="Bosishlar xaritasi" style={{ position: 'absolute', left: 0, top: 0, width, height: docH, pointerEvents: 'none' }} />
            </div>
          </div>
        </div>
        <aside className="yp-card">
          <b className="yp-h3" style={{ margin: 0 }}>Raqamlar</b>
          <div className="yp-row" style={{ justifyContent: 'space-between' }}><span>Sahifa koʻrishlar</span><b>{heat?.views ?? '…'}</b></div>
          <div className="yp-row" style={{ justifyContent: 'space-between' }}><span>Bosishlar</span><b>{heat?.clicks.length ?? '…'}</b></div>
          <b className="yp-h3" style={{ margin: '8px 0 0' }}>Qayergacha oʻqishadi</b>
          {[25, 50, 75, 100].map((d) => (
            <div key={d}><div className="yp-row" style={{ justifyContent: 'space-between', fontSize: 13 }}><span>{d}% gacha</span><b>{Math.round(reach(d))}%</b></div><div className="yp-bar"><i style={{ width: `${reach(d)}%` }} /></div></div>
          ))}
          <b className="yp-h3" style={{ margin: '8px 0 0' }}>Koʻp bosiladigan joylar</b>
          {heat?.top.map((t) => <div key={t.t} className="yp-row" style={{ justifyContent: 'space-between', fontSize: 13 }}><span style={{ wordBreak: 'break-all' }}>{t.t}</span><b>{t.count}</b></div>)}
          {heat && !heat.top.length && <span className="yp-muted">Maʼlumot yoʻq</span>}
          <span className="yp-muted">Qizil — eng koʻp bosilgan joy. Mijoz bosmayotgan muhim tugma yoki, aksincha, tugma boʻlmagan joyga koʻp bosilishi — dizayndagi muammo belgisi.</span>
        </aside>
      </div>
    </>
  )
}
