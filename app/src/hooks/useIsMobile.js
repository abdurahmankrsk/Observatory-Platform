'use client'

/**
 * useIsMobile — true when the viewport is phone-sized.
 *
 * Client-only (the app renders with ssr:false, so `window` is always available
 * here). Updates live on resize / orientation change. Used to shrink the fixed
 * UI panels on phones so they don't cover the telescope or the viewed object.
 */
import { useState, useEffect } from 'react'

export function useIsMobile(maxWidth = 640) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [maxWidth])

  return isMobile
}
