// Generated from design/preview/NotFound.html by scripts/gen-page.py, then edited by hand.
import Link from 'next/link'

export type PageProps = { tr: (s: string) => string; L: (p: string) => string; C: (i: number) => React.ReactNode }

export function NotFoundPage({ tr, L, C }: PageProps) {
  return (
<div className="wrap" style={{marginTop: '20px'}}>
  <section className="card" style={{display: 'flex', flexWrap: 'wrap', minHeight: '420px'}}>
    <div className="pad-m" style={{flex: '1 1 520px', padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px'}}>
      <span className="num" style={{fontSize: '96px', color: '#A8475C', lineHeight: '1'}}>404</span>
      <h1 className="h h1" style={{fontSize: '40px'}}>{tr("Bu sahifa yoʻq — lekin siz qidirgan narsa bordir")}</h1>
      <p className="muted" style={{margin: '0', fontSize: '16px', lineHeight: '1.55'}}>{tr("Havola eskirgan yoki mahsulot sotuvdan chiqqan boʻlishi mumkin. Nima qidirayotganingizni yozing — topamiz.")}</p>
      <Link href={L("/qidiruv")} style={{display: 'flex', gap: '10px', alignItems: 'center', padding: '0 20px', minHeight: '54px', borderRadius: '999px', background: '#F0EBE5', textDecoration: 'none', color: '#6B5F59', maxWidth: '520px'}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg> {tr("Masalan: centella ampula")}</Link>
      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}><Link href={L("/")} className="pill dark">{tr("Bosh sahifa")}</Link><Link href={L("/aksiyalar")} className="pill line">{tr("Aksiyalar")}</Link><Link href={L("/maslahatchi")} className="pill line"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path></svg> {tr("Maslahatchi")}</Link></div>
    </div>
    <div style={{flex: '1 1 420px', minHeight: '420px', position: 'relative'}}><img className="ph" src="/img/face-peach.jpg" alt="" style={{position: 'absolute', inset: '0'}} /></div>
  </section>
  <section style={{marginTop: '32px'}} aria-labelledby="pp-h">
    <h2 id="pp-h" className="h h2" style={{fontSize: '30px', marginBottom: '16px'}}>{tr("Balki shulardan birini qidirgandirsiz")}</h2>
    <div className="pgrid">
{C(0)}

{C(1)}

{C(2)}

{C(3)}

{C(4)}
</div>
  </section>
</div>
  )
}
