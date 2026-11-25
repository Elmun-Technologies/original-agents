import { getPayload, type Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }))

import config from '@/payload.config'
import { indexNowUrls, submitIndexNow } from '@/lib/indexnow'
import { invalidateIntegrations } from '@/lib/integrations'

describe('IndexNow', () => {
  it('both languages of every changed page, no duplicates, at most 100', () => {
    expect(indexNowUrls('https://yeppo.uz', ['/mahsulot/a', '/mahsulot/a', '/'])).toEqual(['https://yeppo.uz/uz/mahsulot/a', 'https://yeppo.uz/ru/mahsulot/a', 'https://yeppo.uz/uz', 'https://yeppo.uz/ru'])
    expect(indexNowUrls('https://yeppo.uz', Array.from({ length: 300 }, (_, i) => `/p/${i}`))).toHaveLength(100)
  })

  describe('sending', () => {
    let payload: Payload
    const save = async (data: Record<string, unknown>) => { await payload.updateGlobal({ slug: 'integrations', data: data as never, overrideAccess: true }); invalidateIntegrations() }
    const KEY = 'a'.repeat(32)
    beforeAll(async () => { payload = await getPayload({ config: await config }) })
    beforeEach(async () => { await (payload.db as unknown as { pool: { query: (q: string) => Promise<unknown> } }).pool.query('DELETE FROM integrations'); invalidateIntegrations() })
    const env = { SITE_URL: process.env.SITE_URL, SITE_PASSWORD: process.env.SITE_PASSWORD, SITE_NOINDEX: process.env.SITE_NOINDEX }
    const restore = () => { for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }

    it('does nothing unless the owner switched it on, with a key, on an open https site', async () => {
      const fetchFn = vi.fn(async () => new Response('', { status: 200 }))
      process.env.SITE_URL = 'https://yeppo.uz'; delete process.env.SITE_PASSWORD; delete process.env.SITE_NOINDEX
      try {
        expect(await submitIndexNow(['/a'], fetchFn)).toEqual({ sent: false, reason: 'off' })
        await save({ indexNowOn: true })
        expect(await submitIndexNow(['/a'], fetchFn)).toEqual({ sent: false, reason: 'no key' })
        await save({ indexNowKey: KEY })
        process.env.SITE_PASSWORD = 'x' // closed test site
        expect((await submitIndexNow(['/a'], fetchFn)).reason).toBe('site not public')
        delete process.env.SITE_PASSWORD; process.env.SITE_URL = 'http://localhost:3000'
        expect((await submitIndexNow(['/a'], fetchFn)).reason).toBe('site not public')
        expect(fetchFn).not.toHaveBeenCalled()

        process.env.SITE_URL = 'https://yeppo.uz'
        expect(await submitIndexNow(['/mahsulot/a'], fetchFn)).toEqual({ sent: true })
        const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toBe('https://api.indexnow.org/indexnow')
        expect(JSON.parse(String(init.body))).toEqual({ host: 'yeppo.uz', key: KEY, keyLocation: `https://yeppo.uz/indexnow/${KEY}`, urlList: ['https://yeppo.uz/uz/mahsulot/a', 'https://yeppo.uz/ru/mahsulot/a'] })
      } finally { restore() }
    })

    it('a network failure never throws', async () => {
      process.env.SITE_URL = 'https://yeppo.uz'; delete process.env.SITE_PASSWORD; delete process.env.SITE_NOINDEX
      try {
        await save({ indexNowOn: true, indexNowKey: KEY })
        expect(await submitIndexNow(['/a'], (async () => { throw new Error('down') }) as unknown as typeof fetch)).toEqual({ sent: false, reason: 'network' })
      } finally { restore() }
    })
  })
})
