import 'server-only'
import { headers } from 'next/headers'

import { payload } from '@/lib/catalog'

/** The logged-in admin (Payload user) of this request, or null. Every admin API and every admin view asks this first. */
export async function adminUser() {
  const { user } = await (await payload()).auth({ headers: await headers() })
  return user ?? null
}

export const denied = () => Response.json({ ok: false, error: 'login' }, { status: 401 })
