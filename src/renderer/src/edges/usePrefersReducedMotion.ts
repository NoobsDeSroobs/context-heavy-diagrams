import { useSyncExternalStore } from 'react'

// Whether the operating system asks for reduced motion (ADR 0141). Windows reports it when
// "Animation effects" is off, and also in a Remote Desktop session and in many virtual machines, so
// it is only the default for animated edges: the person's own choice in Preferences or the View menu
// wins over it. Follows the setting live.
const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(QUERY)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
