'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const REASON: Record<string, string> = { off: 'Ikkala eslatma ham oʻchiq. Avval sozlamalarda yoqing.', busy: 'Tekshiruv hozir ketyapti, birozdan keyin qayta bosing.', error: 'Xatolik yuz berdi, birozdan keyin qayta urinib koʻring.' }

export function RunRemindersButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const run = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await (await fetch('/api/admin/reminders', { method: 'POST' })).json()
      if (!r.checked) setMsg({ ok: false, text: REASON[r.reason] ?? 'Tekshirilmadi.' })
      else setMsg({ ok: true, text: `Tayyor: ${r.sent} ta yuborildi, ${r.failed} ta yuborilmadi, ${r.skipped} ta oʻtkazib yuborildi (kanal yoʻq).` })
      router.refresh()
    } catch { setMsg({ ok: false, text: 'Internet bilan bogʻlanib boʻlmadi.' }) } finally { setBusy(false) }
  }
  return (
    <div className="yp-row">
      <button type="button" className="yp-btn" disabled={busy} onClick={run}>{busy ? 'Tekshirilmoqda…' : 'Hozir tekshirish va yuborish'}</button>
      {msg && <span className={`yp-msg ${msg.ok ? 'ok' : 'warn'}`}>{msg.text}</span>}
    </div>
  )
}
