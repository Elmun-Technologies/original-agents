// Any unknown address under /uz or /ru -> the design's 404 page ([lang]/not-found.tsx).
import { notFound } from 'next/navigation'

export default function CatchAll() {
  notFound()
}
