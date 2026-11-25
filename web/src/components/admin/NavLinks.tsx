'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import './admin.css'

// Our screens in Payload's left menu, under the standard collections.
const LINKS: { group: string; items: [string, string][] }[] = [
  { group: 'Boshqaruv', items: [['/admin/tayyorlik', 'Ishga tushirishga tayyorlik'], ['/admin/integratsiyalar', 'Integratsiyalar']] },
  { group: 'Tahlil va marketing', items: [['/admin/analitika', 'Analitika'], ['/admin/heatmap', 'Heatmap'], ['/admin/marketing', 'Marketing'], ['/admin/seo', 'SEO audit']] },
]

export function NavLinks() {
  const path = usePathname()
  return (
    <>
      {LINKS.map((g) => (
        <nav key={g.group} className="yp-nav" aria-label={g.group}>
          <b>{g.group}</b>
          {g.items.map(([href, label]) => <Link key={href} href={href} className={path.startsWith(href) ? 'on' : ''}>{label}</Link>)}
        </nav>
      ))}
    </>
  )
}
