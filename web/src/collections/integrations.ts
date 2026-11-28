import { APIError, type Field, type GlobalConfig } from 'payload'

import { ALL_FIELDS, effective, SECRET_KEYS, validate, type Values } from '@/lib/integrations-def'
import { decrypt, encrypt, isEncrypted } from '@/lib/secrets'

// Keys of every connected service. Edited only through the "Integratsiyalar" screen (admin → /admin/integratsiyalar),
// so the standard form is hidden. Secrets are stored encrypted. Only a logged-in admin can read or change it.
const admin = ({ req }: { req: { user?: unknown } }) => !!req.user

const plain = (doc: Record<string, unknown>): Values => {
  const out: Values = {}
  for (const [k, v] of Object.entries(doc ?? {})) {
    if (typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string') out[k] = SECRET_KEYS.includes(k) && isEncrypted(v) ? (decrypt(v) ?? '') : v
  }
  return out
}

const FIELDS: Field[] = [...new Set([...ALL_FIELDS.map((f) => f.key), 'indexNowKey'])].map((name): Field =>
  (ALL_FIELDS.find((f) => f.key === name)?.kind === 'checkbox' ? { name, type: 'checkbox', defaultValue: false } : { name, type: 'text' }))

export const Integrations: GlobalConfig = {
  slug: 'integrations',
  admin: { hidden: true },
  access: { read: admin, update: admin },
  fields: FIELDS,
  hooks: {
    beforeChange: [({ data, originalDoc }) => {
      for (const k of SECRET_KEYS) {
        const v: unknown = data[k]
        if (typeof v === 'string' && v.trim() && !isEncrypted(v)) data[k] = encrypt(v.trim())
      }
      // saved values + what the server environment already provides: a mode may only go "live" with working keys.
      // Only what this save touches is checked, so an unrelated save is never blocked.
      const changed = Object.keys(data).filter((k) => data[k] !== undefined && data[k] !== (originalDoc as Record<string, unknown> | undefined)?.[k])
      const errors = validate(effective(plain({ ...originalDoc, ...data }), process.env), changed)
      if (errors.length) throw new APIError(errors.join('\n'), 400, undefined, true)
      return data
    }],
    afterChange: [async () => { if (process.env.YEPPO_SCRIPT === '1') return; try { (await import('@/lib/integrations')).invalidateIntegrations() } catch { /* a script outside the site has no cache to clear */ } }],
  },
}
