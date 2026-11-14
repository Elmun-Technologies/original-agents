// Generated from design/preview/Loyalty.html by scripts/gen-page.py, then edited by hand.
import Link from 'next/link'

export type PageProps = { tr: (s: string) => string; L: (p: string) => string; C: (i: number) => React.ReactNode }

export function LoyaltyPage({ tr, L, C }: PageProps) {
  return (
<div className="wrap" style={{marginTop: '16px'}}>
  <nav aria-label={tr("Yoʻl")} className="muted" style={{fontSize: '13px', display: 'flex', gap: '8px'}}><Link href={L("/")} style={{color: '#6B5F59'}}>{tr("Bosh sahifa")}</Link><span>/</span><span style={{color: '#2A211E'}}>{tr("Bonus dasturi")}</span></nav>
  <section className="card" style={{marginTop: '12px', display: 'flex', flexWrap: 'wrap', background: '#2A211E', color: '#FBFAF7', minHeight: '340px'}}>
    <div className="pad-m" style={{flex: '1 1 560px', padding: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px'}}>
      <span className="eyebrow" style={{color: '#F2D6D0'}}>{tr("Bonus dasturi")}</span>
      <h1 className="h h1" style={{fontSize: '50px', lineHeight: '1.04'}}>{tr("Har xariddan qaytadi.")} <span className="serif" style={{fontStyle: 'italic', color: '#F2D6D0'}}>{tr("Shunchaki.")}</span></h1>
      <p style={{margin: '0', fontSize: '17px', lineHeight: '1.6', color: '#E9E1DC', maxWidth: '520px'}}>{tr("Har xariddan ball yigʻiladi, 1 ball = 1 soʻm. Keyingi buyurtmada chegirma sifatida ishlatasiz. Roʻyxatdan oʻtish — telefon raqam bilan, 20 soniya.")}</p>
      <Link href={L("/kirish")} className="pill" style={{alignSelf: 'flex-start', background: '#F2D6D0', borderColor: '#F2D6D0', color: '#2A211E'}}>{tr("Qoʻshilish")}</Link>
    </div>
    <div style={{flex: '1 1 420px', minHeight: '340px', position: 'relative'}}><img className="ph" src="/img/face-white.jpg" alt="" style={{position: 'absolute', inset: '0', objectPosition: '50% 25%'}} /></div>
  </section>

  <section data-g="3" style={{marginTop: '16px', display: 'grid', gap: '12px'}} aria-label={tr("Darajalar")}>
    
      <div className="card" style={{padding: '26px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#FBFAF7', border: '1.5px solid #2A211E'}}>
        <span style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><b className="h" style={{fontSize: '26px'}}>{tr("Pushti")}</b><span className="num" style={{fontSize: '34px', color: '#A8475C'}}>3%</span></span>
        <span className="muted" style={{fontSize: '14px'}}>{tr("Birinchi xariddan")}</span>
        <span style={{display: 'flex', gap: '8px', fontSize: '14px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg> {tr("Har xariddan 3% ball")}</span><span style={{display: 'flex', gap: '8px', fontSize: '14px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg> {tr("Tugʻilgan kun sovgʻasi")}</span>
        <span className="chip dark" style={{alignSelf: 'flex-start', background: '#2A211E', color: '#FBFAF7'}}>{tr("Siz shu yerdasiz")}</span>
      </div>
    
      <div className="card" style={{padding: '26px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#F5DCC9', border: '1.5px solid transparent'}}>
        <span style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><b className="h" style={{fontSize: '26px'}}>{tr("Shaftoli")}</b><span className="num" style={{fontSize: '34px', color: '#A8475C'}}>5%</span></span>
        <span className="muted" style={{fontSize: '14px'}}>{tr("2 000 000 soʻmdan")}</span>
        <span style={{display: 'flex', gap: '8px', fontSize: '14px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg> {tr("Har xariddan 5% ball")}</span><span style={{display: 'flex', gap: '8px', fontSize: '14px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg> {tr("Yangi mahsulotlarga oldindan kirish")}</span>
        
      </div>
    
      <div className="card" style={{padding: '26px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#F2D6D0', border: '1.5px solid transparent'}}>
        <span style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><b className="h" style={{fontSize: '26px'}}>{tr("Kakao")}</b><span className="num" style={{fontSize: '34px', color: '#A8475C'}}>7%</span></span>
        <span className="muted" style={{fontSize: '14px'}}>{tr("5 000 000 soʻmdan")}</span>
        <span style={{display: 'flex', gap: '8px', fontSize: '14px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg> {tr("Har xariddan 7% ball")}</span><span style={{display: 'flex', gap: '8px', fontSize: '14px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg> {tr("Bepul yetkazish har doim")}</span><span style={{display: 'flex', gap: '8px', fontSize: '14px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg> {tr("Shaxsiy kosmetolog")}</span>
        
      </div>
    
  </section>

  <section className="card pad-m" style={{marginTop: '16px', padding: '28px'}} aria-labelledby="pr-h">
    <div className="sec-h"><h2 id="pr-h" className="h" style={{fontSize: '26px'}}>{tr("«Shaftoli» darajasigacha")}</h2><span className="num" style={{fontSize: '18px'}}>{tr("1 240 000 / 2 000 000 soʻm")}</span></div>
    <span style={{display: 'block', height: '10px', borderRadius: '999px', background: '#EFE9E3', marginTop: '14px', overflow: 'hidden'}}><span style={{display: 'block', height: '100%', width: '62%', background: '#A8475C'}}></span></span>
    <p className="muted" style={{margin: '12px 0 0', fontSize: '15px'}}>{tr("Yana 760 000 soʻmlik xarid — va har buyurtmadan 5% qaytadi.")}</p>
  </section>

  <section style={{marginTop: '32px'}} aria-labelledby="earn-h">
    <h2 id="earn-h" className="h h2" style={{fontSize: '30px', marginBottom: '16px'}}>{tr("Ball yana qanday yigʻiladi")}</h2>
    <div data-g="4" style={{display: 'grid', gap: '12px'}}>
      <div className="card" style={{padding: '22px', display: 'flex', flexDirection: 'column', gap: '6px'}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"></path></svg><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("Sharh yozing")}</b><span className="muted" style={{fontSize: '14px'}}>{tr("+[N] ball, rasm bilan — ikki baravar")}</span></div>
      <div className="card" style={{padding: '22px', display: 'flex', flexDirection: 'column', gap: '6px'}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("Dugonangizni taklif qiling")}</b><span className="muted" style={{fontSize: '14px'}}>{tr("U −10% oladi, siz +[N] ball")}</span></div>
      <div className="card" style={{padding: '22px', display: 'flex', flexDirection: 'column', gap: '6px'}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="2"></rect><path d="M12 9v12M3 13h18M12 9c-2-4-6-4-6-1s6 1 6 1 6 2 6-1-4-3-6 1"></path></svg><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("Tugʻilgan kun")}</b><span className="muted" style={{fontSize: '14px'}}>{tr("Bir hafta davomida −15%")}</span></div>
      <div className="card" style={{padding: '22px', display: 'flex', flexDirection: 'column', gap: '6px'}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z"></path><path d="M9 13l12-9"></path></svg><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("Telegram bot")}</b><span className="muted" style={{fontSize: '14px'}}>{tr("Ulasangiz — +[N] ball")}</span></div>
    </div>
  </section>

  <section className="card pad-m" style={{marginTop: '16px', padding: '28px'}} aria-label={tr("Savollar")}>
    <b className="h" style={{fontSize: '24px'}}>{tr("Shartlar qisqacha")}</b>
    <div data-g="2" style={{display: 'grid', gap: '0 32px', marginTop: '10px', fontSize: '15px', lineHeight: '1.55'}}>
      <p style={{margin: '10px 0'}}><b style={{fontWeight: '600'}}>{tr("Ball qachon tushadi?")}</b><br /><span className="muted">{tr("Buyurtma yetkazilganidan keyin [N] kun ichida.")}</span></p>
      <p style={{margin: '10px 0'}}><b style={{fontWeight: '600'}}>{tr("Qancha ishlatsa boʻladi?")}</b><br /><span className="muted">{tr("Buyurtma summasining [N]% igacha.")}</span></p>
      <p style={{margin: '10px 0'}}><b style={{fontWeight: '600'}}>{tr("Ball yonib ketadimi?")}</b><br /><span className="muted">{tr("[N] oy xarid qilmasangiz — ha. Oldindan Telegramda eslatamiz.")}</span></p>
      <p style={{margin: '10px 0'}}><b style={{fontWeight: '600'}}>{tr("Aksiyadagi mahsulotga-chi?")}</b><br /><span className="muted">{tr("Ball yigʻiladi, lekin promokod bilan birga ishlatilmaydi.")}</span></p>
    </div>
  </section>
</div>
  )
}
