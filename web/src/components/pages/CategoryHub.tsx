// Generated from design/preview/CategoryHub.html by scripts/gen-page.py, then edited by hand.
import Link from 'next/link'

export type PageProps = { tr: (s: string) => string; L: (p: string) => string; C: (i: number) => React.ReactNode }

export function CategoryHubPage({ tr, L, C, tabs }: PageProps & { tabs: React.ReactNode }) {
  return (
<div className="wrap" style={{marginTop: '16px'}}>
  <nav aria-label={tr("Yoʻl")} className="muted" style={{fontSize: '13px', display: 'flex', gap: '8px'}}><Link href={L("/")} style={{color: '#6B5F59'}}>{tr("Bosh sahifa")}</Link><span>/</span><span style={{color: '#2A211E'}}>{tr("Yuz parvarishi")}</span></nav>
  <section style={{display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '10px'}}>
    <div style={{flex: '1 1 560px'}}><h1 className="h h1" style={{fontSize: '52px'}}>{tr("Yuz parvarishi")}</h1><p style={{margin: '10px 0 0', fontSize: '17px', lineHeight: '1.6', color: '#4A3F3A', maxWidth: '640px'}}>{tr("Koreyscha parvarish — bu 10 ta qadam emas. Teringizga keraklisini tanlaysiz. Turdan, muammodan yoki tayyor rutinadan boshlang — qaysi biri qulay boʻlsa.")}</p></div>
    <Link href={L("/maslahatchi")} className="pill dark" style={{minHeight: '52px'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path></svg> {tr("1 daqiqada tanlab beray")}</Link>
  </section>

  <section data-g="7" style={{marginTop: '22px', display: 'grid', gap: '10px'}} aria-label={tr("Turlar")}>
    
      <Link href={L("/katalog/tozalash")} className="card zoom" style={{textDecoration: 'none', display: 'flex', flexDirection: 'column'}}><span style={{display: 'block', aspectRatio: '1/1', overflow: 'hidden'}}><img className="ph" src="/img/gel.jpg" alt="" /></span><span style={{padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontWeight: '600', fontSize: '15px'}}>{tr("Tozalovchilar")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("Gel, koʻpik, yogʻ")}</span></span></Link>
    
      <Link href={L("/katalog/toner")} className="card zoom" style={{textDecoration: 'none', display: 'flex', flexDirection: 'column'}}><span style={{display: 'block', aspectRatio: '1/1', overflow: 'hidden'}}><img className="ph" src="/img/centella-hand.jpg" alt="" /></span><span style={{padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontWeight: '600', fontSize: '15px'}}>{tr("Tonerlar")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("Va toner-padlar")}</span></span></Link>
    
      <Link href={L("/katalog/essensiya")} className="card zoom" style={{textDecoration: 'none', display: 'flex', flexDirection: 'column'}}><span style={{display: 'block', aspectRatio: '1/1', overflow: 'hidden'}}><img className="ph" src="/img/p-mixsoon.jpg" alt="" /></span><span style={{padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontWeight: '600', fontSize: '15px'}}>{tr("Essensiyalar")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("Yengil namlik")}</span></span></Link>
    
      <Link href={L("/katalog/serum")} className="card zoom" style={{textDecoration: 'none', display: 'flex', flexDirection: 'column'}}><span style={{display: 'block', aspectRatio: '1/1', overflow: 'hidden'}}><img className="ph" src="/img/p-boj-glow.jpg" alt="" /></span><span style={{padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontWeight: '600', fontSize: '15px'}}>{tr("Serumlar")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("Aniq muammo uchun")}</span></span></Link>
    
      <Link href={L("/katalog/krem")} className="card zoom" style={{textDecoration: 'none', display: 'flex', flexDirection: 'column'}}><span style={{display: 'block', aspectRatio: '1/1', overflow: 'hidden'}}><img className="ph" src="/img/cream-smear.jpg" alt="" /></span><span style={{padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontWeight: '600', fontSize: '15px'}}>{tr("Kremlar")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("Namlik qulfi")}</span></span></Link>
    
      <Link href={L("/katalog/spf")} className="card zoom" style={{textDecoration: 'none', display: 'flex', flexDirection: 'column'}}><span style={{display: 'block', aspectRatio: '1/1', overflow: 'hidden'}}><img className="ph" src="/img/spf-missha.jpg" alt="" /></span><span style={{padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontWeight: '600', fontSize: '15px'}}>{tr("SPF")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("Har kuni")}</span></span></Link>
    
      <Link href={L("/katalog/niqoblar")} className="card zoom" style={{textDecoration: 'none', display: 'flex', flexDirection: 'column'}}><span style={{display: 'block', aspectRatio: '1/1', overflow: 'hidden'}}><img className="ph" src="/img/sheet-mask.jpg" alt="" /></span><span style={{padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontWeight: '600', fontSize: '15px'}}>{tr("Niqoblar")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("Haftasiga 2–3 marta")}</span></span></Link>
    
  </section>

  <section className="card pad-m" style={{marginTop: '16px', padding: '28px'}} aria-labelledby="pr-h">
    <div className="sec-h" style={{alignItems: 'flex-end'}}><div><span className="eyebrow">{tr("Muammodan boshlang")}</span><h2 id="pr-h" className="h h2" style={{fontSize: '32px', marginTop: '6px'}}>{tr("Nima bezovta qilyapti?")}</h2></div><Link href={L("/katalog/serum")} className="pill line">{tr("Hammasini katalogda")} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg></Link></div>
    {tabs}
  </section>

  <section style={{marginTop: '32px'}} aria-labelledby="st-h">
    <h2 id="st-h" className="h h2" style={{fontSize: '32px'}}>{tr("Koreyscha tartib — 5 qadamda")}</h2>
    <p className="muted" style={{margin: '6px 0 16px', fontSize: '15px'}}>{tr("Hammasi shart emas. Boshlash uchun 1, 3 va 5-qadam yetadi.")}</p>
    <ol data-g="5" style={{listStyle: 'none', margin: '0', padding: '0', display: 'grid', gap: '10px'}}>
      
        <li className="card" style={{padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#F2D6D0'}}><span className="num" style={{fontSize: '30px', color: '#A8475C'}}>01</span><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("Tozalash")}</b><span style={{fontSize: '13px', lineHeight: '1.5'}} className="muted">{tr("Ertalab va kechqurun yumshoq gel bilan")}</span><span className="chip" style={{alignSelf: 'flex-start', marginTop: 'auto'}}>{tr("Shart")}</span></li>
      
        <li className="card" style={{padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#FBFAF7'}}><span className="num" style={{fontSize: '30px', color: '#A8475C'}}>02</span><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("Toner")}</b><span style={{fontSize: '13px', lineHeight: '1.5'}} className="muted">{tr("pH ni tiklaydi, keyingi qadamga tayyorlaydi")}</span><span className="chip" style={{alignSelf: 'flex-start', marginTop: 'auto'}}>{tr("Tavsiya")}</span></li>
      
        <li className="card" style={{padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#F2D6D0'}}><span className="num" style={{fontSize: '30px', color: '#A8475C'}}>03</span><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("Serum yoki ampula")}</b><span style={{fontSize: '13px', lineHeight: '1.5'}} className="muted">{tr("Sizning asosiy muammongiz uchun")}</span><span className="chip" style={{alignSelf: 'flex-start', marginTop: 'auto'}}>{tr("Shart")}</span></li>
      
        <li className="card" style={{padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#FBFAF7'}}><span className="num" style={{fontSize: '30px', color: '#A8475C'}}>04</span><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("Krem")}</b><span style={{fontSize: '13px', lineHeight: '1.5'}} className="muted">{tr("Namlikni ushlab qoladi")}</span><span className="chip" style={{alignSelf: 'flex-start', marginTop: 'auto'}}>{tr("Tavsiya")}</span></li>
      
        <li className="card" style={{padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#F2D6D0'}}><span className="num" style={{fontSize: '30px', color: '#A8475C'}}>05</span><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("SPF")}</b><span style={{fontSize: '13px', lineHeight: '1.5'}} className="muted">{tr("Faqat ertalab, har kuni")}</span><span className="chip" style={{alignSelf: 'flex-start', marginTop: 'auto'}}>{tr("Shart")}</span></li>
      
    </ol>
  </section>

  <section style={{marginTop: '32px'}} aria-labelledby="bs-h">
    <div className="sec-h"><h2 id="bs-h" className="h h2" style={{fontSize: '32px'}}>{tr("Bu boʻlimda eng koʻp olinadi")}</h2><Link href={L("/aksiyalar")} className="pill line">{tr("Top-10")} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg></Link></div>
    <div className="pgrid">
{C(0)}

{C(1)}

{C(2)}

{C(3)}

{C(4)}
</div>
  </section>

  <section data-g="3" style={{marginTop: '32px', display: 'grid', gap: '12px'}} aria-label={tr("Qoʻllanmalar")}>
    <Link href={L("/jurnal/yogli-teri")} className="card zoom" style={{textDecoration: 'none', display: 'flex', gap: '14px', padding: '14px', alignItems: 'center'}}><img src="/img/tex-3.jpg" alt="" style={{width: '96px', height: '96px', borderRadius: '16px', objectFit: 'cover'}} /><span><span className="eyebrow">{tr("Qoʻllanma")}</span><br /><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("Yogʻli teri uchun koreys parvarishi")}</b></span></Link>
    <Link href={L("/jurnal/essensiya-serum-ampula")} className="card zoom" style={{textDecoration: 'none', display: 'flex', gap: '14px', padding: '14px', alignItems: 'center'}}><img src="/img/serum-eucalyptus.jpg" alt="" style={{width: '96px', height: '96px', borderRadius: '16px', objectFit: 'cover'}} /><span><span className="eyebrow">{tr("Tushuntirish")}</span><br /><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("Essensiya, serum, ampula — farqi nima?")}</b></span></Link>
    <Link href={L("/jurnal/spf-qishda")} className="card zoom" style={{textDecoration: 'none', display: 'flex', gap: '14px', padding: '14px', alignItems: 'center'}}><img src="/img/spf-arm.jpg" alt="" style={{width: '96px', height: '96px', borderRadius: '16px', objectFit: 'cover'}} /><span><span className="eyebrow">{tr("SPF")}</span><br /><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("Qishda ham SPF kerakmi?")}</b></span></Link>
  </section>

  <section className="card pad-m" style={{marginTop: '16px', padding: '28px', fontSize: '14px', lineHeight: '1.7', color: '#6B5F59'}}>
    <h2 className="h" style={{fontSize: '22px', color: '#2A211E', marginBottom: '8px'}}>{tr("Toshkentda koreys yuz parvarishi vositalari")}</h2>
    {tr("Yeppo — Koreyadan toʻgʻridan-toʻgʻri keltirilgan yuz parvarishi vositalari: tozalovchilar, tonerlar, essensiyalar, serum va ampulalar, kremlar va SPF. Har bir mahsulot sahifasida partiya raqami va yaroqlilik muddati koʻrsatilgan. Toshkent boʻylab ertaga, viloyatlarga [N] kunda yetkazamiz.")}
  </section>
</div>
  )
}
