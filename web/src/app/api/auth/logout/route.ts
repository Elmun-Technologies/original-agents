import { signOut } from '@/lib/customer'

export async function POST() {
  await signOut()
  return Response.json({ ok: true })
}
