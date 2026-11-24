import { getPayload, type Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }))

import config from '@/payload.config'
import { effective, SERVICES, sourcesOf, statusOf, validate, ALL_FIELDS } from '@/lib/integrations-def'
import { ensureIndexNowKey, integrations, invalidateIntegrations, loadIntegrations } from '@/lib/integrations'
import { decrypt, encrypt, isEncrypted, mask } from '@/lib/secrets'
import { paymentsMode, clickConfig } from '@/lib/payments/config'
import { smsMock } from '@/lib/sms'

describe('secrets', () => {
  it('round trip, different every time, unreadable without the key', () => {
    const a = encrypt('super-secret'), b = encrypt('super-secret')
    expect(a).not.toBe(b)
    expect(isEncrypted(a)).toBe(true)
    expect(a).not.toContain('super')
    expect(decrypt(a)).toBe('super-secret')
    expect(decrypt(a.slice(0, -2) + 'xx')).toBeNull() // tampered
    expect(decrypt('plain text')).toBeNull()
    const old = process.env.PAYLOAD_SECRET
    process.env.PAYLOAD_SECRET = 'another-secret-of-enough-length'
    expect(decrypt(a)).toBeNull() // another server key
    process.env.PAYLOAD_SECRET = old
    expect(decrypt(a)).toBe('super-secret')
  })
  it('the screen never shows more than the last 4 characters', () => {
    expect(mask('abcdefghijkl')).toBe('••••••••ijkl')
    expect(mask('abc')).toBe('••••••••')
    expect(mask('abcdefghijkl')).not.toContain('abcdefgh')
  })
})

describe('what the site uses', () => {
  it('admin value wins over the environment, the environment over the default', () => {
    expect(effective({ clickServiceId: '77' }, { CLICK_SERVICE_ID: '11' }).clickServiceId).toBe('77')
    expect(effective({}, { CLICK_SERVICE_ID: '11' }).clickServiceId).toBe('11')
    expect(effective({ clickServiceId: '  ' }, {}).clickServiceId).toBe('')
    const d = effective({}, {})
    expect(d).toMatchObject({ paymentsMode: 'mock', cardProvider: 'payme', smsMode: 'live', eskizFrom: '4546', paymeTest: false })
    expect(effective({}, { SMS_MODE: 'mock' }).smsMode).toBe('mock')
    expect(effective({}, { PAYME_TEST: '1' }).paymeTest).toBe(true)
    expect(effective({ paymentsMode: 'whatever' }, {}).paymentsMode).toBe('mock') // only an exact "live" is live
  })
  it('says where each key comes from', () => {
    const s = sourcesOf({ ga4Id: 'G-ABCD1234' }, { CLICK_SERVICE_ID: '1' })
    expect(s.ga4Id).toBe('admin'); expect(s.clickServiceId).toBe('env'); expect(s.metaPixelId).toBe('none')
  })
  it('status: on / partial / off', () => {
    const click = SERVICES.find((s) => s.id === 'click')!
    expect(statusOf(click, {})).toBe('off')
    expect(statusOf(click, { clickServiceId: '1' })).toBe('partial')
    expect(statusOf(click, { clickServiceId: '1', clickMerchantId: '2', clickSecret: 'x' })).toBe('on')
  })
})

describe('protecting money and customers', () => {
  const click = { clickServiceId: '1', clickMerchantId: '2', clickSecret: 'x' }
  const payme = { paymeMerchantId: 'abcdefghij12', paymeKey: 'k' }
  it('"live" payments need complete keys of the chosen card provider', () => {
    expect(validate(effective({ paymentsMode: 'live' }, {}))).toHaveLength(2) // nothing set: no provider + card provider
    expect(validate(effective({ paymentsMode: 'live', ...payme }, {}))).toEqual([])
    expect(validate(effective({ paymentsMode: 'live', ...click }, {})).join()).toContain('Payme') // card goes through Payme by default
    expect(validate(effective({ paymentsMode: 'live', cardProvider: 'click', ...click }, {}))).toEqual([])
    expect(validate(effective({ paymentsMode: 'live', ...click, ...payme }, {}))).toEqual([])
    expect(validate(effective({ paymentsMode: 'mock' }, {}))).toEqual([])
  })
  it('keys already in the server environment count', () => {
    const env = { CLICK_SERVICE_ID: '1', CLICK_MERCHANT_ID: '2', CLICK_SECRET_KEY: 'x', CARD_PROVIDER: 'click' }
    expect(validate(effective({ paymentsMode: 'live' }, env))).toEqual([])
  })
  it('"live" SMS needs Eskiz login', () => {
    expect(validate(effective({ smsMode: 'live' }, {}), ['smsMode'])).toHaveLength(1)
    expect(validate(effective({ smsMode: 'live', eskizEmail: 'a@b.uz', eskizPassword: 'p' }, {}), ['smsMode'])).toEqual([])
    expect(validate(effective({ smsMode: 'mock' }, {}), ['smsMode'])).toEqual([])
  })
  it('an unrelated save is never blocked by a half-finished setup', () => {
    // untouched site: SMS defaults to "live" without Eskiz keys, payments "live" without keys (e.g. typed by hand in the database)
    const v = effective({ ga4Id: 'G-AB12CD34EF', paymentsMode: 'live' }, {})
    expect(validate(v, ['ga4Id'])).toEqual([])
    expect(validate(v, ['paymentsMode'])).not.toEqual([])
    expect(validate(v, ['clickSecret'])).not.toEqual([]) // removing a key while payments are live is caught
  })
  it('ids are checked: nothing but the expected characters can reach a page script', () => {
    for (const bad of [{ ga4Id: 'G-1"></script><script>x' }, { metricaId: '12345);alert(1' }, { metaPixelId: '1;2' }, { googleVerification: '"><script>' }, { telegramAdminIds: 'abc' }]) {
      expect(validate(effective(bad, {})).length, JSON.stringify(bad)).toBeGreaterThan(0)
    }
    expect(validate(effective({ ga4Id: 'G-AB12CD34EF', metricaId: '12345678', metaPixelId: '1234567890123456', telegramAdminIds: '123456789, 987654321' }, {}))).toEqual([])
  })
  it('every key of every card has a field in the database table', () => {
    expect(new Set(ALL_FIELDS.map((f) => f.key)).size).toBe(ALL_FIELDS.length)
  })
})

let payload: Payload
const sql = () => (payload.db as unknown as { pool: { query: (q: string, v?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> } }).pool
const reset = async () => { await sql().query('DELETE FROM integrations'); invalidateIntegrations() }
const save = (data: Record<string, unknown>) => payload.updateGlobal({ slug: 'integrations', data: data as never, overrideAccess: true })

describe('saved in the database', () => {
  beforeAll(async () => { payload = await getPayload({ config: await config }) })
  beforeEach(reset)

  it('secrets are stored encrypted and read back decrypted', async () => {
    await save({ clickServiceId: '5', clickMerchantId: '6', clickSecret: 'click-secret-123' })
    const raw = (await sql().query('SELECT click_secret, click_service_id FROM integrations')).rows[0]
    expect(String(raw.click_secret)).toMatch(/^enc:v1:/)
    expect(String(raw.click_secret)).not.toContain('click-secret-123')
    expect(raw.click_service_id).toBe('5') // ordinary values stay readable
    expect((await integrations()).clickSecret).toBe('click-secret-123')
    expect((await clickConfig()).secretKey).toBe('click-secret-123')
  })

  it('saving the same screen again does not double-encrypt', async () => {
    await save({ paymeKey: 'key-1' })
    const first = (await sql().query('SELECT payme_key FROM integrations')).rows[0].payme_key
    await save({ paymeKey: first, ga4Id: 'G-ABCD1234' }) // the encrypted value comes back unchanged
    expect((await sql().query('SELECT payme_key FROM integrations')).rows[0].payme_key).toBe(first)
    expect((await integrations()).paymeKey).toBe('key-1')
  })

  it('the database refuses "live" payments without keys, whoever asks', async () => {
    await expect(save({ paymentsMode: 'live' })).rejects.toThrow(/Click yoki Payme/)
    expect(await paymentsMode()).toBe('mock')
    await save({ paymeMerchantId: 'abcdefghij12', paymeKey: 'k' })
    await save({ paymentsMode: 'live' })
    invalidateIntegrations()
    expect(await paymentsMode()).toBe('live')
    await save({ paymentsMode: 'mock' })
    invalidateIntegrations()
    expect(await paymentsMode()).toBe('mock')
  })

  it('a malformed id is refused', async () => {
    await expect(save({ ga4Id: 'G-1"></script>' })).rejects.toThrow(/Measurement ID/)
  })

  it('SMS mode follows the saved choice', async () => {
    await save({ smsMode: 'mock' }); invalidateIntegrations()
    expect(await smsMock()).toBe(true)
    await save({ smsMode: 'live', eskizEmail: 'a@b.uz', eskizPassword: 'p' }); invalidateIntegrations()
    expect(await smsMock()).toBe(false)
  })

  it('a secret saved under another server key is reported, not crashed on', async () => {
    await save({ telegramToken: 'token-abc' })
    const old = process.env.PAYLOAD_SECRET
    process.env.PAYLOAD_SECRET = 'another-secret-of-enough-length'
    invalidateIntegrations()
    const l = await loadIntegrations(true)
    process.env.PAYLOAD_SECRET = old
    invalidateIntegrations()
    expect(l.unreadable).toContain('telegramToken')
    expect(l.values.telegramToken).toBe('')
  })

  it('the IndexNow key is created once', async () => {
    const a = await ensureIndexNowKey()
    expect(a).toMatch(/^[a-f0-9]{32}$/)
    expect(await ensureIndexNowKey()).toBe(a)
  })
})
