import { describe, expect, it } from 'vitest'

import ru from '@/i18n/ru.json'
import extra from '@/i18n/ru.extra.json'
import { icu, tn } from '@/lib/i18n'

describe('Russian plurals', () => {
  const cases: [string, number, string][] = [
    ['[N] sharh', 1, '1 отзыв'], ['[N] sharh', 2, '2 отзыва'], ['[N] sharh', 4, '4 отзыва'], ['[N] sharh', 5, '5 отзывов'],
    ['[N] sharh', 11, '11 отзывов'], ['[N] sharh', 21, '21 отзыв'], ['[N] sharh', 22, '22 отзыва'], ['[N] sharh', 214, '214 отзывов'],
    ['[N] daqiqa', 1, '1 минута'], ['[N] daqiqa', 3, '3 минуты'], ['[N] daqiqa', 5, '5 минут'], ['[N] daqiqa', 12, '12 минут'],
    ['[N] ta mahsulot', 1, '1 товар'], ['[N] ta mahsulot', 2, '2 товара'], ['[N] ta mahsulot', 25, '25 товаров'], ['[N] ta mahsulot', 101, '101 товар'],
    ['[N] kun ichida, savolsiz', 1, 'В течение 1 дня, без лишних вопросов'],
    ['[N] kun ichida, savolsiz', 14, 'В течение 14 дней, без лишних вопросов'],
    ['Toshkent boʻylab [N] kunda', 1, 'По Ташкенту за 1 день'],
    ['Toshkent boʻylab [N] kunda', 2, 'По Ташкенту за 2 дня'],
    ['Toshkent boʻylab [N] kunda', 5, 'По Ташкенту за 5 дней'],
  ]
  it.each(cases)('%s × %i', (uz, n, want) => expect(tn('ru', uz, n)).toBe(want))

  it('ranges take the form of the last number', () => {
    expect(tn('ru', 'Toshkent boʻylab [N] kunda, viloyatlarga [N] kunda. Buyurtma yoʻlga chiqqanda Telegram bot xabar beradi.', 1, '2–4'))
      .toBe('По Ташкенту за 1 день, в регионы — за 2–4 дня. Когда заказ выедет, Telegram-бот пришлёт уведомление.')
  })

  it('uzbek keeps the noun and fills numbers', () => {
    expect(tn('uz', '[N] sharh', 214)).toBe('214 sharh')
    expect(tn('uz', '[N] kun ichida, savolsiz', 14)).toBe('14 kun ichida, savolsiz')
  })

  it('formats large numbers with spaces', () => expect(tn('ru', '[N] sharh', 1250)).toBe('1 250 отзывов'))

  it('icu falls back to other', () => expect(icu('{n1, plural, other {# шт.}}', { n1: 3 })).toBe('3 шт.'))

  // Guard: a site-filled number ([N]) must not sit next to a Russian noun that changes with the number.
  it('no [N] next to a declinable noun in the dictionaries', () => {
    const merged: Record<string, string> = { ...ru, ...extra }
    const bad = Object.entries(merged).filter(([, v]) =>
      /\[N\]\s*(дн(?!\.)|день|дня|дней|минут|отзыв|товар|вопрос|покуп|шаг|балл|месяц|год|лет)/i.test(v))
    expect(bad.map(([k]) => k)).toEqual([])
  })
})
