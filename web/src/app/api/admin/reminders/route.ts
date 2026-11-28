import { adminUser, denied } from '@/lib/admin-auth'
import { runReminders } from '@/lib/reminders'

// "Hozir tekshirish" on Marketing → Eslatmalar: one pass now, also outside 10:00–20:00 (the owner pressed it).
export const dynamic = 'force-dynamic'

export async function POST() {
  if (!(await adminUser())) return denied()
  return Response.json(await runReminders({ force: true }))
}
