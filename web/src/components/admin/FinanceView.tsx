import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'

import { runner } from '@/lib/analytics'
import { daysOf, financeReport, lastMonths, type Line } from '@/lib/finance'
import { AdminPage } from './AdminPage'
import { int, som } from './fmt'

// Admin → Moliya hisoboti: kirim (customers paid), chiqim (cost of goods, fees, expenses), qoldi. Months, or the days
// of one month. Written for someone who is not an accountant: every line says where its number comes from.
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const neg = (n: number) => (n < 0 ? 'yp-down' : undefined)

export function FinanceView(props: AdminViewServerProps) {
  const m = one(props.searchParams?.m) ?? ''
  const month = /^\d{4}-\d{2}$/.test(m) ? m : ''
  return (
    <AdminPage props={props} title="Moliya hisoboti" lead="Mijozlar toʻlagan pul (kirim), doʻkon sarflagan pul (chiqim) va ularning farqi (qoldi). Kirim — toʻlangan buyurtmalardan avtomatik. Chiqim — sotilgan tovar tannarxi, toʻlov komissiyasi va siz «Xarajatlar» ga yozgan xarajatlar.">
      <Body month={month} />
    </AdminPage>
  )
}

function Table({ title, lines, total, totalLabel, cols }: { title: string; lines: Line[]; total: number[]; totalLabel: string; cols: number }) {
  return (
    <>
      <tr><th colSpan={cols + 1} style={{ paddingTop: 16, fontSize: 13, color: 'var(--theme-text)' }}>{title}</th></tr>
      {lines.map((l) => (
        <tr key={l.id}><td>{l.label}{l.hint && <div className="yp-muted">{l.hint}</div>}</td>{l.values.map((v, i) => <td key={i} className={`n ${neg(v) ?? ''}`}>{v ? int(v) : '—'}</td>)}</tr>
      ))}
      <tr><td><b>{totalLabel}</b></td>{total.map((v, i) => <td key={i} className="n"><b>{int(v)}</b></td>)}</tr>
    </>
  )
}

async function Body({ month }: { month: string }) {
  const months = lastMonths(6)
  const periods = month ? daysOf(month) : months
  if (!periods.length) return <div className="yp-msg warn">Bu oy hali boshlanmagan.</div>
  const r = await financeReport(await runner(), periods)
  const all = lastMonths(12)
  const last = r.periods.length - 1
  return (
    <>
      <nav className="yp-tabs" aria-label="Davr">
        <Link href="/admin/moliya" className={!month ? 'on' : ''}>Oxirgi 6 oy</Link>
        {all.slice(-4).reverse().map((p) => <Link key={p.key} href={`/admin/moliya?m=${p.key}`} className={month === p.key ? 'on' : ''}>{p.label} (kunlar)</Link>)}
      </nav>
      <div className="yp-grid kpi" style={{ marginBottom: 16 }}>
        <div className="yp-card yp-kpi"><span>Kirim · {month ? 'shu oy' : r.periods[last].label}</span><b>{som(month ? r.incomeTotal.reduce((a, v) => a + v, 0) : r.incomeTotal[last])}</b></div>
        <div className="yp-card yp-kpi"><span>Chiqim · {month ? 'shu oy' : r.periods[last].label}</span><b>{som(month ? r.expenseTotal.reduce((a, v) => a + v, 0) : r.expenseTotal[last])}</b></div>
        <div className="yp-card yp-kpi"><span>Qoldi · {month ? 'shu oy' : r.periods[last].label}</span><b className={neg(month ? r.left.reduce((a, v) => a + v, 0) : r.left[last])}>{som(month ? r.left.reduce((a, v) => a + v, 0) : r.left[last])}</b></div>
      </div>
      {r.noCost.items > 0 && <div className="yp-msg warn" style={{ marginBottom: 8 }}>{int(r.noCost.items)} dona sotilgan tovarning tannarxi kiritilmagan ({som(r.noCost.revenue)} lik savdo). Ular uchun chiqim 0 deb olindi, shuning uchun «Qoldi» haqiqatdan koʻp chiqadi. Mahsulotlar → hajm → «Tannarx» ni toʻldiring.</div>}
      {r.feeMissing && <div className="yp-msg warn" style={{ marginBottom: 8 }}>Click yoki Payme komissiya foizi kiritilmagan, shuning uchun komissiya hisoblanmadi. <Link href="/admin/globals/finance">Moliya sozlamalari</Link></div>}
      <div className="yp-row" style={{ margin: '8px 0 16px' }}>
        <Link className="yp-btn" href="/admin/collections/expenses/create">+ Xarajat qoʻshish</Link>
        <Link className="yp-btn ghost" href="/admin/collections/expenses">Xarajatlar roʻyxati</Link>
        <a className="yp-btn ghost" href={`/api/admin/finance${month ? `?m=${month}` : ''}`}>Excel’ga yuklab olish</a>
        <Link className="yp-btn ghost" href="/admin/globals/finance">Komissiya foizlari</Link>
      </div>
      <div className="yp-card pad0" style={{ overflowX: 'auto' }}>
        <table className="yp-table">
          <thead><tr><th>soʻmda</th>{r.periods.map((p) => <th key={p.key} className="n">{p.label}</th>)}</tr></thead>
          <tbody>
            <Table title="KIRIM" lines={r.income} total={r.incomeTotal} totalLabel="Kirim jami" cols={r.periods.length} />
            <Table title="CHIQIM" lines={r.expense} total={r.expenseTotal} totalLabel="Chiqim jami" cols={r.periods.length} />
            <tr><td style={{ paddingTop: 14 }}><b>QOLDI (kirim − chiqim)</b></td>{r.left.map((v, i) => <td key={i} className={`n ${neg(v) ?? ''}`} style={{ paddingTop: 14 }}><b>{int(v)}</b></td>)}</tr>
          </tbody>
        </table>
      </div>
      <h2 className="yp-h2">Reklama manbalari: sarflangan va kelgan pul</h2>
      <p className="yp-muted" style={{ marginTop: -4 }}>Xarajat — «Xarajatlar» da «Reklama» turi va manbasi bilan yozilgan summa. Kelgan pul — shu manbadan kelgan mijozlarning toʻlangan buyurtmalari (havola yasagichdagi manba boʻyicha). «sayt» — manbasiz kelganlar.</p>
      <div className="yp-card pad0">
        <table className="yp-table">
          <thead><tr><th>Manba</th><th className="n">Reklamaga sarflandi</th><th className="n">Shu manbadan kelgan pul</th><th className="n">Buyurtmalar</th></tr></thead>
          <tbody>
            {r.channels.map((c) => <tr key={c.channel}><td>{c.channel}</td><td className="n">{c.spent ? int(c.spent) : '—'}</td><td className="n">{c.revenue ? int(c.revenue) : '—'}</td><td className="n">{int(c.orders)}</td></tr>)}
            {!r.channels.length && <tr><td colSpan={4}><div className="yp-muted">Bu davrda maʼlumot yoʻq.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
