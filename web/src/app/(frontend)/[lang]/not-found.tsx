// 404 — design/screens/NotFound.jpg (Next renders it inside the [lang] layout)
import { NotFoundPage } from '@/components/pages/NotFound'
import { kit } from '@/components/pages/kit'
import { findCards } from '@/lib/catalog'

export default async function NotFound() {
  // ponytail: the not-found boundary has no params; Uzbek (default language) until Next passes them
  const cards = await findCards('uz', {}, 5, 'createdAt')
  const k = kit('uz', cards)
  return <NotFoundPage tr={k.tr} L={k.L} C={k.C} />
}
