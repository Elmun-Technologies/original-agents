import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'

import { rangeOf, runner, type Run } from '@/lib/analytics'
import { abandonedOrders, customers, promoResults, SEGMENTS, waitingDemand } from '@/lib/marketing'
import { candidates, channelFor, loadSettings } from '@/lib/reminders'
import { smsMock } from '@/lib/sms'
import { siteUrl } from '@/lib/site'
import { AdminPage } from './AdminPage'
import { CopyButton } from './CopyButton'
import { int, ago, som } from './fmt'
import { RunRemindersButton } from './RunRemindersButton'
import { UtmBuilder } from './UtmBuilder'

const TABS: [string, string][] = [['tashlab', 'Tashlab ketilgan buyurtmalar'], ['eslatmalar', 'Avtomatik eslatmalar'], ['mijozlar', 'Mijozlar'], ['kutish', 'Kelishini kutayotganlar'], ['havola', 'Havola yasagich'], ['promokod', 'Promokodlar natijasi']]
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function MarketingView(props: AdminViewServerProps) {
  const sp = props.searchParams ?? {}
  const tab = TABS.some(([k]) => k === one(sp.tab)) ? one(sp.tab)! : 'tashlab'
  return (
    <AdminPage props={props} title="Marketing" lead="Mavjud mijozlarni qaytarish, toʻlanmay qolgan buyurtmalarni tiklash va reklamani oʻlchash uchun asboblar. Hammasi sizda allaqachon bor maʼlumotdan tuziladi.">
      <nav className="yp-tabs" aria-label="Boʻlimlar">{TABS.map(([k, l]) => <Link key={k} href={`/admin/marketing?tab=${k}`} className={k === tab ? 'on' : ''}>{l}</Link>)}</nav>
      {tab === 'havola' ? <UtmBuilder site={siteUrl()} /> : <Data tab={tab} seg={one(sp.seg)} />}
    </AdminPage>
  )
}

async function Data({ tab, seg }: { tab: string; seg?: string }) {
  const run = await runner()
  if (tab === 'mijozlar') return <Customers run={run} seg={seg && seg in SEGMENTS ? seg : ''} />
  if (tab === 'promokod') return <Promos run={run} />
  if (tab === 'kutish') return <Waiting run={run} />
  if (tab === 'eslatmalar') return <Reminders run={run} />
  return <Abandoned />
}

const phoneDigits = (p: string) => p.replace(/\D/g, '')

async function Abandoned() {
  const rows = await abandonedOrders()
  const site = siteUrl()
  const msg = (r: (typeof rows)[number]) => {
    const url = r.link ? `${site}${r.link}` : null
    if (r.lang === 'ru') return url ? `Здравствуйте, ${r.name}! Ваш заказ в Yeppo (${r.items}) не оплачен. Ссылка для оплаты: ${url}. Если есть вопросы — напишите, поможем.` : `Здравствуйте, ${r.name}! Вы выбрали в Yeppo: ${r.items}. Хотите оформить заказ? Напишите нам, мы поможем: ${site}/ru`
    return url ? `Assalomu alaykum, ${r.name}! Yeppo’da buyurtmangiz (${r.items}) toʻlanmay qoldi. Toʻlash uchun havola: ${url}. Savolingiz boʻlsa yozing, yordam beramiz.` : `Assalomu alaykum, ${r.name}! Siz Yeppo’da ${r.items} ni tanlagan edingiz. Buyurtmani rasmiylashtirishda yordam beraylikmi? ${site}/uz`
  }
  return (
    <>
      <div className="yp-msg warn" style={{ marginBottom: 12 }}>Mijoz buyurtmani boshlagan va ism, telefon, manzilni kiritgan, lekin toʻlamagan. Odatda bu eng arzon sotuvlar: 1–2 soat ichida yozilsa, koʻpchiligi toʻlaydi. Faqat shu buyurtma haqida yozing — boshqa reklama yubormang.</div>
      <div className="yp-card pad0">
        <table className="yp-table">
          <thead><tr><th>Mijoz</th><th>Buyurtma</th><th className="n">Summa</th><th>Qachon</th><th>Aloqa</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.name}</b><div className="yp-muted">+{r.phone}{r.city ? ` · ${r.city}` : ''}</div></td>
                <td>{r.items}<div className="yp-muted">№ {r.number}{r.src ? ` · ${r.src}` : ''}</div></td>
                <td className="n">{som(r.total)}</td>
                <td>{ago(r.at)}<div className="yp-muted">{r.link ? 'toʻlov havolasi ishlaydi' : 'havola muddati tugagan'}</div></td>
                <td><div className="yp-row">
                  <a className="yp-btn ghost" style={{ padding: '4px 10px', fontSize: 13 }} href={`tel:+${phoneDigits(r.phone)}`}>Qoʻngʻiroq</a>
                  <a className="yp-btn ghost" style={{ padding: '4px 10px', fontSize: 13 }} href={`https://t.me/+${phoneDigits(r.phone)}`} target="_blank" rel="noreferrer">Telegram</a>
                  <CopyButton text={msg(r)} label="Xabar matni" />
                </div></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5}><div className="yp-msg ok">Hozir toʻlanmay qolgan buyurtma yoʻq. Yaxshi.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

async function Customers({ run, seg }: { run: Run; seg: string }) {
  const all = await customers(run)
  const rows = seg ? all.filter((c) => c.segments.includes(seg)) : all
  return (
    <>
      <div className="yp-grid kpi" style={{ marginBottom: 16 }}>
        <Link href="/admin/marketing?tab=mijozlar" className={`yp-card yp-kpi`} style={{ textDecoration: 'none', color: 'inherit', outline: seg ? 'none' : '2px solid var(--theme-elevation-800)' }}><span>Hamma mijozlar</span><b>{int(all.length)}</b></Link>
        {Object.entries(SEGMENTS).map(([k, s]) => (
          <Link key={k} href={`/admin/marketing?tab=mijozlar&seg=${k}`} className="yp-card yp-kpi" style={{ textDecoration: 'none', color: 'inherit', outline: seg === k ? '2px solid var(--theme-elevation-800)' : 'none' }}>
            <span>{s.label}</span><b>{int(all.filter((c) => c.segments.includes(k)).length)}</b>
          </Link>
        ))}
      </div>
      {seg && <div className="yp-msg warn" style={{ marginBottom: 12 }}><b>{SEGMENTS[seg].label}:</b> {SEGMENTS[seg].hint}</div>}
      <div className="yp-row" style={{ marginBottom: 8, justifyContent: 'space-between' }}>
        <span className="yp-muted">{int(rows.length)} ta mijoz · faqat toʻlagan buyurtmasi borlar</span>
        <a className="yp-btn" href={`/api/admin/customers${seg ? `?segment=${seg}` : ''}`}>Jadval (CSV) yuklab olish</a>
      </div>
      <div className="yp-card pad0">
        <table className="yp-table">
          <thead><tr><th>Mijoz</th><th className="n">Buyurtmalar</th><th className="n">Jami xarid</th><th>Oxirgi xarid</th><th>Guruh</th></tr></thead>
          <tbody>
            {rows.slice(0, 200).map((c) => (
              <tr key={c.phone}><td><b>{c.name || '—'}</b><div className="yp-muted">+{c.phone}</div></td><td className="n">{c.orders}</td><td className="n">{som(c.spent)}</td><td>{c.last.slice(0, 10)}</td><td>{c.segments.map((s) => SEGMENTS[s].label).join(', ') || '—'}</td></tr>
            ))}
            {!rows.length && <tr><td colSpan={5}><div className="yp-msg warn">Bu guruhda hali mijoz yoʻq.</div></td></tr>}
          </tbody>
        </table>
      </div>
      <p className="yp-muted">Telefon raqamlar faqat sizga koʻrinadi. Ularga faqat oʻz buyurtmalari yoki oʻzi rozi boʻlgan xabarlarni yuboring; jadvalni boshqalarga bermang.</p>
    </>
  )
}

async function Promos({ run }: { run: Run }) {
  const r = rangeOf('30')
  const rows = await promoResults(run, r.from, r.to)
  return (
    <div className="yp-card pad0">
      <table className="yp-table">
        <thead><tr><th>Promokod / chegirma</th><th className="n">Buyurtmalar</th><th className="n">Berilgan chegirma</th><th className="n">Tushum</th></tr></thead>
        <tbody>
          {rows.map((x) => <tr key={x.code}><td>{x.code === 'routine' ? 'Tayyor toʻplam (−10%)' : x.code}</td><td className="n">{int(x.orders)}</td><td className="n">{som(x.discount)}</td><td className="n">{som(x.revenue)}</td></tr>)}
          {!rows.length && <tr><td colSpan={4}><div className="yp-msg warn">Oxirgi 30 kunda chegirmali toʻlangan buyurtma yoʻq.</div></td></tr>}
        </tbody>
      </table>
      <p className="yp-muted" style={{ padding: '0 18px 16px' }}>Oxirgi 30 kun. Promokodni qoʻshish yoki oʻchirish: <Link href="/admin/collections/promo-codes">Promokodlar</Link>.</p>
    </div>
  )
}

async function Waiting({ run }: { run: Run }) {
  const rows = await waitingDemand(run)
  return (
    <div className="yp-card pad0">
      <table className="yp-table">
        <thead><tr><th>Mahsulot</th><th className="n">Kutayotganlar</th><th className="n">Hozir omborda</th></tr></thead>
        <tbody>
          {rows.map((w) => <tr key={w.sku}><td><b>{w.name}</b><div className="yp-muted">{w.volume} · {w.sku}</div></td><td className="n"><b>{int(w.people)}</b></td><td className="n">{w.stock > 0 ? int(w.stock) : <span className="yp-pill bad" style={{ marginLeft: 0 }}>tugagan</span>}</td></tr>)}
          {!rows.length && <tr><td colSpan={3}><div className="yp-msg warn">Hozir hech kim kutmayapti. Mijoz tugagan mahsulotda «Kelganda xabar berish» ni bossa (Telegram bot ulangan boʻlsa), shu yerda koʻrinadi.</div></td></tr>}
        </tbody>
      </table>
      <p className="yp-muted" style={{ padding: '0 18px 16px' }}>Eng koʻp kutilayotgan va omborda yoʻq tovarni birinchi buyurtma qiling: mijoz allaqachon xohlayapti. Tovar kelib, adminda qoldiq kiritilganda kutganlarga Telegramda xabar avtomatik ketadi.</p>
    </div>
  )
}

const KIND: Record<string, string> = { abandoned: 'Toʻlanmagan buyurtma', lapsed: 'Qaytmagan mijoz' }
const STATUS: Record<string, string> = { sent: 'Yuborildi', failed: 'Yuborilmadi', skipped: 'Oʻtkazildi' }

async function Reminders({ run }: { run: Run }) {
  const s = await loadSettings()
  const smsReady = !(await smsMock())
  const next = await candidates(run, s)
  const log = await run(`SELECT kind, phone, order_number, channel, status, note, created_at FROM reminder_log ORDER BY created_at DESC LIMIT 50`)
  const [week] = await run(`SELECT count(*) FILTER (WHERE status = 'sent') sent, count(*) FILTER (WHERE status = 'failed') failed,
    count(*) FILTER (WHERE kind = 'abandoned' AND status = 'sent') ab FROM reminder_log WHERE created_at > now() - interval '7 days'`)
  const [back] = await run(`SELECT count(DISTINCT o.id) n, coalesce(sum(o.total), 0) t FROM reminder_log r JOIN orders o ON o.number = r.order_number
    WHERE r.kind = 'abandoned' AND r.status = 'sent' AND o.payment_status = 'paid' AND r.created_at > now() - interval '30 days'`)
  const state = (on: boolean) => <span className={`yp-pill ${on ? 'on' : 'off'}`} style={{ marginLeft: 0 }}>{on ? 'Yoqilgan' : 'Oʻchiq'}</span>
  return (
    <>
      <div className="yp-msg warn" style={{ marginBottom: 12 }}>Sayt oʻzi yozadi: toʻlanmay qolgan buyurtma egasiga bitta eslatma va uzoq vaqt xarid qilmagan, xabarga rozi boʻlgan mijozga bitta eslatma. Har 10 daqiqada tekshiriladi, faqat 10:00–20:00 da yuboriladi. Telegram — mijoz botga ulangan boʻlsa (bepul); SMS — Eskiz haqiqiy rejimda boʻlsa{smsReady ? '' : ' (hozir SMS sinov rejimida, shuning uchun SMS ketmaydi)'}. Eskiz SMS matnini oldindan tasdiqlaydi: sozlamalardagi matnni Eskiz kabinetida shablon sifatida tasdiqlating.</div>
      <div className="yp-grid kpi" style={{ marginBottom: 16 }}>
        <div className="yp-card yp-kpi"><span>Toʻlanmagan buyurtma eslatmasi</span><b>{state(s.abandonedOn)}</b><i className="yp-muted">{s.abandonedAfterMin} daqiqadan keyin</i></div>
        <div className="yp-card yp-kpi"><span>Qaytmagan mijoz eslatmasi</span><b>{state(s.lapsedOn)}</b><i className="yp-muted">{s.lapsedDays} kundan keyin</i></div>
        <div className="yp-card yp-kpi"><span>7 kunda yuborildi</span><b>{int(Number(week?.sent ?? 0))}</b><i className="yp-muted">{int(Number(week?.failed ?? 0))} ta yuborilmadi</i></div>
        <div className="yp-card yp-kpi" title="Eslatma olgandan keyin toʻlangan buyurtmalar, 30 kun"><span>Eslatmadan keyin toʻlandi</span><b>{int(Number(back?.n ?? 0))}</b><i className="yp-muted">{som(Number(back?.t ?? 0))}</i></div>
      </div>
      <div className="yp-row" style={{ marginBottom: 16 }}>
        <Link className="yp-btn ghost" href="/admin/globals/reminders">Sozlamalar va matnlar</Link>
        <RunRemindersButton />
      </div>
      <h2 className="yp-h2">Navbatdagilar (hozir tekshirilsa yuboriladi)</h2>
      <div className="yp-card pad0">
        <table className="yp-table">
          <thead><tr><th>Turi</th><th>Mijoz</th><th>Kanal</th><th>Matn</th></tr></thead>
          <tbody>
            {next.map((c) => {
              const via = channelFor(c.kind === 'abandoned' ? s.abandonedChannel : s.lapsedChannel, c.chat, smsReady)
              return <tr key={c.key}><td>{KIND[c.kind]}{c.orderNumber ? <div className="yp-muted">№ {c.orderNumber}</div> : null}</td><td>{c.name}<div className="yp-muted">+{c.phone}</div></td><td>{via === 'telegram' ? 'Telegram' : via === 'sms' ? 'SMS' : <span className="yp-muted">yoʻq (oʻtkaziladi)</span>}</td><td className="yp-muted" style={{ maxWidth: 420 }}>{c.text}</td></tr>
            })}
            {!next.length && <tr><td colSpan={4}><div className="yp-muted">{s.abandonedOn || s.lapsedOn ? 'Hozir hech kimga yuboriladigan eslatma yoʻq.' : 'Eslatmalar oʻchiq.'}</div></td></tr>}
          </tbody>
        </table>
      </div>
      <h2 className="yp-h2">Oxirgi 50 ta</h2>
      <div className="yp-card pad0">
        <table className="yp-table">
          <thead><tr><th>Qachon</th><th>Turi</th><th>Telefon</th><th>Kanal</th><th>Natija</th></tr></thead>
          <tbody>
            {log.map((r, i) => <tr key={i}><td>{new Date(r.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}</td><td>{KIND[r.kind] ?? r.kind}{r.order_number ? <div className="yp-muted">№ {r.order_number}</div> : null}</td><td>+{r.phone}</td><td>{r.channel === 'none' ? '—' : r.channel === 'sms' ? 'SMS' : 'Telegram'}</td><td>{STATUS[r.status] ?? r.status}{r.note ? <div className="yp-muted">{r.note}</div> : null}</td></tr>)}
            {!log.length && <tr><td colSpan={5}><div className="yp-muted">Hali eslatma yuborilmagan.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
