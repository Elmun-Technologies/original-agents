// Secrets kept in the database (payment keys, SMS password, bot token) are encrypted with AES-256-GCM.
// The key comes from PAYLOAD_SECRET, which lives only in the server's environment: a copy of the database or a
// backup alone does not reveal them. If PAYLOAD_SECRET is ever changed, the keys must be entered again.
import crypto from 'node:crypto'

const PREFIX = 'enc:v1:'

function key() {
  const s = process.env.PAYLOAD_SECRET
  if (!s || s.length < 16) throw new Error('PAYLOAD_SECRET is missing or too short')
  return crypto.createHash('sha256').update(`yeppo-integrations:${s}`).digest()
}

export const isEncrypted = (v: unknown): boolean => typeof v === 'string' && v.startsWith(PREFIX)

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url')
}

/** null when the value was not encrypted with this server's key (or is damaged) */
export function decrypt(value: string): string | null {
  if (!isEncrypted(value)) return null
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64url')
    const d = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12))
    d.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8')
  } catch {
    return null
  }
}

/** what the admin screen shows instead of a saved secret: never more than the last 4 characters */
export const mask = (plain: string) => (plain.length <= 8 ? '••••••••' : `••••••••${plain.slice(-4)}`)
