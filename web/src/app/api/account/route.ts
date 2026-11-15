// Customer edits own profile: name, skin profile, addresses, saved routine. Only these fields; phone never changes here.
import { currentCustomer } from '@/lib/customer'
import { payload } from '@/lib/catalog'

const SKINS = ['dry', 'oily', 'combo', 'sens', 'normal']
export async function PATCH(req: Request) {
  const c = await currentCustomer()
  if (!c) return Response.json({ ok: false }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof b.name === 'string') data.name = b.name.trim().slice(0, 60)
  if (typeof b.skin === 'string' && SKINS.includes(b.skin)) data.skin = b.skin
  if (Array.isArray(b.concerns)) data.concerns = b.concerns.filter((x: unknown) => typeof x === 'string').slice(0, 6)
  if (Array.isArray(b.addresses)) data.addresses = b.addresses.slice(0, 5).map((a: { city?: string; address?: string }) => ({ city: String(a.city ?? '').slice(0, 60), address: String(a.address ?? '').slice(0, 200) })).filter((a: { address: string }) => a.address)
  if (b.routine && typeof b.routine === 'object' && JSON.stringify(b.routine).length < 4000) data.routine = b.routine
  await (await payload()).update({ collection: 'customers', id: c.id, data, overrideAccess: true })
  return Response.json({ ok: true })
}
