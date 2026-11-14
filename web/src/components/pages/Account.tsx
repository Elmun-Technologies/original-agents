// Generated from design/preview/Account.html by scripts/gen-page.py, then edited by hand.
import Link from 'next/link'

export type PageProps = { tr: (s: string) => string; L: (p: string) => string; C: (i: number) => React.ReactNode }

export function AccountPage({ tr, L, C }: PageProps) {
  return (
<div className="wrap" style={{marginTop: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start'}}>
  <aside className="card" style={{flex: '1 1 280px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'sticky', top: '20px'}}>
    <span style={{display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px'}}><span style={{width: '52px', height: '52px', borderRadius: '50%', background: '#F2D6D0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: "500 22px 'Inter Tight'"}}>{tr("M")}</span><span><b style={{fontWeight: '600', fontSize: '17px'}}>{tr("Salom, Malika")}</b><br /><span className="muted" style={{fontSize: '13px'}}>+998 90 ••• •• 12</span></span></span>
    <nav role="tablist" aria-orientation="vertical" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
      <button role="tab" aria-selected="true" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '46px', padding: '0 14px', borderRadius: '14px', border: 'none', background: '#2A211E', color: '#FBFAF7', cursor: 'pointer', font: 'inherit', fontSize: '15px', textAlign: 'left'}}>{tr("Buyurtmalar")}<span style={{fontSize: '13px', opacity: '.7'}}>3</span></button><button role="tab" aria-selected="false" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '46px', padding: '0 14px', borderRadius: '14px', border: 'none', background: 'transparent', color: '#2A211E', cursor: 'pointer', font: 'inherit', fontSize: '15px', textAlign: 'left'}}>{tr("Sevimlilar")}<span style={{fontSize: '13px', opacity: '.7'}}>3</span></button><button role="tab" aria-selected="false" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '46px', padding: '0 14px', borderRadius: '14px', border: 'none', background: 'transparent', color: '#2A211E', cursor: 'pointer', font: 'inherit', fontSize: '15px', textAlign: 'left'}}>{tr("Teri profilim")}<span style={{fontSize: '13px', opacity: '.7'}}></span></button><button role="tab" aria-selected="false" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '46px', padding: '0 14px', borderRadius: '14px', border: 'none', background: 'transparent', color: '#2A211E', cursor: 'pointer', font: 'inherit', fontSize: '15px', textAlign: 'left'}}>{tr("Saqlangan rutina")}<span style={{fontSize: '13px', opacity: '.7'}}></span></button><button role="tab" aria-selected="false" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '46px', padding: '0 14px', borderRadius: '14px', border: 'none', background: 'transparent', color: '#2A211E', cursor: 'pointer', font: 'inherit', fontSize: '15px', textAlign: 'left'}}>{tr("Manzillar")}<span style={{fontSize: '13px', opacity: '.7'}}>1</span></button>
    </nav>
    <a href="https://t.me/" className="pill line" style={{marginTop: '12px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z"></path><path d="M9 13l12-9"></path></svg> {tr("Telegram botni ulash")}</a>
  </aside>

  <div style={{flex: '999 1 760px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '12px'}}>
    <section style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px'}}>
      <div className="card" style={{padding: '22px', background: '#F2D6D0', display: 'flex', flexDirection: 'column', gap: '4px'}}><span className="eyebrow" style={{color: '#2A211E'}}>{tr("Bonus ballar")}</span><span className="num" style={{fontSize: '36px'}}>{tr("[N]")}</span><span style={{fontSize: '13px'}}>{tr("1 ball = 1 soʻm · keyingi xaridda ishlatasiz")}</span></div>
      <div className="card" style={{padding: '22px', display: 'flex', flexDirection: 'column', gap: '4px'}}><span className="eyebrow">{tr("Yoʻldagi buyurtma")}</span><b style={{fontWeight: '600', fontSize: '18px'}}>{tr("№ [12345] · ertaga")}</b><Link href={L("/kabinet")} style={{fontSize: '14px', fontWeight: '600'}}>{tr("Kuzatish ›")}</Link></div>
      <div className="card" style={{padding: '22px', display: 'flex', flexDirection: 'column', gap: '4px', background: '#E8F0E4'}}><span className="eyebrow" style={{color: '#2F5228'}}>{tr("Eslatma")}</span><b style={{fontWeight: '600', fontSize: '16px'}}>{tr("Centella ampulangiz ~2 haftada tugaydi")}</b><button className="pill dark" style={{alignSelf: 'flex-start', minHeight: '40px', marginTop: '6px'}}>{tr("Yana buyurtma")}</button></div>
    </section>

    
      <section className="card pad-m" style={{padding: '28px'}} aria-labelledby="o-h">
        <h1 id="o-h" className="h" style={{fontSize: '30px'}}>{tr("Buyurtmalarim")}</h1>
        
          <div style={{display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', padding: '18px 0', borderTop: '1px solid #EFE9E3', marginTop: '14px'}}>
            <span style={{display: 'flex'}}>
              <img src="/img/p-centella-amp.jpg" alt="" style={{width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover', border: '2px solid #FBFAF7', marginRight: '-12px'}} /><img src="/img/p-boj-glow.jpg" alt="" style={{width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover', border: '2px solid #FBFAF7', marginRight: '-12px'}} />
            </span>
            <span style={{flex: '1 1 240px', marginLeft: '14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontWeight: '600'}}>{tr("№ [12345] · bugun")}</b><span className="muted" style={{fontSize: '13px'}}>{tr("SKIN1004, Beauty of Joseon")}</span></span>
            <span className="chip" style={{background: '#F5DCC9'}}>{tr("Yoʻlda")}</span>
            <span className="num" style={{fontSize: '18px', minWidth: '120px', textAlign: 'right'}}>{tr("418 000 soʻm")}</span>
            <button className="pill line" style={{minHeight: '42px'}}>{tr("Yana buyurtma")}</button>
          </div>
        
          <div style={{display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', padding: '18px 0', borderTop: '1px solid #EFE9E3', marginTop: '14px'}}>
            <span style={{display: 'flex'}}>
              <img src="/img/spf-missha.jpg" alt="" style={{width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover', border: '2px solid #FBFAF7', marginRight: '-12px'}} /><img src="/img/centella-hand.jpg" alt="" style={{width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover', border: '2px solid #FBFAF7', marginRight: '-12px'}} />
            </span>
            <span style={{flex: '1 1 240px', marginLeft: '14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontWeight: '600'}}>{tr("№ [12201] · 12 oktabr")}</b><span className="muted" style={{fontSize: '13px'}}>{tr("MISSHA, SKIN1004")}</span></span>
            <span className="chip" style={{background: '#E8F0E4'}}>{tr("Yetkazildi")}</span>
            <span className="num" style={{fontSize: '18px', minWidth: '120px', textAlign: 'right'}}>{tr("378 000 soʻm")}</span>
            <button className="pill line" style={{minHeight: '42px'}}>{tr("Yana buyurtma")}</button>
          </div>
        
          <div style={{display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', padding: '18px 0', borderTop: '1px solid #EFE9E3', marginTop: '14px'}}>
            <span style={{display: 'flex'}}>
              <img src="/img/p-cosdebaha.jpg" alt="" style={{width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover', border: '2px solid #FBFAF7', marginRight: '-12px'}} />
            </span>
            <span style={{flex: '1 1 240px', marginLeft: '14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontWeight: '600'}}>{tr("№ [11987] · 3 sentabr")}</b><span className="muted" style={{fontSize: '13px'}}>{tr("Cos De BAHA")}</span></span>
            <span className="chip" style={{background: '#E8F0E4'}}>{tr("Yetkazildi")}</span>
            <span className="num" style={{fontSize: '18px', minWidth: '120px', textAlign: 'right'}}>{tr("159 000 soʻm")}</span>
            <button className="pill line" style={{minHeight: '42px'}}>{tr("Yana buyurtma")}</button>
          </div>
        
      </section>
    

    

    

    

    
  </div>
</div>
  )
}
