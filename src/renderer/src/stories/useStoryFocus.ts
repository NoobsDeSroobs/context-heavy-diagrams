import { useEffect, useRef } from 'react'
import { useReactFlow, type Edge, type Node } from '@xyflow/react'
import type { Story, VisibilitySet } from '@shared/diagram'
import { focusedNodeIds } from '@shared/visibility/focus'
import { focusAtStep, hiddenAtStep } from '@shared/visibility/story'
import { usePrefersReducedMotion } from '../edges/usePrefersReducedMotion'
import { setIdsOf } from '../visibility/hiding'

// How long the view glides to a step's frame (ADR 0194), next to the fade's STORY_FADE_MS. The two
// start together.
export const STORY_GLIDE_MS = 600

// The room left round the elements a focus frames, as a fraction of the frame (React Flow's own unit).
const FOCUS_PADDING = 0.15

// Moves the view while presenting to what the step is about: the visible elements of the set of the
// last `focus` at or before the step (ADR 0194). Stepping back replays from the start, so it restores
// the earlier frame; a story that has not focused yet leaves the view where the person has it. The
// view jumps when the system asks for reduced motion, as the fade does not happen then.
export function useStoryFocus(
  presenting: boolean,
  story: Story | null,
  step: number,
  catalogue: VisibilitySet[],
  nodes: Node[],
  edges: Edge[]
): void {
  const rf = useReactFlow()
  const reducedMotion = usePrefersReducedMotion()
  // Read when the step changes, not a reason to move by themselves: the presenter edits nothing.
  const latest = useRef({ catalogue, nodes, edges })
  useEffect(() => {
    latest.current = { catalogue, nodes, edges }
  })

  useEffect(() => {
    if (!presenting || !story) return
    const target = focusAtStep(story, step)
    if (target === null) return
    // Two frames: the first step comes with the docks going away, and the view has to have its new size.
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const { catalogue: sets, nodes: all, edges: links } = latest.current
        const ids = focusedNodeIds(
          target,
          all.map((n) => ({ id: n.id, setIds: setIdsOf(n) })),
          links.map((e) => ({ source: e.source, target: e.target, setIds: setIdsOf(e) })),
          sets,
          hiddenAtStep(story, sets, step)
        )
        if (ids.length === 0) return
        const wanted = new Set(ids)
        const bounds = rf.getNodesBounds(all.filter((n) => wanted.has(n.id)))
        if (bounds.width === 0 && bounds.height === 0) return
        void rf.fitBounds(bounds, {
          padding: FOCUS_PADDING,
          duration: reducedMotion ? 0 : STORY_GLIDE_MS
        })
      })
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [presenting, story, step, reducedMotion, rf])
}
