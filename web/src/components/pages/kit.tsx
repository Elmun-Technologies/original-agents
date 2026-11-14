// Shared bits for the generated design pages: translation, links and "card n" from real products.
import { ProductCard } from '@/components/ProductCard'
import type { CardProduct } from '@/components/shop'
import { href, t, tn, type Lang } from '@/lib/i18n'

export function kit(lang: Lang, cards: CardProduct[] = []) {
  return {
    tr: (s: string) => t(lang, s),
    tn: (s: string, ...n: (string | number)[]) => tn(lang, s, ...n),
    L: (p: string) => href(lang, p),
    // design card n -> n-th real product (cycled when the catalog is small); none if the list is empty
    C: (i: number) => (cards.length ? <ProductCard key={`${i}`} p={cards[i % cards.length]} lang={lang} /> : null),
  }
}
