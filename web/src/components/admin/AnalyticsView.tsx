import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'

import * as A from '@/lib/analytics'
import { AutoRefresh } from './AutoRefresh'
import { Bars, FunnelBars } from './charts'
import { AdminPage } from './AdminPage'
import { ago, delta, int, pct, som } from './fmt'

const TABS: [string, string][] = [['umumiy', 'Umumiy'], ['manbalar', 'Manbalar'], ['sahifalar', 'Sahifalar'], ['mahsulotlar', 'Mahsulotlar'], ['qidiruv', 'Qidiruv'], ['auditoriya', 'Auditoriya'], ['tezlik', 'Tezlik'], ['hozir', 'Hozir']]
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function AnalyticsView(props: AdminViewServerProps) {
  const sp = props.searchParams ?? {}
  const tab = TABS.some(([k]) => k === one(sp.tab)) ? one(sp.tab)! : 'umumiy'
  const rk = (one(sp.r) ?? '7') in A.RANGES ? one(sp.r)! : '7'
  const href = (t: string, r = rk) => `/admin/analitika?tab=${t}&r=${r}`
  return (
    <AdminPage props={props} title="Analitika" lead="Saytga kirganlar, ular qayerdan kelgani, nimani koʻrgani va nimani sotib olgani. Hammasi shu yerda — Google yoki Yandex’ga kirish shart emas. Shaxsiy maʼlumot (ism, telefon, IP) saqlanmaydi.">
      <div className="yp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <nav className="yp-tabs" aria-label="Boʻlimlar" style={{ flex: 1 }}>
          {TABS.map(([k, label]) => <Link key={k} href={href(k)} className={k === tab ? 'on' : ''}>{label}</Link>)}
        </nav>
        {tab !== 'hozir' && tab !== 'qidiruv' && (
          <nav className="yp-tabs" aria-label="Davr">
            {Object.entries(A.RANGES).map(([k, label]) => <Link key={k} href={href(tab, k)} className={k === rk ? 'on' : ''}>{label}</Link>)}
          </nav>
        )}
      </div>
      <Content tab={tab} rk={rk} />
    </AdminPage>
  )
}

const Empty = () => (
  <div className="yp-msg warn">Bu davrda hali tashrif yoʻq. Sayt ochiq boʻlsa va birinchi mijozlar kirsa, raqamlar shu yerda paydo boʻladi. Sinash uchun saytni boshqa brauzerda (admin sifatida kirmasdan) oching — oʻzingizning kirishlaringiz hisobga olinmaydi.</div>
)

async function Content({ tab, rk }: { tab: string; rk: string }) {
  const run = await A.runner()
  const r = A.rangeOf(rk)
  if (tab === 'hozir') return <Realtime run={run} />
  if (tab === 'qidiruv') return <Searches run={run} />
  if (tab === 'umumiy') return <Overview run={run} r={r} />
  if (tab === 'manbalar') return <Sources run={run} r={r} />
  if (tab === 'sahifalar') return <Pages run={run} r={r} />
  if (tab === 'mahsulotlar') return <Products run={run} r={r} />
  if (tab === 'auditoriya') return <Audience run={run} r={r} />
  return <Speed run={run} r={r} />
}

type P = { run: A.Run; r: A.Range }

function Kpi({ label, value, d, note }: { label: string; value: string; d?: ReturnType<typeof delta>; note?: string }) {
  return (
    <div className="yp-card yp-kpi" title={note}>
      <span>{label}</span><b>{value}</b>
      {d && <i className={d.dir === 'up' ? 'yp-up' : d.dir === 'down' ? 'yp-down' : 'yp-muted'}>{/^[+−]/.test(d.text) ? `${d.text} oldingi davrga nisbatan` : d.text === '0%' ? 'oldingi davr bilan bir xil' : d.text === 'yangi' ? 'oldingi davrda boʻlmagan' : ' '}</i>}
    </div>
  )
}

async function Overview({ run, r }: P) {
  const [o, p, days, f, src] = await Promise.all([A.overview(run, r), A.overview(run, A.previous(r)), A.daily(run, r), A.funnel(run, r), A.sources(run, r)])
  return (
    <>
      {!o.pageviews && !o.orders && <Empty />}
      <div className="yp-grid kpi" style={{ marginTop: 12 }}>
        <Kpi label="Tashrifchilar" value={int(o.visitors)} d={delta(o.visitors, p.visitors)} note="Alohida brauzerlar soni" />
        <Kpi label="Kirishlar (sessiya)" value={int(o.sessions)} d={delta(o.sessions, p.sessions)} note="Bitta tashrifchi bir necha marta kirishi mumkin" />
        <Kpi label="Sahifa koʻrishlar" value={int(o.pageviews)} d={delta(o.pageviews, p.pageviews)} />
        <Kpi label="Toʻlangan buyurtmalar" value={int(o.paid)} d={delta(o.paid, p.paid)} />
        <Kpi label="Daromad" value={som(o.revenue)} d={delta(o.revenue, p.revenue)} note="Faqat toʻlangan buyurtmalar" />
        <Kpi label="Oʻrtacha chek" value={o.paid ? som(o.aov) : '—'} d={delta(o.aov, p.aov)} />
        <Kpi label="Konversiya" value={pct(o.conversion, 2)} d={delta(o.conversion, p.conversion)} note="Toʻlangan buyurtma / kirishlar" />
        <Kpi label="Toʻlanmagan buyurtma" value={int(o.unpaid)} note="Boshlangan, lekin toʻlanmagan: qoʻngʻiroq qilib eslatish mumkin (Marketing → Tashlab ketilganlar)" />
      </div>
      <div className="yp-grid wide" style={{ marginTop: 16 }}>
        <Bars title="Tashrifchilar (kunlar boʻyicha)" data={days.map((d) => ({ label: d.day, value: d.visitors }))} />
        <Bars title="Daromad (kunlar boʻyicha)" data={days.map((d) => ({ label: d.day, value: d.revenue }))} format={som} />
      </div>
      <div className="yp-grid wide" style={{ marginTop: 16 }}>
        <FunnelBars steps={[
          { label: 'Saytga kirdi', value: f.visit, hint: 'Kamida bitta sahifa koʻrgan sessiyalar' },
          { label: 'Mahsulot sahifasini koʻrdi', value: f.product, hint: '' },
          { label: 'Savatga qoʻshdi', value: f.cart, hint: '' },
          { label: 'Rasmiylashtirish sahifasiga oʻtdi', value: f.checkout, hint: '' },
          { label: 'Buyurtma berdi', value: f.ordered, hint: '' },
          { label: 'Toʻladi', value: f.paid, hint: '' },
        ]} />
        <div className="yp-card pad0">
          <b className="yp-h3" style={{ margin: 0, padding: '16px 18px 0' }}>Eng yaxshi manbalar</b>
          <table className="yp-table"><thead><tr><th>Manba</th><th className="n">Kirish</th><th className="n">Buyurtma</th><th className="n">Daromad</th></tr></thead>
            <tbody>{src.slice(0, 6).map((s) => <tr key={`${s.src}${s.med}${s.cmp}`}><td>{label(s)}</td><td className="n">{int(s.sessions)}</td><td className="n">{int(s.orders)}</td><td className="n">{som(s.revenue)}</td></tr>)}</tbody></table>
        </div>
      </div>
    </>
  )
}

const label = (s: Pick<A.SourceRow, 'src' | 'med' | 'cmp'>) => [s.src, s.med, s.cmp].filter(Boolean).join(' / ')

async function Sources({ run, r }: P) {
  const rows = await A.sources(run, r)
  return (
    <div className="yp-card pad0" style={{ marginTop: 12 }}>
      <table className="yp-table">
        <thead><tr><th>Manba / kanal / kampaniya</th><th className="n">Tashrifchi</th><th className="n">Kirish</th><th className="n">Buyurtma</th><th className="n">Daromad</th><th className="n">Konversiya</th></tr></thead>
        <tbody>
          {rows.map((s) => <tr key={`${s.src}${s.med}${s.cmp}`}><td>{label(s)}</td><td className="n">{int(s.visitors)}</td><td className="n">{int(s.sessions)}</td><td className="n">{int(s.orders)}</td><td className="n">{som(s.revenue)}</td><td className="n">{s.sessions && s.orders <= s.sessions ? pct(s.orders / s.sessions, 2) : '—'}</td></tr>)}
          {!rows.length && <tr><td colSpan={6}><Empty /></td></tr>}
        </tbody>
      </table>
      <p className="yp-muted" style={{ padding: '0 18px 16px' }}>Manba havola oxiridagi <code>?utm_source=…</code> dan yoki mijoz qaysi saytdan kelganidan aniqlanadi. Reklama va postlar uchun havolani <b>Marketing → Havola yasagich</b> bilan tayyorlang.</p>
    </div>
  )
}

async function Pages({ run, r }: P) {
  const rows = await A.pages(run, r)
  const max = Math.max(1, ...rows.map((x) => x.views))
  return (
    <div className="yp-card pad0" style={{ marginTop: 12 }}>
      <table className="yp-table">
        <thead><tr><th>Sahifa</th><th className="n">Koʻrishlar</th><th className="n">Tashrifchilar</th><th>Oxirigacha oʻqilishi</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.path}>
              <td><Link href={`/admin/heatmap?path=${encodeURIComponent(p.path)}`} title="Heatmap">{p.path}</Link><div className="yp-bar" style={{ height: 4, marginTop: 4 }}><i style={{ width: `${(p.views / max) * 100}%` }} /></div></td>
              <td className="n">{int(p.views)}</td><td className="n">{int(p.visitors)}</td>
              <td>{p.depth === null ? <span className="yp-muted">—</span> : `${p.depth}%`}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4}><Empty /></td></tr>}
        </tbody>
      </table>
      <p className="yp-muted" style={{ padding: '0 18px 16px' }}>Sahifa nomini bossangiz, shu sahifaning issiqlik xaritasi (qayerga bosishadi) ochiladi. «Oxirigacha oʻqilishi» — sahifaning oʻrtacha necha foizigacha pastga tushishgani.</p>
    </div>
  )
}

async function Products({ run, r }: P) {
  const rows = await A.products(run, r)
  return (
    <div className="yp-card pad0" style={{ marginTop: 12 }}>
      <table className="yp-table">
        <thead><tr><th>Mahsulot</th><th className="n">Koʻrildi</th><th className="n">Savatga</th><th className="n">Sotildi (dona)</th><th className="n">Daromad</th><th className="n">Koʻrish → savat</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.slug}>
              <td>{p.name}</td><td className="n">{int(p.views)}</td><td className="n">{int(p.carts)}</td><td className="n">{int(p.sold)}</td><td className="n">{som(p.revenue)}</td>
              <td className="n">{p.views ? pct(Math.min(1, p.carts / p.views), 0) : '—'}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6}><Empty /></td></tr>}
        </tbody>
      </table>
      <p className="yp-muted" style={{ padding: '0 18px 16px' }}>Koʻp koʻriladi, lekin savatga kam qoʻshiladi — narx, rasm yoki tavsifni qayta koʻring. Koʻp savatga qoʻshiladi, lekin sotilmaydi — yetkazish yoki toʻlov bosqichida muammo bor.</p>
    </div>
  )
}

async function Searches({ run }: { run: A.Run }) {
  const rows = await A.searches(run)
  return (
    <div className="yp-card pad0" style={{ marginTop: 12 }}>
      <table className="yp-table">
        <thead><tr><th>Mijoz yozgan soʻz</th><th className="n">Necha marta</th><th>Natija</th></tr></thead>
        <tbody>
          {rows.map((s) => <tr key={s.query}><td>{s.query}</td><td className="n">{int(s.count)}</td><td>{s.missed ? <span className="yp-pill bad">Topilmadi — olib kelish kerakmi?</span> : <span className="yp-pill on">Topildi</span>}</td></tr>)}
          {!rows.length && <tr><td colSpan={3}><div className="yp-msg warn">Hali qidiruv yoʻq.</div></td></tr>}
        </tbody>
      </table>
      <p className="yp-muted" style={{ padding: '0 18px 16px' }}>«Topilmadi» deb belgilanganlar — mijoz izlagan, lekin sizda yoʻq narsalar. Eng koʻp soʻralganini buyurtma qilish — eng aniq savdo imkoniyati. Bu roʻyxat butun vaqt uchun.</p>
    </div>
  )
}

async function Audience({ run, r }: P) {
  const d = await A.devices(run, r)
  const names: Record<string, string> = { mobile: 'Telefon', tablet: 'Planshet', desktop: 'Kompyuter', uz: 'Oʻzbekcha', ru: 'Ruscha' }
  const block = (title: string, rows: A.DeviceRow[]) => {
    const total = rows.reduce((a, x) => a + x.sessions, 0)
    return (
      <div className="yp-card" key={title}>
        <b className="yp-h3" style={{ margin: 0 }}>{title}</b>
        {rows.map((x) => (
          <div key={x.key}>
            <div className="yp-row" style={{ justifyContent: 'space-between', fontSize: 13.5 }}><span>{names[x.key] ?? x.key}</span><span><b>{int(x.sessions)}</b> <span className="yp-muted">{total ? pct(x.sessions / total, 0) : ''}</span></span></div>
            <div className="yp-bar" style={{ height: 10 }}><i style={{ width: `${total ? (x.sessions / total) * 100 : 0}%` }} /></div>
          </div>
        ))}
        {!rows.length && <Empty />}
      </div>
    )
  }
  return <div className="yp-grid wide" style={{ marginTop: 12 }}>{block('Qurilma (kirishlar)', d.device)}{block('Til (kirishlar)', d.lang)}</div>
}

async function Speed({ run, r }: P) {
  const rows = await A.vitals(run, r)
  const cell = (kind: 'lcp' | 'cls' | 'inp', v: number | null, unit = '') => {
    const g = A.grade(kind, v)
    return <td className="n">{v === null ? '—' : <span className={`yp-pill ${g === 'good' ? 'on' : g === 'mid' ? 'partial' : 'bad'}`} style={{ marginLeft: 0 }}>{kind === 'lcp' ? (v / 1000).toFixed(1) + ' s' : kind === 'cls' ? String(v) : `${v}${unit}`}</span>}</td>
  }
  return (
    <div className="yp-card pad0" style={{ marginTop: 12 }}>
      <table className="yp-table">
        <thead><tr><th>Qurilma</th><th className="n">Oʻlchovlar</th><th className="n" title="Eng katta element qancha vaqtda koʻrindi. Yaxshi: 2.5 soniyagacha">Yuklanish (LCP)</th><th className="n" title="Sahifa siljishi. Yaxshi: 0.1 gacha">Siljish (CLS)</th><th className="n" title="Bosishga javob. Yaxshi: 200 ms gacha">Javob (INP)</th></tr></thead>
        <tbody>
          {rows.map((v) => <tr key={v.device}><td>{v.device === 'mobile' ? 'Telefon' : v.device === 'tablet' ? 'Planshet' : 'Kompyuter'}</td><td className="n">{int(v.samples)}</td>{cell('lcp', v.lcp)}{cell('cls', v.cls)}{cell('inp', v.inp, ' ms')}</tr>)}
          {!rows.length && <tr><td colSpan={5}><Empty /></td></tr>}
        </tbody>
      </table>
      <p className="yp-muted" style={{ padding: '0 18px 16px' }}>Haqiqiy mijozlarning telefon va kompyuterlarida oʻlchangan tezlik (eng sekin 25% chegarasi). Yashil — yaxshi, sariq — oʻrtacha, qizil — Google qidiruvida pasaytiradi, mijozni yoʻqotadi.</p>
    </div>
  )
}

const EV: Record<string, string> = { pageview: 'sahifa koʻrdi', add_to_cart: 'savatga qoʻshdi', order_created: 'buyurtma berdi', purchase: 'TOʻLADI' }
async function Realtime({ run }: { run: A.Run }) {
  const x = await A.realtime(run)
  return (
    <div className="yp-grid wide" style={{ marginTop: 12 }}>
      <AutoRefresh seconds={15} />
      <div className="yp-card">
        <span className="yp-muted">Oxirgi 5 daqiqada saytda</span>
        <b style={{ fontSize: 44, lineHeight: 1 }}>{int(x.visitors)}</b>
        <span className="yp-muted">kishi</span>
        {x.pages.map((p) => <div key={p.path} className="yp-row" style={{ justifyContent: 'space-between', fontSize: 13.5 }}><span>{p.path}</span><b>{p.visitors}</b></div>)}
        {!x.pages.length && <span className="yp-muted">Hozir hech kim yoʻq.</span>}
      </div>
      <div className="yp-card pad0">
        <b className="yp-h3" style={{ margin: 0, padding: '16px 18px 0' }}>Oxirgi harakatlar</b>
        <table className="yp-table"><tbody>
          {x.last.map((e, i) => <tr key={i}><td>{EV[e.name] ?? e.name}<div className="yp-muted">{e.path}{e.src ? ` · ${e.src}` : ''}</div></td><td className="n yp-muted">{e.device}<br />{ago(e.at)}</td></tr>)}
          {!x.last.length && <tr><td>Hali harakat yoʻq.</td></tr>}
        </tbody></table>
      </div>
    </div>
  )
}
