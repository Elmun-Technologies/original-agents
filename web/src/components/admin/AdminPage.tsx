// Frame for every custom admin screen: Payload's own navigation and header, the login check, our page style.
// Payload does not protect a custom view by itself — without this check anyone could open it.
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import type { ReactNode } from 'react'

import './admin.css'

export function AdminPage({ props, title, lead, children }: { props: AdminViewServerProps; title: string; lead?: string; children: ReactNode }) {
  const { initPageResult, params, searchParams } = props
  if (!initPageResult.req.user) redirect('/admin/login')
  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <div className="yp">
          <h1 className="yp-h1">{title}</h1>
          {lead && <p className="yp-lead">{lead}</p>}
          {children}
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}
