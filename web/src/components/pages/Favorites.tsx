// Generated from design/preview/Favorites.html by scripts/gen-page.py, then edited by hand.
import Link from 'next/link'

export type PageProps = { tr: (s: string) => string; L: (p: string) => string; C: (i: number) => React.ReactNode }

export function FavoritesPage({ tr, L, C }: PageProps) {
  return (
<div className="wrap" style={{marginTop: '20px'}}>
  <section className="sec-h" style={{alignItems: 'flex-end'}}>
    <div><h1 className="h h1" style={{fontSize: '44px'}}>{tr("Sevimlilar")} <span className="muted" style={{fontSize: '22px'}}>4</span></h1><p className="muted" style={{margin: '6px 0 0', fontSize: '15px'}}>{tr("Shu yerda saqlanadi. Narx tushsa yoki tugagan mahsulot kelsa — Telegramda aytamiz.")}</p></div>
    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}><button className="pill line"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="2"></rect><path d="M12 9v12M3 13h18M12 9c-2-4-6-4-6-1s6 1 6 1 6 2 6-1-4-3-6 1"></path></svg> {tr("Sovgʻa roʻyxati sifatida ulashish")}</button><button className="pill dark"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2L5 8z"></path><path d="M9 8a3 3 0 0 1 6 0"></path></svg> {tr("Borlarini savatga")}</button></div>
  </section>

  
    <section style={{marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
      
        <div className="card" data-g="fav" style={{padding: '14px', display: 'grid', gap: '20px', alignItems: 'center'}}>
          <Link href={L("/katalog/serum")} className="zoom" style={{display: 'block', width: '120px', height: '120px', borderRadius: '18px', overflow: 'hidden'}}><img className="ph" src="/img/p-boj-glow.jpg" alt={tr("Beauty of Joseon Revive Serum: Ginseng + Snail Mucin")} /></Link>
          <span style={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '0'}}>
            <span className="chip" style={{alignSelf: 'flex-start', background: '#E8F0E4', color: '#2F5228'}}>{tr("Narxi tushdi: −20 000 soʻm")}</span>
            <Link href={L("/katalog/serum")} style={{textDecoration: 'none', fontSize: '17px'}}><b style={{fontWeight: '600'}}>{tr("Beauty of Joseon")}</b> {tr("Revive Serum: Ginseng + Snail Mucin")}</Link>
            <span className="muted" style={{fontSize: '13px'}}>{tr("Tiklaydi va namlaydi ·")} <span className="stars">★</span> 4,8</span>
          </span>
          <span style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px'}}>
            <span style={{display: 'flex', gap: '8px', alignItems: 'baseline'}}><span className="num" style={{fontSize: '22px'}}>{tr("219 000 soʻm")}</span></span>
            <span style={{display: 'flex', gap: '6px'}}><button className="ib" aria-label={tr("Oʻchirish")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button><button className="pill dark" style={{minHeight: '46px'}}>{tr("Savatga")}</button></span>
          </span>
        </div>
      
        <div className="card" data-g="fav" style={{padding: '14px', display: 'grid', gap: '20px', alignItems: 'center'}}>
          <Link href={L("/katalog/serum")} className="zoom" style={{display: 'block', width: '120px', height: '120px', borderRadius: '18px', overflow: 'hidden'}}><img className="ph" src="/img/p-mixsoon.jpg" alt={tr("mixsoon Galactomyces Ferment Essence")} /></Link>
          <span style={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '0'}}>
            <span className="chip" style={{alignSelf: 'flex-start', background: '#F0EBE5', color: '#6B5F59'}}>{tr("Tugab qoldi · [N] kunda keladi")}</span>
            <Link href={L("/katalog/serum")} style={{textDecoration: 'none', fontSize: '17px'}}><b style={{fontWeight: '600'}}>{tr("mixsoon")}</b> {tr("Galactomyces Ferment Essence")}</Link>
            <span className="muted" style={{fontSize: '13px'}}>{tr("Yengil namlik, tekis rang ·")} <span className="stars">★</span> 4,8</span>
          </span>
          <span style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px'}}>
            <span style={{display: 'flex', gap: '8px', alignItems: 'baseline'}}><span className="num" style={{fontSize: '22px'}}>{tr("279 000 soʻm")}</span></span>
            <span style={{display: 'flex', gap: '6px'}}><button className="ib" aria-label={tr("Oʻchirish")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button><button className="pill line" style={{minHeight: '46px'}}>{tr("Kelganda xabar berish")}</button></span>
          </span>
        </div>
      
        <div className="card" data-g="fav" style={{padding: '14px', display: 'grid', gap: '20px', alignItems: 'center'}}>
          <Link href={L("/katalog/serum")} className="zoom" style={{display: 'block', width: '120px', height: '120px', borderRadius: '18px', overflow: 'hidden'}}><img className="ph" src="/img/spf-missha.jpg" alt={tr("MISSHA All Around Safe Block Essence Sun")} /></Link>
          <span style={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '0'}}>
            <span className="chip" style={{alignSelf: 'flex-start', background: '#F5DCC9', color: '#2A211E'}}>{tr("Faqat 3 dona qoldi")}</span>
            <Link href={L("/katalog/serum")} style={{textDecoration: 'none', fontSize: '17px'}}><b style={{fontWeight: '600'}}>{tr("MISSHA")}</b> {tr("All Around Safe Block Essence Sun")}</Link>
            <span className="muted" style={{fontSize: '13px'}}>{tr("Har kungi yengil SPF ·")} <span className="stars">★</span> 4,8</span>
          </span>
          <span style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px'}}>
            <span style={{display: 'flex', gap: '8px', alignItems: 'baseline'}}><span className="num" style={{fontSize: '22px'}}>{tr("149 000 soʻm")}</span><span className="old">169 000</span></span>
            <span style={{display: 'flex', gap: '6px'}}><button className="ib" aria-label={tr("Oʻchirish")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button><button className="pill dark" style={{minHeight: '46px'}}>{tr("Savatga")}</button></span>
          </span>
        </div>
      
        <div className="card" data-g="fav" style={{padding: '14px', display: 'grid', gap: '20px', alignItems: 'center'}}>
          <Link href={L("/katalog/serum")} className="zoom" style={{display: 'block', width: '120px', height: '120px', borderRadius: '18px', overflow: 'hidden'}}><img className="ph" src="/img/sheet-mask.jpg" alt={tr("Mediheal Tea Tree Essential Mask, 10 dona")} /></Link>
          <span style={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '0'}}>
            <span className="chip" style={{alignSelf: 'flex-start', background: '#F2D6D0', color: '#A8475C'}}>{tr("Aksiyada −13%")}</span>
            <Link href={L("/katalog/serum")} style={{textDecoration: 'none', fontSize: '17px'}}><b style={{fontWeight: '600'}}>{tr("Mediheal")}</b> {tr("Tea Tree Essential Mask, 10 dona")}</Link>
            <span className="muted" style={{fontSize: '13px'}}>{tr("Toshma va yogʻni tinchlantiradi ·")} <span className="stars">★</span> 4,7</span>
          </span>
          <span style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px'}}>
            <span style={{display: 'flex', gap: '8px', alignItems: 'baseline'}}><span className="num" style={{fontSize: '22px'}}>{tr("129 000 soʻm")}</span><span className="old">149 000</span></span>
            <span style={{display: 'flex', gap: '6px'}}><button className="ib" aria-label={tr("Oʻchirish")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button><button className="pill dark" style={{minHeight: '46px'}}>{tr("Savatga")}</button></span>
          </span>
        </div>
      
    </section>
  
  

  <section style={{marginTop: '32px'}} aria-labelledby="sim-h">
    <h2 id="sim-h" className="h h2" style={{fontSize: '30px', marginBottom: '16px'}}>{tr("Saqlaganlaringizga oʻxshash")}</h2>
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
