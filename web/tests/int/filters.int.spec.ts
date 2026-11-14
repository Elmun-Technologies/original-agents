import { describe, expect, it } from 'vitest'

import { activeCount, applyFilters, filterQuery, parseFilters, type Filterable } from '@/lib/filters'

const P = (o: Partial<Filterable> & { id: string }) => ({
  price: 100000, stock: 5, skin: [], concerns: [], category: 'serum', brandSlug: 'a', createdAt: '2026-01-01', order: 0, ...o,
})
const items = [
  P({ id: 'amp', price: 245000, old: 289000, skin: ['oily', 'sens'], concerns: ['acne'], brandSlug: 'skin1004', type: 'Ampula', order: 1 }),
  P({ id: 'revive', price: 219000, skin: ['dry'], concerns: ['dryness'], brandSlug: 'boj', type: 'Serum', order: 2, createdAt: '2026-03-01' }),
  P({ id: 'spf', price: 149000, old: 169000, skin: ['dry', 'oily'], category: 'spf', brandSlug: 'missha', order: 3 }),
  P({ id: 'gone', price: 99000, stock: 0, skin: ['dry'], brandSlug: 'boj', order: 0 }),
]
const ids = (f: ReturnType<typeof parseFilters>) => applyFilters(items, f).map((p) => p.id)

describe('catalog filters', () => {
  it('defaults: everything, in stock first, catalog order', () => expect(ids(parseFilters({}))).toEqual(['amp', 'revive', 'spf', 'gone']))
  it('sale = real discount only', () => expect(ids(parseFilters({ aksiya: '1' }))).toEqual(['amp', 'spf']))
  it('tomorrow = in stock', () => expect(ids(parseFilters({ ertaga: '1' }))).not.toContain('gone'))
  it('price range', () => expect(ids(parseFilters({ dan: '150000', gacha: '240000' }))).toEqual(['revive']))
  it('skin: any of the chosen', () => expect(ids(parseFilters({ teri: 'sens,dry' }))).toEqual(['amp', 'revive', 'spf', 'gone']))
  it('sun = SPF category', () => expect(ids(parseFilters({ muammo: 'sun' }))).toEqual(['spf']))
  it('groups combine with AND', () => expect(ids(parseFilters({ teri: 'dry', brend: 'boj' }))).toEqual(['revive', 'gone']))
  it('type', () => expect(ids(parseFilters({ tur: 'Ampula' }))).toEqual(['amp']))
  it('sorts', () => {
    expect(ids(parseFilters({ tartib: 'cheap' }))).toEqual(['spf', 'revive', 'amp', 'gone'])
    expect(ids(parseFilters({ tartib: 'exp' }))[0]).toBe('amp')
    expect(ids(parseFilters({ tartib: 'new' }))[0]).toBe('revive')
  })
  it('bad input is ignored', () => {
    const f = parseFilters({ tartib: 'x', dan: 'abc', n: '99999' })
    expect(f.sort).toBe('pop')
    expect(f.min).toBeUndefined()
    expect(f.n).toBe(480)
  })
  it('round-trips through the URL', () => {
    const f = parseFilters({ aksiya: '1', teri: 'dry,sens', dan: '100000', tartib: 'cheap', n: '48' })
    expect(filterQuery(f)).toBe('?aksiya=1&dan=100000&teri=dry%2Csens&tartib=cheap&n=48')
    expect(activeCount(f)).toBe(4)
    expect(filterQuery(parseFilters({}))).toBe('')
  })
})
