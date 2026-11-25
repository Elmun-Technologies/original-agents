import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'

import { loadChecklist } from '@/lib/readiness-load'
import { AdminPage } from './AdminPage'

export function ReadinessView(props: AdminViewServerProps) {
  return (
    <AdminPage props={props} title="Ishga tushirishga tayyorlik" lead="Sayt haqiqiy mijozlar va haqiqiy pul uchun ochilishidan oldin qilinadigan ishlar. Roʻyxat saytning hozirgi holatidan hisoblanadi: bajarilgani yashil boʻladi. Sizning qoʻlingizdagi ishlar tepada.">
      <Body />
    </AdminPage>
  )
}

const MARK = { ok: ['ok', '✓'], todo: ['bad', '!'], warn: ['todo', '!'], manual: ['todo', '?'] } as const

async function Body() {
  const r = await loadChecklist()
  const pct = r.total ? Math.round((r.done / r.total) * 100) : 100
  return (
    <>
      <div className="yp-card" style={{ marginBottom: 16 }}>
        <div className="yp-row" style={{ justifyContent: 'space-between' }}>
          <b style={{ fontSize: 18 }}>{r.done} / {r.total} majburiy ish tayyor</b>
          <span className={`yp-pill ${r.blockers ? 'bad' : 'on'}`}>{r.blockers ? `${r.blockers} ta toʻsiq bor` : 'Toʻsiq yoʻq'}</span>
        </div>
        <div className="yp-bar" style={{ height: 12 }}><i style={{ width: `${pct}%`, background: r.blockers ? '#a8475c' : '#2f7d32' }} /></div>
        <span className="yp-muted">«?» belgisi — tizim buni oʻzi tekshira olmaydi, siz tasdiqlashingiz kerak. Sariq «!» — tavsiya, toʻsiq emas.</span>
      </div>
      <ul className="yp-todo">
        {r.checks.map((c) => {
          const [cls, ch] = MARK[c.status]
          return (
            <li key={c.id} id={c.id}>
              <span className={`dot ${cls}`} aria-label={c.status}>{ch}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="yp-row" style={{ gap: 8 }}><b>{c.title}</b>{!c.must && <span className="yp-pill off" style={{ marginLeft: 0 }}>ixtiyoriy</span>}</div>
                <div className="yp-muted">{c.detail}</div>
                {c.status !== 'ok' && c.steps && (
                  <details style={{ marginTop: 6 }}><summary>Qanday qilinadi</summary><ol>{c.steps.map((s) => <li key={s}>{s}</li>)}</ol></details>
                )}
              </div>
              {c.link && c.status !== 'ok' && <Link href={c.link} className="yp-btn ghost" style={{ padding: '4px 12px', fontSize: 13, whiteSpace: 'nowrap' }}>Ochish</Link>}
            </li>
          )
        })}
      </ul>
    </>
  )
}
