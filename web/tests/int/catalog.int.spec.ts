import { describe, expect, it, beforeAll } from 'vitest'

import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'

import { toCards } from '@/lib/catalog'

let payload: Payload

describe('catalog toCards', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  it('sahifani buzmasin: variantsiz mahsulotlar katalog karatalardan chiqadi', async () => {
    const { docs: products } = await payload.find({
      collection: 'products',
      locale: 'uz',
      depth: 1,
      limit: 1000,
      pagination: false,
    })

    // Crash bo'lmasin
    const cards = await toCards(products, 'uz')

    // Har bir karta variantga tegishli mahsulot bo'lishi kerak
    for (const c of cards) {
      const pr = products.find((p) => p.slug === c.slug)
      expect(pr).toBeDefined()
      expect(Array.isArray(pr?.variants) && pr.variants.length > 0).toBe(true)
    }

    // Variant yo'q mahsulotlar karatalarda yo'q
    const noVariant = products.filter((p) => !Array.isArray(p.variants) || p.variants.length === 0)
    if (noVariant.length) {
      const noVariantSlugs = new Set(noVariant.map((p) => p.slug))
      for (const c of cards) expect(noVariantSlugs.has(c.slug)).toBe(false)
    }
  })
})
