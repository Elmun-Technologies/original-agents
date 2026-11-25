// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GET } from '@/app/(payload)/api/media/file/[...path]/route'
import { thumb } from '@/lib/media-url'

let dir = ''
const get = (name: string, q = '', accept = 'image/avif,image/webp,*/*', extra: Record<string, string> = {}) =>
  GET(new Request(`http://x/api/media/file/${name}${q}`, { headers: { accept, ...extra } }), { params: Promise.resolve({ path: [name] }) })
const dims = async (r: Response) => { const m = await sharp(Buffer.from(await r.arrayBuffer())).metadata(); return { w: m.width, h: m.height, f: m.format } }

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'yeppo-media-test-'))
  process.env.MEDIA_DIR = dir
  const photo = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#d9a0a8' } }).jpeg({ quality: 100 }).toBuffer()
  await fs.writeFile(path.join(dir, 'big.jpg'), photo)
  // a phone photo stored sideways with an EXIF rotation: must come out upright
  await fs.writeFile(path.join(dir, 'turned.jpg'), await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#888' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer())
  await fs.writeFile(path.join(dir, 'small.png'), await sharp({ create: { width: 300, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer())
  await fs.writeFile(path.join(dir, 'cert.pdf'), '%PDF-1.4 test')
  await fs.writeFile(path.join(dir, 'broken.jpg'), 'this is not a picture')
})
afterAll(async () => { delete process.env.MEDIA_DIR; await fs.rm(dir, { recursive: true, force: true }) })

describe('pictures', () => {
  it('a big photo comes out as a small WebP, at most 1200 px wide, same proportions', async () => {
    const r = await get('big.jpg')
    expect(r.status).toBe(200); expect(r.headers.get('content-type')).toBe('image/webp'); expect(r.headers.get('vary')).toBe('Accept')
    const original = (await fs.stat(path.join(dir, 'big.jpg'))).size
    const body = Buffer.from(await r.arrayBuffer())
    expect(body.length).toBeLessThan(original / 5)
    const m = await sharp(body).metadata()
    expect({ w: m.width, h: m.height, f: m.format }).toEqual({ w: 1200, h: 800, f: 'webp' })
  })
  it('?w= picks the nearest allowed size; nonsense falls back to 1200; never enlarged', async () => {
    expect((await dims(await get('big.jpg', '?w=600'))).w).toBe(640)
    expect((await dims(await get('big.jpg', '?w=abc'))).w).toBe(1200)
    expect((await dims(await get('big.jpg', '?w=99999'))).w).toBe(1600)
    expect((await dims(await get('small.png', '?w=1200'))).w).toBe(300)
  })
  it('a client without WebP (link previews, old apps) gets a JPEG', async () => {
    const r = await get('big.jpg', '', '*/*')
    expect(r.headers.get('content-type')).toBe('image/jpeg'); expect((await dims(r)).f).toBe('jpeg')
  })
  it('the phone orientation is applied (upright), the picture is not otherwise changed', async () => {
    const d = await dims(await get('turned.jpg'))
    expect(d.w).toBe(1000); expect(d.h).toBe(2000) // 2000x1000 rotated 90° = 1000x2000
  })
  it('transparent PNG stays transparent in WebP', async () => {
    const m = await sharp(Buffer.from(await (await get('small.png')).arrayBuffer())).metadata()
    expect(m.hasAlpha).toBe(true)
  })
  it('caching: ETag, 304 on repeat, a day in the browser', async () => {
    const r = await get('big.jpg')
    const tag = r.headers.get('etag')!
    expect(r.headers.get('cache-control')).toContain('max-age=86400')
    const again = await get('big.jpg', '', 'image/webp', { 'if-none-match': tag })
    expect(again.status).toBe(304)
    expect((await get('big.jpg', '?w=480')).headers.get('etag')).not.toBe(tag)
  })
  it('PDF and other files are sent unchanged; ?raw=1 gives the original picture', async () => {
    const pdf = await get('cert.pdf')
    expect(pdf.headers.get('content-type')).toBe('application/pdf'); expect(await pdf.text()).toBe('%PDF-1.4 test')
    const raw = await get('big.jpg', '?raw=1')
    expect(raw.headers.get('content-type')).toBe('image/jpeg'); expect((await dims(raw)).w).toBe(3000)
  })
  it('a damaged file is still sent (as it is), not an error', async () => {
    const r = await get('broken.jpg')
    expect(r.status).toBe(200); expect(await r.text()).toBe('this is not a picture')
  })
  it('cannot read outside the media folder, hidden files, or things that do not exist', async () => {
    for (const bad of ['../package.json', '..%2Fpackage.json', '.env', 'a/b.jpg', 'nothing.jpg', '']) {
      const r = await GET(new Request('http://x/'), { params: Promise.resolve({ path: [bad] }) })
      expect(r.status, bad).toBe(404)
    }
    expect((await GET(new Request('http://x/'), { params: Promise.resolve({ path: ['a', 'b.jpg'] }) })).status).toBe(404)
  })
})

describe('thumbnail address', () => {
  it('adds the size to uploaded pictures only, once', () => {
    expect(thumb('/api/media/file/a.jpg')).toBe('/api/media/file/a.jpg?w=640')
    expect(thumb('/api/media/file/a.jpg', 480)).toBe('/api/media/file/a.jpg?w=480')
    expect(thumb('/api/media/file/a.jpg?w=320')).toBe('/api/media/file/a.jpg?w=320')
    expect(thumb('/img/hero.jpg')).toBe('/img/hero.jpg'); expect(thumb('')).toBe(''); expect(thumb(undefined)).toBe('')
  })
})
