import type { AdminViewServerProps } from 'payload'

import { AdminPage } from './AdminPage'
import { IntegrationsClient } from './IntegrationsClient'

export function IntegrationsView(props: AdminViewServerProps) {
  return (
    <AdminPage props={props} title="Integratsiyalar" lead="Hamma ulanishlar shu yerda: analitika, qidiruv tizimlari, toʻlov, SMS va Telegram. Kalitni kiriting, «Saqlash» ni bosing — server qayta ishga tushirilmaydi. Parollar va kalitlar bazada shifrlangan holda saqlanadi va bu yerda qayta koʻrsatilmaydi.">
      <IntegrationsClient />
    </AdminPage>
  )
}
