import type { CSSProperties } from 'react'

// The pure search model lives in src/shared/search.ts so the main process can
// run the same predicate over linked diagrams (ADR 0097); only the React-facing
// helper stays here.
export * from '@shared/search/search'

// "Isolate" (see ADR 0063) — every node/edge component computes its
// own dimmed-or-not state the same way, so this is the one shared spot for
// it rather than four copies of the same three lines. `{}` (no opacity, no
// transition) whenever Isolate is off at all, so turning it off snaps
// back to normal instead of fading — deliberately not chased further, see
// the ADR. A matched element always gets opacity 1 explicitly rather than
// an absent style, so it still picks up the transition when *other*
// elements around it start/stop being dimmed.
export function isolateStyle(
  id: string,
  isolateActive: boolean,
  searchMatchIds: Set<string>,
  isolateOpacity: number
): CSSProperties {
  if (!isolateActive) return {}
  return {
    opacity: searchMatchIds.has(id) ? 1 : isolateOpacity,
    transition: 'opacity 150ms ease'
  }
}
