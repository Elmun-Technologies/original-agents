import Link from 'next/link'

import { overview, previous, rangeOf, runner } from '@/lib/analytics'
import { abandonedOrders } from '@/lib/marketing'
import { loadChecklist } from '@/lib/readiness-load'
import { delta, int, som } from './fmt'
import './admin.css'

// The first thing the owner sees in the admin panel: today in numbers, what needs attention, shortcuts.
// Rendered by Payload only for a logged-in admin (it sits on the dashboard).
function Card({ label, value, d }: { label: string; value: string; d?: ReturnType<typeof delta> }) {
  return <div className="yp-card yp-kpi"><span>{label}</span><b>{value}</b>{d && d.dir !== 'flat' && <i className={d.dir === 'up' ? 'yp-up' : 'yp-down'}>{d.text} kechagiga nisbatan</i>}</div>
}

export async function DashboardWidget() {
  const run = await runner()
  const [today, yday, week, list, ready] = await Promise.all([
    overview(run, rangeOf('1')), overview(run, previous(rangeOf('1'))), overview(run, rangeOf('7')), abandonedOrders().catch(() => []), loadChecklist().catch(() => null),
  ])
  const left = list.filter((r) => r.link)
  return (
    <div className="yp" style={{ paddingBottom: 8 }}>
      <h1 className="yp-h1">Xush kelibsiz</h1>
      <div className="yp-grid kpi">
        <Card label="Bugun tashrifchilar" value={int(today.visitors)} d={delta(today.visitors, yday.visitors)} />
        <Card label="Bugun buyurtmalar (toʻlangan)" value={int(today.paid)} d={delta(today.paid, yday.paid)} />
        <Card label="Bugungi daromad" value={som(today.revenue)} d={delta(today.revenue, yday.revenue)} />
        <Card label="7 kunlik daromad" value={som(week.revenue)} />
      </div>
      <div className="yp-grid wide" style={{ marginTop: 14 }}>
        <div className="yp-card">
          <b className="yp-h3" style={{ margin: 0 }}>Eʼtibor kerak</b>
          {left.length > 0 && <div className="yp-msg warn">{left.length} ta buyurtma toʻlanmay turibdi, toʻlov havolasi hali ishlaydi. <Link href="/admin/marketing?tab=tashlab">Mijozga yozing →</Link></div>}
          {ready && ready.blockers > 0 && <div className="yp-msg warn">Sayt ochilishidan oldin {ready.blockers} ta ish qoldi ({ready.done}/{ready.total} tayyor). <Link href="/admin/tayyorlik">Roʻyxatni koʻrish →</Link></div>}
          {ready && ready.blockers === 0 && <div className="yp-msg ok">Majburiy ishlarning hammasi tayyor. <Link href="/admin/tayyorlik">Tekshirish →</Link></div>}
          {!left.length && !ready?.blockers && <span className="yp-muted">Hozircha hammasi joyida.</span>}
        </div>
        <div className="yp-card">
          <b className="yp-h3" style={{ margin: 0 }}>Tez oʻtish</b>
          <div className="yp-row">
            <Link className="yp-btn ghost" href="/admin/analitika">Analitika</Link>
            <Link className="yp-btn ghost" href="/admin/marketing">Marketing</Link>
            <Link className="yp-btn ghost" href="/admin/seo">SEO audit</Link>
            <Link className="yp-btn ghost" href="/admin/integratsiyalar">Integratsiyalar</Link>
            <Link className="yp-btn ghost" href="/admin/collections/orders">Buyurtmalar</Link>
            <Link className="yp-btn ghost" href="/admin/collections/products">Mahsulotlar</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
