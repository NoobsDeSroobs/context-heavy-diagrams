import { useCallback, useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { VisibilitySet } from '@shared/diagram'
import { newSetId, shownFilter, withSet, withoutSet } from '@shared/visibility/visibility'
import type { CanvasApi } from '../canvas/canvasApi'
import { setIdsOf } from './hiding'

export interface VisibilitySetsState {
  panelOpen: boolean
  setPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  panelAnchor: DOMRect | null
  togglePanel: (anchorRect: DOMRect) => void
  addSet: (name: string) => void
  renameSet: (id: string, name: string) => void
  deleteSet: (id: string) => void
  toggleShown: (id: string) => void
  addSelectionTo: (id: string) => void
  removeSelectionFrom: (id: string) => void
  // How many elements are in each set, and how many elements are selected, for the panel.
  memberCounts: Map<string, number>
  selectionCount: number
}

// The visibility sets of ADR 0194. The catalogue is file content and lives in the canvas next to
// the legend; which sets are hidden is session state and is never saved. Hiding only changes what
// is drawn and who can be selected, so it is not an edit; making, renaming and deleting a set, and
// joining or leaving one, are.
export function useVisibilitySets(
  { setNodes, setEdges, pushSnapshot, markDirty }: CanvasApi,
  nodes: Node[],
  edges: Edge[],
  visibilitySets: VisibilitySet[],
  setVisibilitySets: React.Dispatch<React.SetStateAction<VisibilitySet[]>>,
  hiddenSetIds: Set<string>,
  setHiddenSetIds: React.Dispatch<React.SetStateAction<Set<string>>>
): VisibilitySetsState {
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelAnchor, setPanelAnchor] = useState<DOMRect | null>(null)
  const togglePanel = useCallback((anchorRect: DOMRect) => {
    setPanelAnchor(anchorRect)
    setPanelOpen((open) => !open)
  }, [])

  // An element that is selected and then hidden leaves the selection: a hidden element cannot be
  // reached in any way (ADR 0194).
  const deselectHidden = useCallback(
    (sets: VisibilitySet[], hidden: Set<string>) => {
      const shown = shownFilter(sets, hidden)
      setNodes((nds) =>
        nds.some((n) => n.selected && !shown(setIdsOf(n)))
          ? nds.map((n) => (n.selected && !shown(setIdsOf(n)) ? { ...n, selected: false } : n))
          : nds
      )
      setEdges((eds) =>
        eds.some((e) => e.selected && !shown(setIdsOf(e)))
          ? eds.map((e) => (e.selected && !shown(setIdsOf(e)) ? { ...e, selected: false } : e))
          : eds
      )
    },
    [setNodes, setEdges]
  )

  const toggleShown = useCallback(
    (id: string) => {
      const next = new Set(hiddenSetIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setHiddenSetIds(next)
      deselectHidden(visibilitySets, next)
    },
    [hiddenSetIds, setHiddenSetIds, visibilitySets, deselectHidden]
  )

  const addSet = useCallback(
    (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      setVisibilitySets((prev) => [...prev, { id: newSetId(prev), name: trimmed }])
      markDirty()
    },
    [setVisibilitySets, markDirty]
  )

  const renameSet = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      setVisibilitySets((prev) =>
        prev.map((s) => (s.id === id && s.name !== trimmed ? { ...s, name: trimmed } : s))
      )
      markDirty()
    },
    [setVisibilitySets, markDirty]
  )

  const memberCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const el of [...nodes, ...edges]) {
      for (const id of setIdsOf(el) ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [nodes, edges])
  const selectionCount = useMemo(
    () => nodes.filter((n) => n.selected).length + edges.filter((e) => e.selected).length,
    [nodes, edges]
  )

  // Takes the set out of every element that is in it, then out of the catalogue. The elements stay;
  // an undo brings their membership back, and an id with no set in the catalogue is ignored.
  const deleteSet = useCallback(
    (id: string) => {
      const members = memberCounts.get(id) ?? 0
      const name = visibilitySets.find((s) => s.id === id)?.name ?? ''
      if (
        members > 0 &&
        !confirm(`Delete the set "${name}"? Its ${members} element(s) stay in the diagram.`)
      ) {
        return
      }
      if (members > 0) {
        pushSnapshot()
        const strip = <T extends Node | Edge>(el: T): T => {
          const ids = setIdsOf(el)
          if (!ids?.includes(id)) return el
          const rest = withoutSet(ids, id)
          const data = { ...el.data }
          if (rest) data.visibilitySetIds = rest
          else delete data.visibilitySetIds
          return { ...el, data }
        }
        setNodes((nds) => nds.map(strip))
        setEdges((eds) => eds.map(strip))
      }
      setVisibilitySets((prev) => prev.filter((s) => s.id !== id))
      setHiddenSetIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      markDirty()
    },
    [
      memberCounts,
      visibilitySets,
      pushSnapshot,
      setNodes,
      setEdges,
      setVisibilitySets,
      setHiddenSetIds,
      markDirty
    ]
  )

  // Puts the selected nodes and edges into a set, or takes them out. If that leaves a selected
  // element hidden it leaves the selection, like any hidden element.
  const changeSelection = useCallback(
    (id: string, join: boolean) => {
      if (selectionCount === 0) return
      pushSnapshot()
      const shown = shownFilter(visibilitySets, hiddenSetIds)
      const change = <T extends Node | Edge>(el: T): T => {
        if (!el.selected) return el
        const ids = join ? withSet(setIdsOf(el), id) : withoutSet(setIdsOf(el), id)
        const data = { ...el.data }
        if (ids) data.visibilitySetIds = ids
        else delete data.visibilitySetIds
        return { ...el, selected: shown(ids) ? el.selected : false, data }
      }
      setNodes((nds) => nds.map(change))
      setEdges((eds) => eds.map(change))
    },
    [selectionCount, pushSnapshot, visibilitySets, hiddenSetIds, setNodes, setEdges]
  )
  const addSelectionTo = useCallback((id: string) => changeSelection(id, true), [changeSelection])
  const removeSelectionFrom = useCallback(
    (id: string) => changeSelection(id, false),
    [changeSelection]
  )

  return {
    panelOpen,
    setPanelOpen,
    panelAnchor,
    togglePanel,
    addSet,
    renameSet,
    deleteSet,
    toggleShown,
    addSelectionTo,
    removeSelectionFrom,
    memberCounts,
    selectionCount
  }
}
