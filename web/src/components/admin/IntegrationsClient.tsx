'use client'
import { useCallback, useEffect, useState } from 'react'

import { GROUPS, SERVICES, type ServiceDef, type Status } from '@/lib/integrations-def'

type Loaded = {
  siteUrl: string
  values: Record<string, string | boolean>
  sources: Record<string, 'admin' | 'env' | 'none'>
  unreadable: string[]
  status: Record<string, Status>
  closed: boolean
}
const LABEL: Record<Status, string> = { on: 'Ulangan', partial: 'Qisman toʻldirilgan', off: 'Ulanmagan' }

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <span className="yp-row" style={{ gap: 6 }}>
      <code>{text}</code>
      <button type="button" className="yp-btn ghost" style={{ padding: '2px 8px', fontSize: 12 }}
        onClick={() => { void navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) }}>{done ? 'Nusxalandi ✓' : 'Nusxa'}</button>
    </span>
  )
}

function Card({ s, data, reload }: { s: ServiceDef; data: Loaded; reload: () => void }) {
  const [draft, setDraft] = useState<Record<string, string | boolean>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const val = (k: string) => (k in draft ? draft[k] : data.values[k])
  const dirty = Object.keys(draft).length > 0
  const status = data.status[s.id]
  const call = async (url: string, init: RequestInit) => {
    setBusy(true); setMsg(null)
    try { return await (await fetch(url, { ...init, headers: { 'content-type': 'application/json' } })).json() } catch { return { ok: false, errors: ['Tarmoq xatosi'] } } finally { setBusy(false) }
  }
  const save = async (clear: string[] = []) => {
    const r = await call('/api/admin/integrations', { method: 'PATCH', body: JSON.stringify({ values: draft, clear }) })
    if (r.ok) { setDraft({}); setMsg({ kind: 'ok', text: 'Saqlandi.' }); reload() } else setMsg({ kind: 'err', text: (r.errors ?? ['Saqlab boʻlmadi']).join('\n') })
  }
  const test = async () => {
    const r = await call('/api/admin/integrations/test', { method: 'POST', body: JSON.stringify({ service: s.id }) })
    setMsg({ kind: r.ok ? 'ok' : 'err', text: r.message ?? 'Xato' })
  }
  const fromEnv = s.fields.some((f) => data.sources[f.key] === 'env')
  const lost = s.fields.filter((f) => data.unreadable.includes(f.key))
  return (
    <div className="yp-card" id={s.id}>
      <div className="yp-head">
        <img src={s.logo} alt="" width={36} height={36} />
        <b>{s.name}</b>
        <span className={`yp-pill ${s.id === 'mode' ? (data.values.paymentsMode === 'live' ? 'on' : 'partial') : status}`}>
          {s.id === 'mode' ? (data.values.paymentsMode === 'live' ? 'HAQIQIY' : 'Sinov') : LABEL[status]}
        </span>
      </div>
      <div className="yp-muted">{s.what}</div>
      {fromEnv && <div className="yp-msg warn">Bu qiymatlarning bir qismi serverning sozlamalaridan olinmoqda. Shu yerga kiritsangiz, shu yerdagisi ishlaydi.</div>}
      {lost.length > 0 && <div className="yp-msg err">Saqlangan kalit oʻqilmadi ({lost.map((f) => f.label).join(', ')}) — serverning maxfiy kaliti oʻzgargan. Qaytadan kiriting.</div>}
      {s.id === 'mode' && data.values.paymentsMode !== 'live' && <div className="yp-msg warn">Hozir sinov rejimi: mijoz haqiqiy toʻlov sahifasini koʻrmaydi, pul yechilmaydi.</div>}
      {s.fields.map((f) => (
        f.kind === 'checkbox' ? (
          <label key={f.key} className="check"><input type="checkbox" checked={val(f.key) === true} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.checked })} /> {f.label}</label>
        ) : f.kind === 'select' ? (
          <label key={f.key}>{f.label}
            <select value={String(val(f.key) || f.options?.[0].value)} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}>
              {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        ) : f.key === 'indexNowKey' ? (
          <label key={f.key}>{f.label}<Copy text={String(data.values.indexNowKey || '…')} /></label>
        ) : (
          <label key={f.key}>{f.label}
            <input type={f.kind === 'secret' ? 'password' : 'text'} autoComplete="off" spellCheck={false} placeholder={f.placeholder ?? ''}
              value={String(val(f.key) ?? '')} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              onFocus={(e) => { if (f.kind === 'secret' && String(data.values[f.key]).startsWith('•') && !(f.key in draft)) e.target.select() }} />
            {f.kind === 'secret' && String(data.values[f.key]).startsWith('•') && <span className="yp-muted">Saqlangan (shifrlangan). Oʻzgartirish uchun yangisini yozing, boʻsh qoldirsangiz oʻzgarmaydi.</span>}
          </label>
        )
      ))}
      {s.callbacks?.map((c) => (
        <div key={c.label} className="yp-muted">{c.label}:{' '}
          <Copy text={c.path === 'order_id' ? c.path : data.siteUrl + c.path.replace('{indexNowKey}', String(data.values.indexNowKey ?? ''))} />
        </div>
      ))}
      {s.id === 'mode' && data.closed && <div className="yp-msg warn">Sayt hozir parol bilan yopiq (test rejimi). Haqiqiy toʻlovlarga oʻtishdan oldin saytni ochish kerak.</div>}
      <div className="yp-row">
        <button type="button" className="yp-btn" disabled={busy || !dirty} onClick={() => save()}>Saqlash</button>
        {s.test && <button type="button" className="yp-btn ghost" disabled={busy || dirty} onClick={test} title={dirty ? 'Avval saqlang' : ''}>Tekshirish</button>}
        {s.fields.some((f) => f.kind === 'secret') && s.fields.filter((f) => f.kind === 'secret').some((f) => data.sources[f.key] === 'admin') && (
          <button type="button" className="yp-btn ghost" disabled={busy} onClick={() => { if (confirm('Saqlangan kalitlar oʻchirilsinmi?')) void save(s.fields.filter((f) => f.kind === 'secret').map((f) => f.key)) }}>Kalitni oʻchirish</button>
        )}
      </div>
      {msg && <div className={`yp-msg ${msg.kind}`}>{msg.text}</div>}
      <details>
        <summary>Qanday ulayman?</summary>
        <ol>{s.steps.map((x) => <li key={x}>{x}</li>)}</ol>
        <p className="yp-muted"><a href={s.where.url} target="_blank" rel="noreferrer">{s.where.label} ↗</a></p>
      </details>
    </div>
  )
}

export function IntegrationsClient() {
  const [data, setData] = useState<Loaded | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/integrations', { cache: 'no-store' })
      if (!r.ok) throw new Error(String(r.status))
      setData(await r.json())
    } catch { setErr('Yuklab boʻlmadi. Sahifani yangilang yoki qayta kiring.') }
  }, [])
  useEffect(() => { void load() }, [load])
  if (err) return <div className="yp-msg err">{err}</div>
  if (!data) return <p className="yp-muted">Yuklanmoqda…</p>
  return (
    <>
      {data.closed && <div className="yp-msg warn" style={{ marginBottom: 16 }}>Sayt hozir yopiq test rejimida: Google, Yandex va Meta kodlari sahifalarga qoʻyilmaydi va IndexNow ishlamaydi. Sayt ochilgach (parol olib tashlanganda) avtomatik ishga tushadi.</div>}
      {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
        <section key={g}>
          <h2 className="yp-h2">{GROUPS[g]}</h2>
          <div className="yp-grid">{SERVICES.filter((s) => s.group === g).map((s) => <Card key={s.id} s={s} data={data} reload={load} />)}</div>
        </section>
      ))}
    </>
  )
}
