'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** reloads the server data of the current screen every few seconds (the "Hozir" tab) */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh() }, seconds * 1000)
    return () => clearInterval(t)
  }, [router, seconds])
  return null
}
