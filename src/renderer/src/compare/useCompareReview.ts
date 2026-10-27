import { useCallback, useEffect, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import { reviewKey, type ReviewItem } from '@shared/compare/classify'
import type { IdMatches } from '@shared/compare/match'
import type { RevertState } from './CompareList'

// Is `key` this item, or one of the connections listed under it?
function ownsKey(item: ReviewItem, key: string | null): boolean {
  return (
    key !== null &&
    (reviewKey(item) === key || (item.connections ?? []).some((c) => reviewKey(c) === key))
  )
}

// The reviewer's place in the changes list: the selected change, the ones ticked off, what came of
// each revert asked for, and the keys that walk the list. All of it lasts only as long as the
// window. Must be used inside a ReactFlowProvider: selecting a change frames it on the canvas.
export function useCompareReview(
  sessionId: string,
  items: ReviewItem[],
  flow: { nodes: Node[]; edges: Edge[] },
  matches: IdMatches | null
): {
  currentKey: string | null
  reviewed: ReadonlySet<string>
  revertStates: ReadonlyMap<string, RevertState>
  focusItem: (item: ReviewItem) => void
  step: (direction: 1 | -1) => void
  toggleReviewed: (item: ReviewItem) => void
  revertItem: (item: ReviewItem) => Promise<void>
} {
  const rf = useReactFlow()
  // "node:<id>" / "edge:<id>"
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(new Set())
  const [revertStates, setRevertStates] = useState<ReadonlyMap<string, RevertState>>(new Map())

  const focusItem = useCallback(
    (item: ReviewItem) => {
      setCurrentKey(reviewKey(item))
      // A connection is framed by the two elements it joins.
      const ids =
        item.kind === 'node'
          ? [item.id]
          : flow.edges.filter((e) => e.id === item.id).flatMap((e) => [e.source, e.target])
      const targets = flow.nodes.filter((n) => ids.includes(n.id)).map((n) => ({ id: n.id }))
      if (targets.length > 0) {
        void rf.fitView({ nodes: targets, duration: 300, padding: 0.6, maxZoom: 1.5 })
      }
    },
    [flow, rf]
  )
  const step = useCallback(
    (direction: 1 | -1) => {
      if (items.length === 0) return
      // A connection inside a group counts as its element's step.
      const index = items.findIndex((i) => ownsKey(i, currentKey))
      const next =
        index === -1
          ? direction === 1
            ? 0
            : items.length - 1
          : (index + direction + items.length) % items.length
      focusItem(items[next])
    },
    [items, currentKey, focusItem]
  )
  const toggleReviewed = useCallback((item: ReviewItem) => {
    const key = reviewKey(item)
    setReviewed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Asks the editor window of this diagram to put the element back as the earlier version has it.
  // A revert is a decision made, so it also ticks the change off.
  const revertItem = useCallback(
    async (item: ReviewItem) => {
      const key = reviewKey(item)
      const { status } = item.change
      const change = status === 'added' || status === 'removed' ? status : 'modified'
      // The editor must see the earlier version as this window does, matched elements included.
      const result = await window.api.revertFromCompare(
        sessionId,
        item.kind,
        item.id,
        change,
        matches
          ? { nodes: Object.fromEntries(matches.nodes), edges: Object.fromEntries(matches.edges) }
          : undefined
      )
      setRevertStates((prev) => new Map(prev).set(key, result))
      if (result.ok) setReviewed((prev) => new Set(prev).add(key))
    },
    [sessionId, matches]
  )

  // N / P or the arrow keys walk the list; Space ticks the selected change off. Typing in a field
  // and shortcuts with a modifier are left alone.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key === 'n' || event.key === 'ArrowDown') {
        event.preventDefault()
        step(1)
      } else if (event.key === 'p' || event.key === 'ArrowUp') {
        event.preventDefault()
        step(-1)
      } else if (event.key === ' ' && target === document.body && currentKey !== null) {
        event.preventDefault()
        const item = items.find((i) => ownsKey(i, currentKey))
        if (item) toggleReviewed(item)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, items, currentKey, toggleReviewed])

  return { currentKey, reviewed, revertStates, focusItem, step, toggleReviewed, revertItem }
}
