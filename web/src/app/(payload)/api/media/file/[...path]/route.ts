import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import sharp from 'sharp'

// Serves the uploaded pictures (same address as before: /api/media/file/<name>) but light: resized to at most 1200 px
// (or ?w=320|480|640|800|1080|1200|1600), WebP for browsers that accept it, JPEG for the rest (link previews, old apps).
// A phone photo of 4 MB becomes ~100 KB; nothing is changed in the picture itself (no retouching), only its size and format.
// The result is kept on disk so the picture is converted once. PDFs, SVG and the like are sent unchanged; ?raw=1 sends the original.
// The more specific path wins over Payload's own file route.
export const dynamic = 'force-dynamic'

const dir = () => process.env.MEDIA_DIR || path.resolve(process.cwd(), 'media')
const CACHE = path.join(os.tmpdir(), 'yeppo-media-cache')
const WIDTHS = [320, 480, 640, 800, 1080, 1200, 1600]
const RASTER = /\.(jpe?g|png|webp|avif|tiff?)$/i
const TYPES: Record<string, string> = { '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8' }
const width = (raw: string | null) => { const n = Number(raw) || 1200; return WIDTHS.reduce((best, w) => (Math.abs(w - n) < Math.abs(best - n) ? w : best), 1200) }

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segs } = await params
  let name = ''
  try { name = segs.length === 1 ? decodeURIComponent(segs[0]) : '' } catch { /* malformed */ }
  if (!name || name !== path.basename(name) || name.startsWith('.') || /[\\/\0]/.test(name)) return new Response('not found', { status: 404 })
  const file = path.join(dir(), name)
  let st
  try { st = await fs.stat(file); if (!st.isFile()) throw new Error('not a file') } catch { return new Response('not found', { status: 404 }) }

  const q = new URL(req.url).searchParams
  const ext = path.extname(name).toLowerCase()
  const original = async () => new Response(new Uint8Array(await fs.readFile(file)), { headers: { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' } })
  if (!RASTER.test(name) || q.get('raw') === '1') return original()

  const webp = /image\/webp/.test(req.headers.get('accept') ?? '')
  const kind = webp ? 'webp' : 'jpeg'
  const w = width(q.get('w'))
  const etag = `"${crypto.createHash('sha1').update(`${name}|${st.size}|${st.mtimeMs}|${w}|${kind}`).digest('hex').slice(0, 24)}"`
  const headers = { 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800', vary: 'Accept', etag, 'x-content-type-options': 'nosniff' }
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers })

  const cached = path.join(CACHE, `${etag.slice(1, -1)}.${kind}`)
  let buf: Buffer
  try {
    buf = await fs.readFile(cached)
  } catch {
    try {
      const img = sharp(file, { failOn: 'none' }).rotate().resize({ width: w, withoutEnlargement: true }) // rotate(): honours the phone's orientation
      buf = await (webp ? img.webp({ quality: 80 }) : img.flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true })).toBuffer()
      await fs.mkdir(CACHE, { recursive: true })
      await fs.writeFile(cached, buf).catch(() => {})
    } catch (e) {
      console.warn('media: could not convert', name, (e as Error).message.split('\n')[0])
      return original() // a damaged or unusual file is better sent as it is than not at all
    }
  }
  return new Response(new Uint8Array(buf), { headers: { ...headers, 'content-type': webp ? 'image/webp' : 'image/jpeg', 'content-length': String(buf.length) } })
}
