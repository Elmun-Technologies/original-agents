import type { AdminViewServerProps } from 'payload'

import { heatPages, rangeOf, runner } from '@/lib/analytics'
import { AdminPage } from './AdminPage'
import { HeatmapClient } from './HeatmapClient'

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function HeatmapView(props: AdminViewServerProps) {
  const wanted = one(props.searchParams?.path) ?? ''
  return (
    <AdminPage props={props} title="Heatmap" lead="Mijozlar sahifaning qayerini bosadi va qayergacha pastga tushadi. Sahifani tanlang — ustiga bosishlar xaritasi chiziladi. Bosishlar sayt ochilgandan keyin yigʻila boshlaydi.">
      <Body wanted={wanted} />
    </AdminPage>
  )
}

async function Body({ wanted }: { wanted: string }) {
  const pages = await heatPages(await runner(), rangeOf('90'))
  const initial = /^\/[A-Za-z0-9\-_./%]*$/.test(wanted) && !wanted.includes('..') ? wanted : pages[0]?.path ?? '/'
  return <HeatmapClient pages={pages} initial={initial} />
}
