'use client'
import { useState } from 'react'

export function CopyButton({ text, label = 'Nusxa olish', done = 'Nusxalandi ✓' }: { text: string; label?: string; done?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" className="yp-btn ghost" style={{ padding: '4px 10px', fontSize: 13 }}
      onClick={() => { void navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1600) }}>{ok ? done : label}</button>
  )
}
