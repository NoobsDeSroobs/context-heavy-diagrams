import { useCallback, useEffect, useRef } from 'react'

// A permanently-stable wrapper around a callback whose own identity changes
// every render (because it closes over frequently-changing state). The
// returned function keeps the same reference for the component's whole
// lifetime but always invokes the latest `fn` — React's "useEvent" pattern.
//
// Use it only for genuine event handlers (things called in response to a
// user action, never during render or a layout effect — the latest `fn` is
// only guaranteed current after the passive effect below has run). In this
// codebase the motivating case is a handler threaded through the memoized
// DiagramContext value (ADR 0056 / ADR 0073): if its identity churns, so
// does the context value, re-rendering every node and edge.
//
// Same ref-in-an-effect shape as useRafThrottledCallback — a ref write
// during render is disallowed by the react-hooks lint rules.
export function useEventCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  return useCallback((...args: A) => ref.current(...args), [])
}
