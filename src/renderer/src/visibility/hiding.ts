import type { Edge, Node } from '@xyflow/react'

// The visibility set ids of a node or an edge as the canvas holds them, in its data (ADR 0194).
export function setIdsOf(element: { data?: Record<string, unknown> }): string[] | undefined {
  const ids = element.data?.visibilitySetIds
  return Array.isArray(ids) ? (ids as string[]) : undefined
}

// The elements the presenter is fading (ADR 0195): the ones that just became visible, and the ones
// that just became hidden and are kept drawn until their fade is over.
export interface StoryFade {
  entering: ReadonlySet<string>
  leaving: ReadonlySet<string>
}

export const FADE_IN_CLASS = 'story-fading-in'
export const FADE_OUT_CLASS = 'story-fading-out'

const withClass = (current: string | undefined, added: string): string =>
  current ? `${current} ${added}` : added

// The elements as React Flow should draw them: the ones the rule hides get `hidden`, so they are
// not drawn and cannot be selected, while staying in the canvas state, where they keep their place
// and everything attached to them follows. The same array comes back when nothing changes, so
// nothing re-renders for a set that was never hidden.
//
// While the presenter fades (`fade`), an element that is leaving stays drawn with the fade-out class
// and one that is entering gets the fade-in class. The class is only on what is handed to React
// Flow, never on the canvas state. An edge also carries it in its data, since its label is drawn
// outside the edge's own element.
export function withVisibility<T extends Node | Edge>(
  elements: T[],
  visible: (setIds: readonly string[] | undefined) => boolean,
  fade: StoryFade | null = null
): T[] {
  let changed = false
  const next = elements.map((element) => {
    let hide = !visible(setIdsOf(element))
    let fadeClass: string | undefined
    if (fade) {
      if (hide && fade.leaving.has(element.id)) {
        hide = false
        fadeClass = FADE_OUT_CLASS
      } else if (!hide && fade.entering.has(element.id)) {
        fadeClass = FADE_IN_CLASS
      }
    }
    if (hide === (element.hidden === true) && !fadeClass) return element
    changed = true
    const faded = fadeClass
      ? {
          className: withClass(element.className, fadeClass),
          ...('source' in element ? { data: { ...element.data, fadeClass } } : {})
        }
      : {}
    return { ...element, hidden: hide, ...faded }
  })
  return changed ? next : elements
}

// What changes between two choices of hidden sets, for the fade: the elements that were visible and
// are not, and the ones that were not and are. The rule is the caller's (visibleFilter for each).
export function fadeBetween(
  elements: readonly (Node | Edge)[],
  before: (setIds: readonly string[] | undefined) => boolean,
  after: (setIds: readonly string[] | undefined) => boolean
): StoryFade | null {
  const entering = new Set<string>()
  const leaving = new Set<string>()
  for (const element of elements) {
    const ids = setIdsOf(element)
    const was = before(ids)
    const is = after(ids)
    if (was && !is) leaving.add(element.id)
    else if (!was && is) entering.add(element.id)
  }
  return entering.size > 0 || leaving.size > 0 ? { entering, leaving } : null
}
