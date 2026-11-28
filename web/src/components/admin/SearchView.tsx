import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'

import { cached, googleStats, yandexStats, type QueryRow } from '@/lib/search-stats'
import { siteUrl } from '@/lib/site'
import { AdminPage } from './AdminPage'
import { Bars } from './charts'
import { int } from './fmt'

// Admin → Qidiruv tizimlari: what people typed in Google and Yandex, how often the site was shown and clicked.
const RANGES: Record<string, string> = { '7': '7 kun', '28': '28 kun', '90': '90 kun' }
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function SearchView(props: AdminViewServerProps) {
  const sp = props.searchParams ?? {}
  const src = one(sp.s) === 'yandex' ? 'yandex' : 'google'
  const rk = (one(sp.r) ?? '28') in RANGES ? one(sp.r)! : '28'
  const href = (s: string, r = rk) => `/admin/qidiruv?s=${s}&r=${r}`
  return (
    <AdminPage props={props} title="Qidiruv tizimlari" lead="Odamlar Google va Yandex’da nimani yozib saytingizni topgani: necha marta koʻrsatilgan, necha marta bosilgan va nechanchi oʻrinda turibsiz. Raqamlar 2–3 kun kechikib keladi (qidiruv tizimlarining oʻzi shunday).">
      <div className="yp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <nav className="yp-tabs" aria-label="Qidiruv tizimi" style={{ flex: 1 }}>
          <Link href={href('google')} className={src === 'google' ? 'on' : ''}>Google</Link>
          <Link href={href('yandex')} className={src === 'yandex' ? 'on' : ''}>Yandex</Link>
        </nav>
        <nav className="yp-tabs" aria-label="Davr">
          {Object.entries(RANGES).map(([k, l]) => <Link key={k} href={href(src, k)} className={k === rk ? 'on' : ''}>{l}</Link>)}
        </nav>
      </div>
      {src === 'google' ? <Google days={Number(rk)} /> : <Yandex days={Number(rk)} />}
      <Glossary />
    </AdminPage>
  )
}

function NotReady({ message, anchor }: { message: string; anchor: string }) {
  const site = siteUrl()
  const openSite = site.startsWith('https://') && !/sslip\.io|localhost/.test(site)
  return (
    <div className="yp-card">
      <div className="yp-msg warn">{message}</div>
      {!openSite && <p className="yp-muted">Eslatma: Google va Yandex faqat oʻz domeningizdagi ochiq saytni koʻradi. Hozirgi manzil: {site}. Domen ulangach va sayt ochilgach, statistika bir necha kundan keyin paydo boʻladi.</p>}
      <div><Link className="yp-btn ghost" href={`/admin/integratsiyalar#${anchor}`}>Integratsiyalarga oʻtish</Link></div>
    </div>
  )
}

function Queries({ rows, title }: { rows: QueryRow[]; title: string }) {
  if (!rows.length) return <div className="yp-msg warn">Bu davrda soʻrovlar yoʻq. Yangi sayt uchun bu odatiy: Google va Yandex saytni 1–4 hafta ichida koʻrsata boshlaydi.</div>
  return (
    <div className="yp-card pad0">
      <table className="yp-table">
        <caption className="yp-muted" style={{ textAlign: 'left', padding: '10px 10px 0' }}>{title}</caption>
        <thead><tr><th>Soʻrov</th><th className="n">Koʻrsatildi</th><th className="n">Bosildi</th><th className="n">Bosish ulushi</th><th className="n">Oʻrin</th></tr></thead>
        <tbody>{rows.map((q) => (
          <tr key={q.query}><td>{q.query}</td><td className="n">{int(q.impressions)}</td><td className="n">{int(q.clicks)}</td><td className="n">{q.ctr}%</td><td className="n">{q.position || '—'}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
}

async function Google({ days }: { days: number }) {
  const r = await cached(`g:${days}`, () => googleStats(days))
  if (!r.ok) return <NotReady message={r.message} anchor="gsc" />
  const { totals, queries, pages, days: daily } = r.data
  const site = siteUrl()
  return (
    <>
      <div className="yp-grid kpi">
        <div className="yp-card yp-kpi"><span>Google’da koʻrsatildi</span><b>{int(totals.impressions)}</b></div>
        <div className="yp-card yp-kpi"><span>Saytga bosildi</span><b>{int(totals.clicks)}</b></div>
        <div className="yp-card yp-kpi"><span>Bosish ulushi</span><b>{totals.ctr}%</b></div>
        <div className="yp-card yp-kpi"><span>Oʻrtacha oʻrin</span><b>{totals.position || '—'}</b></div>
      </div>
      <h2 className="yp-h2">Kunlar boʻyicha</h2>
      <div className="yp-grid wide">
        <Bars title="Saytga bosishlar" data={daily.map((d) => ({ label: d.date, value: d.clicks }))} />
        <Bars title="Koʻrsatilishlar" data={daily.map((d) => ({ label: d.date, value: d.impressions }))} />
      </div>
      <h2 className="yp-h2">Qaysi soʻzlar bilan topishdi</h2>
      <Queries rows={queries} title={`Eng koʻp koʻrsatilgan 100 ta soʻrov · ${r.data.property}`} />
      <h2 className="yp-h2">Qaysi sahifalar chiqdi</h2>
      {pages.length ? (
        <div className="yp-card pad0">
          <table className="yp-table">
            <thead><tr><th>Sahifa</th><th className="n">Koʻrsatildi</th><th className="n">Bosildi</th><th className="n">Oʻrin</th></tr></thead>
            <tbody>{pages.map((p) => (
              <tr key={p.page}><td><a href={p.page} target="_blank" rel="noreferrer">{p.page.replace(site, '') || '/'}</a></td><td className="n">{int(p.impressions)}</td><td className="n">{int(p.clicks)}</td><td className="n">{p.position || '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : <div className="yp-muted">Hali maʼlumot yoʻq.</div>}
    </>
  )
}

async function Yandex({ days }: { days: number }) {
  const r = await cached(`y:${days}`, () => yandexStats(days))
  if (!r.ok) return <NotReady message={r.message} anchor="ywm" />
  const d = r.data
  const shows = d.queries.reduce((a, q) => a + q.impressions, 0), clicks = d.queries.reduce((a, q) => a + q.clicks, 0)
  return (
    <>
      <div className="yp-grid kpi">
        <div className="yp-card yp-kpi"><span>Yandex’da koʻrsatildi</span><b>{int(shows)}</b></div>
        <div className="yp-card yp-kpi"><span>Saytga bosildi</span><b>{int(clicks)}</b></div>
        {d.indexed != null && <div className="yp-card yp-kpi"><span>Qidiruvdagi sahifalar</span><b>{int(d.indexed)}</b></div>}
        {d.excluded != null && <div className="yp-card yp-kpi" title="Yandex qidiruvga qoʻshmagan sahifalar (dublikat, yopiq va h.k.)"><span>Chiqarib tashlangan</span><b>{int(d.excluded)}</b></div>}
        {d.sqi != null && <div className="yp-card yp-kpi" title="Yandex sayt sifati indeksi (IKS)"><span>IKS (Yandex bahosi)</span><b>{int(d.sqi)}</b></div>}
      </div>
      <h2 className="yp-h2">Qaysi soʻzlar bilan topishdi</h2>
      <Queries rows={d.queries} title={`Eng koʻp koʻrsatilgan soʻrovlar · ${d.host}`} />
    </>
  )
}

function Glossary() {
  return (
    <details className="yp-card" style={{ marginTop: 24 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Raqamlar nimani bildiradi?</summary>
      <ul className="yp-muted" style={{ margin: 0, paddingLeft: 18 }}>
        <li><b>Koʻrsatildi</b> — saytingiz qidiruv natijalarida necha marta chiqdi.</li>
        <li><b>Bosildi</b> — shundan necha marta odam bosib saytga kirdi.</li>
        <li><b>Bosish ulushi</b> — 100 marta koʻrsatilganda nechta bosish boʻlgani.</li>
        <li><b>Oʻrin</b> — natijalar roʻyxatidagi oʻrtacha joyingiz. 1–10 = birinchi sahifa. Qancha kichik boʻlsa, shuncha yaxshi.</li>
        <li>Koʻp koʻrsatilib kam bosilayotgan soʻz — oʻsha sahifaning sarlavhasi va tavsifini yaxshilash kerak (Mahsulot → SEO sarlavha / tavsif).</li>
      </ul>
    </details>
  )
}
