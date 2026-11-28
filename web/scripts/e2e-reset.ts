// Before e2e: test purchases use up stock, so SAMPLE products (sample=true) get their seed stock back.
// Real products are never touched.
import { getPayload } from 'payload'

import config from '../src/payload.config'

process.env.YEPPO_SCRIPT = '1' // the site's server-only hooks stay quiet (payload.config.ts)

const payload = await getPayload({ config: await config })
const { docs } = await payload.find({ collection: 'products', where: { sample: { equals: true } }, limit: 500, depth: 0, overrideAccess: true })
// seed values (src/seed.ts): 10 each, Y-AMP-100 has 6, Y-SNAIL is the deliberate sold-out sample
const SEED: Record<string, number> = { 'Y-SNAIL': 0, 'Y-AMP-100': 6 }
let n = 0
for (const p of docs) {
  const variants = p.variants.map((v) => ({ ...v, stock: SEED[v.sku] ?? 10 }))
  if (variants.every((v, i) => v.stock === p.variants[i].stock)) continue
  await payload.update({ collection: 'products', id: p.id, overrideAccess: true, data: { variants } })
  n++
}
console.log(`e2e reset: ${n} sample products restocked`)
process.exit(0)
