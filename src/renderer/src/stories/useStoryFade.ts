import { useEffect, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { VisibilitySet } from '@shared/diagram'
import { visibleFilter } from '@shared/visibility/visibility'
import { usePrefersReducedMotion } from '../edges/usePrefersReducedMotion'
import { fadeBetween, type StoryFade } from '../visibility/hiding'

// How long the presenter fades, which is the duration of the animations in stories.css.
export const STORY_FADE_MS = 250

// The elements the presenter is fading right now (ADR 0194), or null. When the hidden sets change
// while presenting, what became visible fades in and what became hidden fades out, and the fade ends
// after STORY_FADE_MS. Nothing fades for a change made outside the presenter, or when the system asks
// for reduced motion: those are immediate.
export function useStoryFade(
  presenting: boolean,
  nodes: Node[],
  edges: Edge[],
  catalogue: VisibilitySet[],
  hiddenSetIds: Set<string>
): StoryFade | null {
  const reducedMotion = usePrefersReducedMotion()
  const [seen, setSeen] = useState(hiddenSetIds)
  const [fade, setFade] = useState<StoryFade | null>(null)
  // The change is worked out while rendering, from the hidden sets this component last saw, so the
  // first frame of the new step already has the classes and nothing flashes.
  if (seen !== hiddenSetIds) {
    setSeen(hiddenSetIds)
    setFade(
      presenting && !reducedMotion
        ? fadeBetween(
            [...nodes, ...edges],
            visibleFilter(catalogue, seen),
            visibleFilter(catalogue, hiddenSetIds)
          )
        : null
    )
  }
  useEffect(() => {
    if (!fade) return
    const timer = setTimeout(() => setFade(null), STORY_FADE_MS)
    return () => clearTimeout(timer)
  }, [fade])
  return fade
}
