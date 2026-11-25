'use client'
import { useMemo, useState } from 'react'

import { trackedLink } from '@/lib/tracked-link'
import { CopyButton } from './CopyButton'

const PAGES: [string, string][] = [['/uz', 'Bosh sahifa (oʻzbekcha)'], ['/ru', 'Bosh sahifa (ruscha)'], ['/uz/katalog/serum', 'Serumlar'], ['/uz/katalog/spf', 'SPF'], ['/uz/aksiyalar', 'Aksiyalar'], ['/uz/sovgalar', 'Sovgʻalar'], ['/uz/maslahatchi', 'AI maslahatchi']]
const SOURCES = ['instagram', 'telegram', 'facebook', 'tiktok', 'youtube', 'sms', 'email', 'blogger']
const MEDIA = ['story', 'post', 'reels', 'bio', 'reklama', 'xabar', 'blogger']

export function UtmBuilder({ site }: { site: string }) {
  const [page, setPage] = useState(PAGES[0][0])
  const [custom, setCustom] = useState('')
  const [source, setSource] = useState('instagram')
  const [medium, setMedium] = useState('story')
  const [campaign, setCampaign] = useState('')
  const url = useMemo(() => trackedLink(site, custom.trim() || page, { source, medium, campaign }), [site, page, custom, source, medium, campaign])
  return (
    <div className="yp-card" style={{ maxWidth: 720 }}>
      <label>Qaysi sahifaga olib boradi
        <select value={page} onChange={(e) => setPage(e.target.value)}>{PAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </label>
      <label>Yoki boshqa sahifa (masalan /uz/mahsulot/nomi)<input type="text" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="/uz/mahsulot/…" /></label>
      <div className="yp-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <label>Qayerda joylaysiz (manba)
          <input type="text" list="yp-src" value={source} onChange={(e) => setSource(e.target.value)} /><datalist id="yp-src">{SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label>Qanday koʻrinishda (kanal)
          <input type="text" list="yp-med" value={medium} onChange={(e) => setMedium(e.target.value)} /><datalist id="yp-med">{MEDIA.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label>Kampaniya nomi<input type="text" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="qish-aksiyasi" /></label>
      </div>
      <div className="yp-msg ok" style={{ wordBreak: 'break-all' }}>{url}</div>
      <div className="yp-row"><CopyButton text={url} label="Havolani nusxalash" /></div>
      <p className="yp-muted">Har bir post, story, reklama yoki SMS uchun alohida havola yasang va oʻsha joyga qoʻying. Keyin <b>Analitika → Manbalar</b> da qaysi biri nechta kirish va nechta xarid keltirganini koʻrasiz. Instagram’da profil havolasi (bio) uchun kanal: <code>bio</code>.</p>
    </div>
  )
}
