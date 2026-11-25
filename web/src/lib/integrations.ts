import 'server-only'
import crypto from 'node:crypto'

import { payload } from '@/lib/catalog'
import { effective, SECRET_KEYS, sourcesOf, type Values } from './integrations-def'
import { decrypt, isEncrypted } from './secrets'

// Reads the integration keys saved in the admin panel (global "integrations"), decrypts the secrets and falls back
// to the server environment. Everything else in the site asks this file, never process.env directly.
export type Loaded = { stored: Values; values: Values; sources: ReturnType<typeof sourcesOf>; unreadable: string[] }

let cache: { at: number; v: Loaded } | null = null
const TTL = 10_000
export const invalidateIntegrations = () => { cache = null }

async function readStored(): Promise<{ stored: Values; unreadable: string[] }> {
  const stored: Values = {}
  const unreadable: string[] = []
  try {
    const doc = (await (await payload()).findGlobal({ slug: 'integrations', depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>
    for (const [k, v] of Object.entries(doc)) {
      if (typeof v === 'boolean') stored[k] = v
      else if (typeof v === 'string') {
        if (SECRET_KEYS.includes(k) && isEncrypted(v)) {
          const plain = decrypt(v)
          if (plain === null) unreadable.push(k) // saved under another PAYLOAD_SECRET: has to be entered again
          else stored[k] = plain
        } else stored[k] = v
      }
    }
  } catch (e) {
    // no database (build) or the table is not there yet: the environment alone decides
    console.warn('integrations: using environment only —', (e as Error).message.split('\n')[0])
  }
  return { stored, unreadable }
}

export async function loadIntegrations(fresh = false): Promise<Loaded> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.v
  const { stored, unreadable } = await readStored()
  const v: Loaded = { stored, unreadable, values: effective(stored, process.env), sources: sourcesOf(stored, process.env) }
  cache = { at: Date.now(), v }
  return v
}

/** the values the site works with right now */
export const integrations = async () => (await loadIntegrations()).values

export const newIndexNowKey = () => crypto.randomBytes(16).toString('hex')

/** The IndexNow key is created once, the first time the screen is opened. */
export async function ensureIndexNowKey() {
  const { stored } = await loadIntegrations(true)
  if (typeof stored.indexNowKey === 'string' && stored.indexNowKey) return stored.indexNowKey
  const key = newIndexNowKey()
  await (await payload()).updateGlobal({ slug: 'integrations', data: { indexNowKey: key } as never, overrideAccess: true })
  invalidateIntegrations()
  return key
}
