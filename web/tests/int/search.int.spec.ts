import { describe, expect, it } from 'vitest'

import { normalize, rank, understand, type Searchable } from '@/lib/search'

const brands = [{ slug: 'skin1004', name: 'SKIN1004' }, { slug: 'torriden', name: 'Torriden' }, { slug: 'beauty-of-joseon', name: 'Beauty of Joseon' }]
const P = (o: Partial<Searchable> & { slug: string }): Searchable => ({ name: o.slug, brand: 'B', brandSlug: 'b', category: 'serum', skin: [], concerns: [], price: 100000, stock: 1, sold: 0, reviews: 0, ...o })
const items = [
  P({ slug: 'cream', name: 'DIVE-IN Soothing Cream', brand: 'Torriden', brandSlug: 'torriden', category: 'krem', skin: ['dry', 'sens'], price: 249000 }),
  P({ slug: 'amp', name: 'Madagascar Centella Ampoule', brand: 'SKIN1004', brandSlug: 'skin1004', skin: ['oily', 'sens'], concerns: ['acne'], price: 245000, sold: 5 }),
  P({ slug: 'spf', name: 'All Around Safe Block Essence Sun', brand: 'MISSHA', category: 'spf', skin: ['dry', 'oily'], price: 149000 }),
  P({ slug: 'revive', name: 'Revive Serum', brand: 'Beauty of Joseon', brandSlug: 'beauty-of-joseon', skin: ['dry'], concerns: ['dryness'], price: 219000 }),
]

describe('search understanding', () => {
  it('normalizes Cyrillic, apostrophes and case', () => {
    expect(normalize('Крем для СУХОЙ кожи')).toBe('krem dlya suxoy koji')
    expect(normalize('Yogʻli teri')).toBe('yogli teri')
  })
  it.each([
    ['quruq teri uchun krem', { skin: 'dry', type: 'krem' }],
    ['крем для сухой кожи', { skin: 'dry', type: 'krem' }],
    ['krem dlya suxoy koji', { skin: 'dry', type: 'krem' }],
    ['yuzim yogʻlanadi toshma', { concern: 'acne' }],
    ['санскрин', { type: 'spf' }],
    ['sentella skin1004', { brand: 'skin1004' }],
    ['serum 200 000 gacha', { type: 'serum', max: 200000 }],
    ['сыворотка до 250 тыс', { type: 'serum', max: 250000 }],
  ])('%s', (q, want) => expect(understand(q, brands)).toMatchObject(want))
})

describe('search ranking', () => {
  it('dry-skin cream first', () => expect(rank(items, understand('quruq teri uchun krem', brands)).hits[0].slug).toBe('cream'))
  it('brand filter', () => expect(rank(items, understand('beauty of joseon', brands)).hits.map((x) => x.slug)).toEqual(['revive']))
  it('price ceiling drops expensive items', () => expect(rank(items, understand('serum 230 000 gacha', brands)).hits.map((x) => x.slug)).toEqual(['revive']))
  it('typo-ish word still matches the name', () => expect(rank(items, understand('centella', brands)).hits[0].slug).toBe('amp'))
  it('never empty: nonsense returns the closest 4', () => {
    const r = rank(items, understand('qwertyuiop', brands))
    expect(r.closest).toBe(true)
    expect(r.hits.length).toBe(4)
  })
})
