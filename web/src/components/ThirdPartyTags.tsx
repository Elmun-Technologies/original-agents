import Script from 'next/script'

import { ALL_FIELDS } from '@/lib/integrations-def'
import { integrations } from '@/lib/integrations'
import { closedSite } from '@/lib/seo'

// Google Analytics 4, Yandex Metrika and Meta Pixel: put on every page when the owner has connected them in the
// admin panel (Integratsiyalar) AND the site is open. On the closed test site nothing is added, so test visits never
// reach those services. Every id is checked against its pattern again here before it goes into a script.
const ok = (key: string, v: unknown) => {
  const f = ALL_FIELDS.find((x) => x.key === key)
  return typeof v === 'string' && !!f?.pattern && f.pattern.test(v.trim()) ? v.trim() : ''
}

export async function ThirdPartyTags() {
  if (closedSite()) return null
  const v = await integrations()
  const ga = ok('ga4Id', v.ga4Id), ym = ok('metricaId', v.metricaId), fb = ok('metaPixelId', v.metaPixelId)
  return (
    <>
      {ga && (
        <>
          <Script id="ga4-src" src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga}');` }} />
        </>
      )}
      {ym && (
        <Script id="ym-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");window.__ymId="${ym}";ym(${ym},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:${v.metricaWebvisor === true}});` }} />
      )}
      {fb && (
        <Script id="fb-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${fb}');fbq('track','PageView');` }} />
      )}
    </>
  )
}
