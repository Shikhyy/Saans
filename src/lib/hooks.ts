import { useEffect, useRef, useState } from 'react'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [])

  return reduced
}

/** Stable default options — declared outside the hook so the reference never changes. */
const DEFAULT_OBSERVER_OPTIONS: IntersectionObserverInit = { threshold: 0.05 }

/**
 * Track whether `ref` intersects the viewport without recreating the observer on unstable
 * inline option object literals.
 */
export function useInView<T extends Element>(
  options: IntersectionObserverInit = DEFAULT_OBSERVER_OPTIONS,
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  const { root = null, rootMargin = '0px', threshold = 0.05 } = options
  const thresholdKey = Array.isArray(threshold) ? threshold.join(',') : String(threshold)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const parsedThreshold = thresholdKey.includes(',')
      ? thresholdKey.split(',').map(Number)
      : Number(thresholdKey)
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) setInView(entry.isIntersecting)
      },
      { root, rootMargin, threshold: parsedThreshold },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [root, rootMargin, thresholdKey])

  return [ref, inView]
}
