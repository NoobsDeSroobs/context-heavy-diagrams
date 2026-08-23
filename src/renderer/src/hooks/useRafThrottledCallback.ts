import { useCallback, useEffect, useRef } from 'react'

// Coalesces a high-frequency callback (e.g. a native color-input drag,
// which can fire dozens of onChange events per second — epic 0067) down to
// at most once per animation frame. The display can't show more updates
// than that anyway, so anything between frames is wasted React work; this
// still always fires with the latest value by the time the frame lands,
// never a stale intermediate one, so nothing looks stepped or delayed.
export function useRafThrottledCallback<A extends unknown[]>(
  callback: (...args: A) => void
): (...args: A) => void {
  const callbackRef = useRef(callback)
  // Ref writes must happen in an effect, not during render (React's own
  // rule — see eslint-plugin-react-hooks). This keeps the pending/next
  // animation frame always calling the *latest* callback even if the
  // caller passes a new function reference between renders, rather than a
  // stale one captured when the frame was first scheduled.
  useEffect(() => {
    callbackRef.current = callback
  })
  const frameRef = useRef<number | null>(null)
  const latestArgsRef = useRef<A | null>(null)

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    },
    []
  )

  return useCallback((...args: A) => {
    latestArgsRef.current = args
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const latest = latestArgsRef.current
      if (latest) callbackRef.current(...latest)
    })
  }, [])
}
