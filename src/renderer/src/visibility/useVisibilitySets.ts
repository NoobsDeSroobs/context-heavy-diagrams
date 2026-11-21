import { useCallback, useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { VisibilitySet } from '@shared/diagram'
import {
  nameTaken,
  newSetId,
  shownFilter,
  withSet,
  withoutSet
} from '@shared/visibility/visibility'
import type { CanvasApi } from '../canvas/canvasApi'
import { absolutePosition } from '../nodes/nodePosition'
import { setIdsOf } from './hiding'

// One element of a set, as the panel lists it.
export interface SetMember {
  kind: 'node' | 'edge'
  id: string
  label: string
  // Whether the rule shows it now; a hidden element cannot be selected.
  shown: boolean
}

export interface VisibilitySetsState {
  panelOpen: boolean
  setPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  panelAnchor: DOMRect | null
  togglePanel: (anchorRect: DOMRect) => void
  // Both return why the name was refused, or null when it was taken (a name is unique, ignoring case).
  addSet: (name: string) => string | null
  renameSet: (id: string, name: string) => string | null
  deleteSet: (id: string) => void
  toggleShown: (id: string) => void
  addSelectionTo: (id: string) => void
  removeSelectionFrom: (id: string) => void
  // Takes one element out of a set, and selects one (when it is shown).
  removeMemberFrom: (setId: string, member: SetMember) => void
  selectMember: (member: SetMember) => void
  // The elements in each set, and how many elements are selected, for the panel.
  members: Map<string, SetMember[]>
  selectionCount: number
}

// The visibility sets of ADR 0194. The catalogue is file content and lives in the canvas next to
// the legend; which sets are hidden is session state and is never saved. Hiding only changes what
// is drawn and who can be selected, so it is not an edit; making, renaming and deleting a set, and
// joining or leaving one, are.
export function useVisibilitySets(
  { rfInstance, setNodes, setEdges, pushSnapshot, markDirty }: CanvasApi,
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
    (name: string): string | null => {
      const trimmed = name.trim()
      if (!trimmed) return 'A set needs a name.'
      if (nameTaken(visibilitySets, trimmed)) return `A set named "${trimmed}" already exists.`
      const listed = [...nodes, ...edges].flatMap((el) => setIdsOf(el) ?? [])
      setVisibilitySets((prev) => [...prev, { id: newSetId(prev, listed), name: trimmed }])
      markDirty()
      return null
    },
    [nodes, edges, visibilitySets, setVisibilitySets, markDirty]
  )

  const renameSet = useCallback(
    (id: string, name: string): string | null => {
      const trimmed = name.trim()
      if (!trimmed) return 'A set needs a name.'
      if (nameTaken(visibilitySets, trimmed, id)) return `A set named "${trimmed}" already exists.`
      setVisibilitySets((prev) =>
        prev.map((s) => (s.id === id && s.name !== trimmed ? { ...s, name: trimmed } : s))
      )
      markDirty()
      return null
    },
    [visibilitySets, setVisibilitySets, markDirty]
  )

  const members = useMemo(() => {
    const shown = shownFilter(visibilitySets, hiddenSetIds)
    const nodeLabel = new Map(
      nodes.map((n) => [
        n.id,
        String(n.data?.label ?? '')
          .split('\n')[0]
          .trim() || '(unlabeled)'
      ])
    )
    const bySet = new Map<string, SetMember[]>()
    const add = (setId: string, member: SetMember): void => {
      const list = bySet.get(setId)
      if (list) list.push(member)
      else bySet.set(setId, [member])
    }
    for (const n of nodes) {
      const ids = setIdsOf(n)
      for (const id of ids ?? []) {
        add(id, { kind: 'node', id: n.id, label: nodeLabel.get(n.id)!, shown: shown(ids) })
      }
    }
    for (const e of edges) {
      const ids = setIdsOf(e)
      const text = typeof e.data?.label === 'string' ? e.data.label.split('\n')[0].trim() : ''
      const label = `${text ? `${text}: ` : ''}${nodeLabel.get(e.source) ?? e.source} → ${nodeLabel.get(e.target) ?? e.target}`
      for (const id of ids ?? []) add(id, { kind: 'edge', id: e.id, label, shown: shown(ids) })
    }
    return bySet
  }, [nodes, edges, visibilitySets, hiddenSetIds])
  const selectionCount = useMemo(
    () => nodes.filter((n) => n.selected).length + edges.filter((e) => e.selected).length,
    [nodes, edges]
  )

  // Takes the set out of every element that is in it, then out of the catalogue. The elements stay;
  // an undo brings their membership back, and an id with no set in the catalogue is ignored.
  const deleteSet = useCallback(
    (id: string) => {
      const count = members.get(id)?.length ?? 0
      const name = visibilitySets.find((s) => s.id === id)?.name ?? ''
      if (
        count > 0 &&
        !confirm(`Delete the set "${name}"? Its ${count} element(s) stay in the diagram.`)
      ) {
        return
      }
      if (count > 0) {
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
      members,
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

  const removeMemberFrom = useCallback(
    (setId: string, member: SetMember) => {
      pushSnapshot()
      const change = <T extends Node | Edge>(el: T): T => {
        if (el.id !== member.id) return el
        const ids = withoutSet(setIdsOf(el), setId)
        const data = { ...el.data }
        if (ids) data.visibilitySetIds = ids
        else delete data.visibilitySetIds
        return { ...el, data }
      }
      if (member.kind === 'node') setNodes((nds) => nds.map(change))
      else setEdges((eds) => eds.map(change))
    },
    [pushSnapshot, setNodes, setEdges]
  )

  // The part of the canvas an element takes up, in flow coordinates; an edge takes up the two
  // elements it joins.
  const boxOf = useCallback(
    (member: SetMember): { x: number; y: number; width: number; height: number } | null => {
      const byId = new Map(nodes.map((n) => [n.id, n]))
      const boxOfNode = (
        id: string
      ): { x: number; y: number; width: number; height: number } | null => {
        const n = byId.get(id)
        if (!n) return null
        const at = absolutePosition(n, byId)
        return {
          x: at.x,
          y: at.y,
          width: n.measured?.width ?? n.width ?? 0,
          height: n.measured?.height ?? n.height ?? 0
        }
      }
      if (member.kind === 'node') return boxOfNode(member.id)
      const edge = edges.find((e) => e.id === member.id)
      const ends = edge ? [boxOfNode(edge.source), boxOfNode(edge.target)] : []
      const found = ends.filter((b): b is NonNullable<typeof b> => b !== null)
      if (found.length === 0) return null
      const left = Math.min(...found.map((b) => b.x))
      const top = Math.min(...found.map((b) => b.y))
      const right = Math.max(...found.map((b) => b.x + b.width))
      const bottom = Math.max(...found.map((b) => b.y + b.height))
      return { x: left, y: top, width: right - left, height: bottom - top }
    },
    [nodes, edges]
  )

  // Moves the view to an element that is not fully in it, keeping the zoom; one already in view
  // leaves the view alone.
  const revealMember = useCallback(
    (member: SetMember) => {
      const box = boxOf(member)
      const pane = document.querySelector('.react-flow')?.getBoundingClientRect()
      if (!box || !pane || pane.width <= 0 || pane.height <= 0) return
      const topLeft = rfInstance.flowToScreenPosition({ x: box.x, y: box.y })
      const bottomRight = rfInstance.flowToScreenPosition({
        x: box.x + box.width,
        y: box.y + box.height
      })
      const inView =
        topLeft.x >= pane.left &&
        topLeft.y >= pane.top &&
        bottomRight.x <= pane.right &&
        bottomRight.y <= pane.bottom
      if (inView) return
      void rfInstance.setCenter(box.x + box.width / 2, box.y + box.height / 2, {
        zoom: rfInstance.getZoom(),
        duration: 300
      })
    },
    [boxOf, rfInstance]
  )

  // Selects just this element and brings it into view; a hidden one cannot be selected.
  const selectMember = useCallback(
    (member: SetMember) => {
      if (!member.shown) return
      revealMember(member)
      setNodes((nds) =>
        nds.map((n) => {
          const want = member.kind === 'node' && n.id === member.id
          return n.selected === want ? n : { ...n, selected: want }
        })
      )
      setEdges((eds) =>
        eds.map((e) => {
          const want = member.kind === 'edge' && e.id === member.id
          return e.selected === want ? e : { ...e, selected: want }
        })
      )
    },
    [setNodes, setEdges, revealMember]
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
    removeMemberFrom,
    selectMember,
    members,
    selectionCount
  }
}
