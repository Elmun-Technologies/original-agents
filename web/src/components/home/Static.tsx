// Generated from design/preview/Main.html by scripts/html2jsx.py --i18n, then edited by hand.
import Link from 'next/link'

type P = { tr: (s: string) => string; L: (p: string) => string }

export function Guarantees({ tr, tn, store }: { tr: P['tr']; tn: (s: string, ...n: (string | number)[]) => string; store: { tashkentDays: number; returnDays: number } }) {
  return (
<section className="wrap" style={{marginTop: '12px'}} aria-label={tr("Kafolatlar")}>
  <div className="card" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', padding: '6px'}}>
    
      <div style={{display: 'flex', gap: '12px', alignItems: 'center', padding: '14px 18px'}}>
        <span style={{width: '42px', height: '42px', borderRadius: '50%', background: '#F2D6D0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5"></path></svg></span>
        <span style={{display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontSize: '14px', fontWeight: '600'}}>{tr("Faqat original")}</b><span className="muted" style={{fontSize: '13px'}}>{tr("Partiya va muddat har sahifada")}</span></span>
      </div>
    
      <div style={{display: 'flex', gap: '12px', alignItems: 'center', padding: '14px 18px'}}>
        <span style={{width: '42px', height: '42px', borderRadius: '50%', background: '#F2D6D0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"></path></svg></span>
        <span style={{display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontSize: '14px', fontWeight: '600'}}>{tr("Tez yetkazish")}</b><span className="muted" style={{fontSize: '13px'}}>{tn("Toshkent boʻylab [N] kunda", store.tashkentDays)}</span></span>
      </div>
    
      <div style={{display: 'flex', gap: '12px', alignItems: 'center', padding: '14px 18px'}}>
        <span style={{width: '42px', height: '42px', borderRadius: '50%', background: '#F2D6D0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18v12H3zM3 10h18"></path></svg></span>
        <span style={{display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontSize: '14px', fontWeight: '600'}}>{tr("Qulay toʻlov")}</b><span className="muted" style={{fontSize: '13px'}}>{tr("Click, Payme, Uzcard, Humo")}</span></span>
      </div>
    
      <div style={{display: 'flex', gap: '12px', alignItems: 'center', padding: '14px 18px'}}>
        <span style={{width: '42px', height: '42px', borderRadius: '50%', background: '#F2D6D0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"></path></svg></span>
        <span style={{display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{fontSize: '14px', fontWeight: '600'}}>{tr("Qaytarish oson")}</b><span className="muted" style={{fontSize: '13px'}}>{tn("[N] kun ichida, savolsiz", store.returnDays)}</span></span>
      </div>
    
  </div>
</section>
  )
}

export function Categories({ tr, L }: P) {
  return (
<section className="wrap" style={{marginTop: '28px'}} aria-labelledby="cats-h">
  <h2 id="cats-h" className="sr">{tr("Toifalar")}</h2>
  <div className="hs" style={{justifyContent: 'space-between'}}>
    
      <Link href={L("/katalog/serum")} className="zoom" style={{flex: 'none', width: '128px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none', textAlign: 'center'}}>
        <span style={{width: '112px', height: '112px', borderRadius: '50%', overflow: 'hidden', background: '#F2D6D0', display: 'block'}}><img loading="lazy" decoding="async" className="ph" src="/img/p-centella-duo.jpg" alt="" style={{objectPosition: '50% 50%'}} /></span>
        <span style={{fontSize: '14px', fontWeight: '500'}}>{tr("Serum va ampula")}</span>
      </Link>
    
      <Link href={L("/katalog/toner")} className="zoom" style={{flex: 'none', width: '128px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none', textAlign: 'center'}}>
        <span style={{width: '112px', height: '112px', borderRadius: '50%', overflow: 'hidden', background: '#F2D6D0', display: 'block'}}><img loading="lazy" decoding="async" className="ph" src="/img/centella-hand.jpg" alt="" style={{objectPosition: '50% 35%'}} /></span>
        <span style={{fontSize: '14px', fontWeight: '500'}}>{tr("Toner")}</span>
      </Link>
    
      <Link href={L("/katalog/spf")} className="zoom" style={{flex: 'none', width: '128px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none', textAlign: 'center'}}>
        <span style={{width: '112px', height: '112px', borderRadius: '50%', overflow: 'hidden', background: '#F2D6D0', display: 'block'}}><img loading="lazy" decoding="async" className="ph" src="/img/spf-missha.jpg" alt="" style={{objectPosition: '50% 50%'}} /></span>
        <span style={{fontSize: '14px', fontWeight: '500'}}>{tr("SPF")}</span>
      </Link>
    
      <Link href={L("/katalog/essensiya")} className="zoom" style={{flex: 'none', width: '128px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none', textAlign: 'center'}}>
        <span style={{width: '112px', height: '112px', borderRadius: '50%', overflow: 'hidden', background: '#F2D6D0', display: 'block'}}><img loading="lazy" decoding="async" className="ph" src="/img/p-mixsoon.jpg" alt="" style={{objectPosition: '50% 50%'}} /></span>
        <span style={{fontSize: '14px', fontWeight: '500'}}>{tr("Essensiya")}</span>
      </Link>
    
      <Link href={L("/katalog/krem")} className="zoom" style={{flex: 'none', width: '128px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none', textAlign: 'center'}}>
        <span style={{width: '112px', height: '112px', borderRadius: '50%', overflow: 'hidden', background: '#F2D6D0', display: 'block'}}><img loading="lazy" decoding="async" className="ph" src="/img/jar-shadow.jpg" alt="" style={{objectPosition: '50% 60%'}} /></span>
        <span style={{fontSize: '14px', fontWeight: '500'}}>{tr("Kremlar")}</span>
      </Link>
    
      <Link href={L("/katalog/niqoblar")} className="zoom" style={{flex: 'none', width: '128px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none', textAlign: 'center'}}>
        <span style={{width: '112px', height: '112px', borderRadius: '50%', overflow: 'hidden', background: '#F2D6D0', display: 'block'}}><img loading="lazy" decoding="async" className="ph" src="/img/sheet-mask.jpg" alt="" style={{objectPosition: '50% 70%'}} /></span>
        <span style={{fontSize: '14px', fontWeight: '500'}}>{tr("Niqoblar")}</span>
      </Link>
    
      <Link href={L("/katalog/toplamlar")} className="zoom" style={{flex: 'none', width: '128px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none', textAlign: 'center'}}>
        <span style={{width: '112px', height: '112px', borderRadius: '50%', overflow: 'hidden', background: '#F2D6D0', display: 'block'}}><img loading="lazy" decoding="async" className="ph" src="/img/p-flatlay-pink.jpg" alt="" style={{objectPosition: '50% 50%'}} /></span>
        <span style={{fontSize: '14px', fontWeight: '500'}}>{tr("Toʻplamlar")}</span>
      </Link>
    
      <Link href={L("/kim-uchun/erkaklar")} className="zoom" style={{flex: 'none', width: '128px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none', textAlign: 'center'}}>
        <span style={{width: '112px', height: '112px', borderRadius: '50%', overflow: 'hidden', background: '#F2D6D0', display: 'block'}}><img loading="lazy" decoding="async" className="ph" src="/img/men-mirror.jpg" alt="" style={{objectPosition: '50% 35%'}} /></span>
        <span style={{fontSize: '14px', fontWeight: '500'}}>{tr("Erkaklar")}</span>
      </Link>
    
  </div>
</section>
  )
}

export function Segments({ tr, L }: P) {
  return (
<section className="wrap" style={{marginTop: '40px'}} aria-labelledby="who-h">
  <div className="sec-h">
    <h2 id="who-h" className="h h2" style={{fontSize: '40px'}}>{tr("Kimga")} <span className="serif">{tr("tanlaysiz?")}</span></h2>
    <Link href={L("/kim-uchun/18-25")} className="pill line">{tr("Hammasi")} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg></Link>
  </div>
  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px'}}>
    
      <Link href={L("/kim-uchun/18-25")} className="card zoom" style={{aspectRatio: '4/5', textDecoration: 'none', background: '#F2D6D0'}}>
        <img loading="lazy" decoding="async" className="ph" src="/img/face-serum.jpg" alt="" style={{position: 'absolute', inset: '0', objectPosition: '45% 30%'}} />
        <span className="glass" style={{position: 'absolute', left: '10px', right: '10px', bottom: '10px', borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{font: "600 17px 'Inter Tight', sans-serif"}}>{tr("18–25 yosh")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("Toshma, yogʻ, birinchi rutina")}</span></span>
      </Link>
    
      <Link href={L("/kim-uchun/25-35")} className="card zoom" style={{aspectRatio: '4/5', textDecoration: 'none', background: '#F2D6D0'}}>
        <img loading="lazy" decoding="async" className="ph" src="/img/woman-cream.jpg" alt="" style={{position: 'absolute', inset: '0', objectPosition: '50% 30%'}} />
        <span className="glass" style={{position: 'absolute', left: '10px', right: '10px', bottom: '10px', borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{font: "600 17px 'Inter Tight', sans-serif"}}>{tr("Ayollar 25–35")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("Namlik va nur")}</span></span>
      </Link>
    
      <Link href={L("/kim-uchun/35")} className="card zoom" style={{aspectRatio: '4/5', textDecoration: 'none', background: '#F2D6D0'}}>
        <img loading="lazy" decoding="async" className="ph" src="/img/mature-2.jpg" alt="" style={{position: 'absolute', inset: '0', objectPosition: '50% 30%'}} />
        <span className="glass" style={{position: 'absolute', left: '10px', right: '10px', bottom: '10px', borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{font: "600 17px 'Inter Tight', sans-serif"}}>{tr("35+ yosh")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("Elastiklik, pigment")}</span></span>
      </Link>
    
      <Link href={L("/kim-uchun/erkaklar")} className="card zoom" style={{aspectRatio: '4/5', textDecoration: 'none', background: '#F2D6D0'}}>
        <img loading="lazy" decoding="async" className="ph" src="/img/men-mirror.jpg" alt="" style={{position: 'absolute', inset: '0', objectPosition: '50% 35%'}} />
        <span className="glass" style={{position: 'absolute', left: '10px', right: '10px', bottom: '10px', borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{font: "600 17px 'Inter Tight', sans-serif"}}>{tr("Erkaklar")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("3 qadam, 3 daqiqa")}</span></span>
      </Link>
    
      <Link href={L("/kim-uchun/onalar")} className="card zoom" style={{aspectRatio: '4/5', textDecoration: 'none', background: '#F2D6D0'}}>
        <img loading="lazy" decoding="async" className="ph" src="/img/mom.jpg" alt="" style={{position: 'absolute', inset: '0', objectPosition: '50% 35%'}} />
        <span className="glass" style={{position: 'absolute', left: '10px', right: '10px', bottom: '10px', borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{font: "600 17px 'Inter Tight', sans-serif"}}>{tr("Boʻlajak onalar")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("Retinolsiz, ehtiyotkor")}</span></span>
      </Link>
    
      <Link href={L("/kim-uchun/osmirlar")} className="card zoom" style={{aspectRatio: '4/5', textDecoration: 'none', background: '#F2D6D0'}}>
        <img loading="lazy" decoding="async" className="ph" src="/img/spf-missha.jpg" alt="" style={{position: 'absolute', inset: '0', objectPosition: '50% 50%'}} />
        <span className="glass" style={{position: 'absolute', left: '10px', right: '10px', bottom: '10px', borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px'}}><b style={{font: "600 17px 'Inter Tight', sans-serif"}}>{tr("Oʻsmirlar")}</b><span className="muted" style={{fontSize: '12px'}}>{tr("Faqat yumshoq vositalar")}</span></span>
      </Link>
    
  </div>
</section>
  )
}

export function Journal({ tr, tn, L }: P & { tn: (s: string, ...n: (string | number)[]) => string }) {
  return (
<section className="wrap" style={{marginTop: '40px'}} aria-labelledby="j-h">
  <div className="sec-h"><h2 id="j-h" className="h h2" style={{fontSize: '40px'}}>{tr("Oldin oʻqing,")} <span className="serif">{tr("keyin oling")}</span></h2><Link href={L("/jurnal")} className="pill line">{tr("Jurnal")} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg></Link></div>
  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px'}}>
    
      <Link href={L("/jurnal/teri-turi")} className="card zoom" style={{textDecoration: 'none', display: 'flex', flexDirection: 'column'}}>
        <span style={{display: 'block', aspectRatio: '16/10', overflow: 'hidden', position: 'relative'}}><img loading="lazy" decoding="async" className="ph" src="/img/face-leaf.jpg" alt="" style={{objectPosition: '50% 30%'}} /><span className="chip glass" style={{position: 'absolute', top: '12px', left: '12px'}}>{tn("Qoʻllanma · [N] daqiqa", 4)}</span></span>
        <span style={{padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: '8px'}}><b style={{font: "600 20px/1.2 'Inter Tight', sans-serif", letterSpacing: '-0.02em'}}>{tr("Teri turingizni 2 daqiqada qanday aniqlash mumkin")}</b><span className="muted" style={{fontSize: '14px', lineHeight: '1.5'}}>{tr("Oddiy salfetka testi va 3 ta savol. Keyin nimani olish aniq boʻladi.")}</span></span>
      </Link>
    
      <Link href={L("/jurnal/spf-qishda")} className="card zoom" style={{textDecoration: 'none', display: 'flex', flexDirection: 'column'}}>
        <span style={{display: 'block', aspectRatio: '16/10', overflow: 'hidden', position: 'relative'}}><img loading="lazy" decoding="async" className="ph" src="/img/spf-arm.jpg" alt="" style={{objectPosition: '50% 50%'}} /><span className="chip glass" style={{position: 'absolute', top: '12px', left: '12px'}}>{tn("SPF · [N] daqiqa", 3)}</span></span>
        <span style={{padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: '8px'}}><b style={{font: "600 20px/1.2 'Inter Tight', sans-serif", letterSpacing: '-0.02em'}}>{tr("SPF qishda ham kerakmi? Qisqa javob — ha")}</b><span className="muted" style={{fontSize: '14px', lineHeight: '1.5'}}>{tr("Nima uchun, qaysi tekstura qulay va qancha surtish kerak.")}</span></span>
      </Link>
    
      <Link href={L("/jurnal/koreyscha-parvarish")} className="card zoom" style={{textDecoration: 'none', display: 'flex', flexDirection: 'column'}}>
        <span style={{display: 'block', aspectRatio: '16/10', overflow: 'hidden', position: 'relative'}}><img loading="lazy" decoding="async" className="ph" src="/img/gel-jar-hands.jpg" alt="" style={{objectPosition: '50% 50%'}} /><span className="chip glass" style={{position: 'absolute', top: '12px', left: '12px'}}>{tn("Rutina · [N] daqiqa", 5)}</span></span>
        <span style={{padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: '8px'}}><b style={{font: "600 20px/1.2 'Inter Tight', sans-serif", letterSpacing: '-0.02em'}}>{tr("Koreyscha parvarish: 10 qadam shartmi?")}</b><span className="muted" style={{fontSize: '14px', lineHeight: '1.5'}}>{tr("Yoʻq. Boshlash uchun 3 qadam yetarli — qaysilari, tushuntiramiz.")}</span></span>
      </Link>
    
  </div>
</section>
  )
}

export function TelegramCta({ tr, L }: P) {
  return (
<section className="wrap" style={{marginTop: '40px'}}>
  <div className="card pad-m" style={{padding: '36px', background: '#F2D6D0', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between'}}>
    <div style={{flex: '1 1 420px'}}>
      <h2 className="h h2" style={{fontSize: '36px', lineHeight: '1.08'}}>{tr("Yangi partiyalar va aksiyalar haqida birinchi boʻlib biling")}</h2>
      <p style={{margin: '10px 0 0', lineHeight: '1.55', color: '#4A3F3A'}}>{tr("Telegram kanalimizga qoʻshiling. Spam yoʻq — haftasiga 2–3 ta foydali xabar.")}</p>
    </div>
    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
      <a href="https://t.me/" className="pill dark" style={{minHeight: '52px'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z"></path><path d="M9 13l12-9"></path></svg> {tr("Kanalga qoʻshilish")}</a>
      <a href="https://t.me/" className="pill" style={{minHeight: '52px'}}>{tr("Botda buyurtma berish")}</a>
    </div>
  </div>
</section>
  )
}

export function SeoFaq({ tr, faq }: { tr: P['tr']; faq: React.ReactNode }) {
  return (
<section className="wrap" style={{marginTop: '40px'}} aria-labelledby="seo-h">
  <div style={{display: 'flex', gap: '28px', flexWrap: 'wrap'}}>
    <div style={{flex: '1 1 420px'}}>
      <h2 id="seo-h" className="h" style={{fontSize: '26px'}}>{tr("Toshkentda original koreys kosmetikasi")}</h2>
      <p className="muted" style={{lineHeight: '1.7', fontSize: '14px', margin: '12px 0 0'}}>{tr("Yeppo — koreys parvarish vositalari internet doʻkoni. Mahsulotlar rasmiy distribyutor orqali keladi, har birining partiya raqami va yaroqlilik muddati sahifada koʻrsatiladi. Teri turingizni bilmasangiz, AI maslahatchi 1 daqiqada aniqlab, mos rutina tuzib beradi. Toshkent va viloyatlarga yetkazamiz; Click, Payme, Uzcard yoki Humo orqali toʻlaysiz.")}</p>
    </div>
    {faq}
  </div>
</section>
  )
}
