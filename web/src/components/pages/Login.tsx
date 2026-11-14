// Generated from design/preview/Login.html by scripts/gen-page.py, then edited by hand.
import Link from 'next/link'

export type PageProps = { tr: (s: string) => string; L: (p: string) => string; C: (i: number) => React.ReactNode }

export function LoginPage({ tr, L, C }: PageProps) {
  return (
<div style={{minHeight: '100vh', display: 'flex', flexWrap: 'wrap'}}>
  <section style={{flex: '1 1 560px', display: 'flex', flexDirection: 'column', padding: '40px 56px', gap: '24px', boxSizing: 'border-box'}}>
    <Link href={L("/")} style={{display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', font: "500 26px 'Inter Tight', sans-serif", letterSpacing: '-0.04em'}}><span style={{width: '14px', height: '14px', borderRadius: '50%', background: '#E8B4B8', boxShadow: '8px 0 0 #2A211E'}}></span><span style={{marginLeft: '8px'}}>{tr("Yeppo")}</span></Link>
    <div style={{flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '18px', maxWidth: '440px', width: '100%', margin: '0 auto'}}>
      
        <h1 className="h h1" style={{fontSize: '40px'}}>{tr("Kirish yoki roʻyxatdan oʻtish")}</h1>
        <p className="muted" style={{margin: '0', fontSize: '16px', lineHeight: '1.55'}}>{tr("Parol kerak emas. Raqamingizga SMS-kod yuboramiz.")}</p>
        <label className="lbl">{tr("Telefon raqam")}<input className="inp" type="tel" autoComplete="tel" value="+998 90 123 45 67" style={{fontSize: '18px'}} /></label>
        <button className="pill dark" style={{minHeight: '56px', fontSize: '16px'}}>{tr("Kod olish")}</button>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', color: '#8A7F79', fontSize: '13px'}}><span style={{flex: '1', height: '1px', background: '#E2DAD2'}}></span>{tr("yoki")}<span style={{flex: '1', height: '1px', background: '#E2DAD2'}}></span></div>
        <button className="pill line" style={{minHeight: '52px'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z"></path><path d="M9 13l12-9"></path></svg> {tr("Telegram orqali kirish")}</button>
      
      
      <span className="muted" style={{fontSize: '12px', lineHeight: '1.5'}}>{tr("Davom etib,")} <Link href={L("/yordam/yetkazish")}>{tr("maxfiylik siyosati")}</Link> {tr("va")} <Link href={L("/yordam/yetkazish")}>{tr("ommaviy oferta")}</Link> {tr("shartlariga rozilik bildirasiz.")}</span>
    </div>
  </section>
  <aside style={{flex: '1 1 560px', position: 'relative', minHeight: '600px'}}>
    <img className="ph" src="/img/face-glow.jpg" alt="" style={{position: 'absolute', inset: '0', objectPosition: '50% 30%'}} />
    <div className="glass" style={{position: 'absolute', left: '32px', right: '32px', bottom: '32px', padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
      <b className="h" style={{fontSize: '22px'}}>{tr("Kirganingizda")}</b>
      <span style={{display: 'flex', gap: '10px', fontSize: '15px'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg> {tr("Buyurtmalar va kuzatish bir joyda")}</span>
      <span style={{display: 'flex', gap: '10px', fontSize: '15px'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg> {tr("Har xariddan bonus ball")}</span>
      <span style={{display: 'flex', gap: '10px', fontSize: '15px'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg> {tr("Teri profilingiz — katalogda «sizga mos» belgisi")}</span>
    </div>
  </aside>
</div>
  )
}
