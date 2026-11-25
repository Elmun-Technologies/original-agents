import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'

import { loadAudit } from '@/lib/seo-audit-load'
import { siteUrl } from '@/lib/site'
import { AdminPage } from './AdminPage'
import { CopyButton } from './CopyButton'

const SEV = { high: ['bad', 'Muhim'], mid: ['partial', 'Oʻrtacha'], low: ['off', 'Ixtiyoriy'] } as const

export function SeoView(props: AdminViewServerProps) {
  return (
    <AdminPage props={props} title="SEO audit" lead="Sayt Google va Yandex qidiruvida yaxshi chiqishi uchun nima yetishmayotgani. Har bir topilma ostida aynan qayerga kirib nima qilish yozilgan. Roʻyxat har safar sahifa ochilganda yangidan hisoblanadi.">
      <Body />
    </AdminPage>
  )
}

async function Body() {
  const a = await loadAudit()
  const site = siteUrl()
  const color = a.score >= 85 ? '#2f7d32' : a.score >= 60 ? '#b9770e' : '#c0392b'
  return (
    <>
      <div className="yp-grid kpi" style={{ marginBottom: 16 }}>
        <div className="yp-card yp-kpi"><span>SEO bahosi</span><b style={{ color }}>{a.score}/100</b></div>
        <div className="yp-card yp-kpi"><span>Muammoli band</span><b>{a.problems}</b></div>
      </div>
      <div className="yp-card" style={{ marginBottom: 16 }}>
        <b className="yp-h3" style={{ margin: 0 }}>Qidiruv tizimlariga bering</b>
        <div className="yp-row"><span>Sitemap:</span> <code>{site}/sitemap.xml</code> <CopyButton text={`${site}/sitemap.xml`} /></div>
        <div className="yp-muted">Sitemap hamma sahifalarni ikki tilda va bir-biriga bogʻlab (hreflang) beradi, yangi mahsulot oʻzi qoʻshiladi. Google Search Console va Yandex Vebmaster’ga shu manzilni bir marta kiriting (Integratsiyalar sahifasida yoʻriqnoma bor). Boshqa tayyor narsalar: robots.txt, llms.txt (sunʼiy intellekt qidiruvlari uchun), Open Graph rasmlari, mahsulot/maqola/FAQ/tashkilot sxemalari.</div>
      </div>
      <div className="yp-grid" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
        {a.findings.map((f) => {
          const [cls, label] = SEV[f.severity]
          const bad = f.items.length > 0
          return (
            <details key={f.id} className="yp-card" open={bad && f.severity === 'high'}>
              <summary className="yp-row" style={{ gap: 10 }}>
                <span className={`yp-pill ${bad ? cls : 'on'}`} style={{ marginLeft: 0 }}>{bad ? label : 'Joyida'}</span>
                <span>{f.title}</span>
                <span className="yp-muted" style={{ marginLeft: 'auto' }}>{f.site ? '' : `${f.items.length} / ${f.total}`}</span>
              </summary>
              <p className="yp-muted" style={{ margin: '10px 0 4px' }}><b>Nega muhim:</b> {f.why}</p>
              <p className="yp-muted" style={{ margin: '0 0 8px' }}><b>Nima qilish kerak:</b> {f.fix}</p>
              {f.items.slice(0, 40).map((i) => <div key={i.href + i.label}><Link href={i.href}>{i.label}</Link></div>)}
              {f.items.length > 40 && <div className="yp-muted">… yana {f.items.length - 40} ta</div>}
            </details>
          )
        })}
      </div>
    </>
  )
}
