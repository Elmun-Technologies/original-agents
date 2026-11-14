// Generated from design/preview/Consultant.html by scripts/gen-page.py, then edited by hand.
import Link from 'next/link'

export type PageProps = { tr: (s: string) => string; L: (p: string) => string; C: (i: number) => React.ReactNode }

export function ConsultantPage({ tr, L, C }: PageProps) {
  return (
<div className="wrap" style={{marginTop: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start'}}>
  <section className="card" style={{flex: '999 1 760px', minWidth: '0', display: 'flex', flexDirection: 'column', minHeight: '760px'}} aria-label={tr("Maslahatchi bilan suhbat")}>
    <div style={{display: 'flex', gap: '12px', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #EFE9E3'}}>
      <span style={{width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden'}}><img className="ph" src="/img/face-white.jpg" alt="" style={{objectPosition: '50% 25%'}} /></span>
      <span style={{flex: '1'}}><b style={{fontWeight: '600'}}>{tr("Yeppo maslahatchisi")}</b><br /><span className="muted" style={{fontSize: '13px'}}>{tr("Sunʼiy intellekt · tibbiy tashxis qoʻymaydi")}</span></span>
      <button className="pill ghost" style={{minHeight: '40px'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6"></path><path d="M4 4v4h4"></path></svg> {tr("Boshidan")}</button>
    </div>
    <div style={{flex: '1', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#F6F3EF'}}>
      
        <div style={{display: 'flex', justifyContent: 'flex-start'}}>
          <div style={{maxWidth: '560px', padding: '14px 18px', borderRadius: '22px 22px 22px 6px', background: '#FBFAF7', color: '#2A211E', fontSize: '15px', lineHeight: '1.55'}}>{tr("Salom! Men sizga mos parvarishni tanlashga yordam beraman. Avval oddiy savol: yuvinib, hech narsa surtmasangiz, 1–2 soatdan keyin teringiz qanday boʻladi?")}</div>
        </div>
      
        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
          <div style={{maxWidth: '560px', padding: '14px 18px', borderRadius: '22px 22px 6px 22px', background: '#2A211E', color: '#FBFAF7', fontSize: '15px', lineHeight: '1.55'}}>{tr("Tez qizaradi, achishadi")}</div>
        </div>
      
        <div style={{display: 'flex', justifyContent: 'flex-start'}}>
          <div style={{maxWidth: '560px', padding: '14px 18px', borderRadius: '22px 22px 22px 6px', background: '#FBFAF7', color: '#2A211E', fontSize: '15px', lineHeight: '1.55'}}>{tr("Tushunarli. Hozir eng koʻp nima bezovta qilyapti? Bittasini tanlang — keyin boshqasiga ham qaytamiz.")}</div>
        </div>
      
        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
          <div style={{maxWidth: '560px', padding: '14px 18px', borderRadius: '22px 22px 6px 22px', background: '#2A211E', color: '#FBFAF7', fontSize: '15px', lineHeight: '1.55'}}>{tr("Qizarish va toshmalar")}</div>
        </div>
      
        <div style={{display: 'flex', justifyContent: 'flex-start'}}>
          <div style={{maxWidth: '560px', padding: '14px 18px', borderRadius: '22px 22px 22px 6px', background: '#FBFAF7', color: '#2A211E', fontSize: '15px', lineHeight: '1.55'}}>{tr("Oxirgi savol: ertalab parvarishga qancha vaqt ajratasiz?")}</div>
        </div>
      
      
    </div>
    <div style={{padding: '16px 24px', borderTop: '1px solid #EFE9E3', display: 'flex', flexDirection: 'column', gap: '10px'}}>
      <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap'}}><button className="pill line" style={{minHeight: '44px'}}>{tr("1–2 daqiqa, tezroq")}</button><button className="pill line" style={{minHeight: '44px'}}>{tr("5 daqiqa normal")}</button><button className="pill line" style={{minHeight: '44px'}}>{tr("Yoqtiraman, 10+ daqiqa")}</button></div>
      <div style={{display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 6px 6px 18px', borderRadius: '999px', background: '#fff', border: '1px solid #E2DAD2'}}>
        <input className="inp" placeholder={tr("Yoki oʻz soʻzingiz bilan yozing…")} aria-label={tr("Xabar")} style={{border: 'none', background: 'transparent', flex: '1', minHeight: '0', padding: '10px 0'}} />
        <button className="ib" style={{background: '#2A211E', color: '#FBFAF7'}} aria-label={tr("Yuborish")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7"></path><path d="M8 7h9v9"></path></svg></button>
      </div>
    </div>
  </section>

  <aside style={{flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '20px'}}>
    <div className="card" style={{padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
      <b style={{fontWeight: '600'}}>{tr("Siz haqingizda tushunganim")}</b>
      <span style={{display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px', padding: '6px 0', borderTop: '1px solid #EFE9E3'}}><span className="muted">{tr("Teri turi")}</span><b style={{fontWeight: '600', textAlign: 'right'}}>{tr("Sezgir")}</b></span><span style={{display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px', padding: '6px 0', borderTop: '1px solid #EFE9E3'}}><span className="muted">{tr("Asosiy muammo")}</span><b style={{fontWeight: '600', textAlign: 'right'}}>{tr("Qizarish")}</b></span><span style={{display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px', padding: '6px 0', borderTop: '1px solid #EFE9E3'}}><span className="muted">{tr("Vaqt")}</span><b style={{fontWeight: '600', textAlign: 'right'}}>—</b></span>
      <span className="muted" style={{fontSize: '12px'}}>{tr("Bu maʼlumot faqat tanlash uchun. Kabinetda saqlash — sizning xohishingiz.")}</span>
    </div>
    <div className="card" style={{padding: '22px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#F6F3EF'}}>
      <span style={{display: 'flex', gap: '8px', alignItems: 'center'}}><b style={{fontWeight: '600'}}>{tr("Selfi orqali tahlil")}</b><span className="chip">{tr("Tez orada")}</span></span>
      <span className="muted" style={{fontSize: '13px', lineHeight: '1.5'}}>{tr("Yuridik tekshiruvdan keyin yoqiladi: rozilik bilan, rasm tahlildan soʻng oʻchiriladi, maʼlumot Oʻzbekistonda saqlanadi.")}</span>
    </div>
    <div className="card" style={{padding: '22px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
      <b style={{fontWeight: '600'}}>{tr("Odamga yozmoqchimisiz?")}</b>
      <span className="muted" style={{fontSize: '13px'}}>{tr("Kosmetolog-konsultantimiz Telegramda, 9:00–21:00")}</span>
      <a href="https://t.me/" className="pill line" style={{alignSelf: 'flex-start'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z"></path><path d="M9 13l12-9"></path></svg> {tr("Telegramda yozish")}</a>
    </div>
  </aside>
</div>
  )
}
