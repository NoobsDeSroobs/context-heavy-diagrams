import { useCallback, useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { IconRef } from '@shared/diagram'
import type { NoteShadow } from '@shared/document/documentSave'
import { showAlert } from '../ui/alerts'
import type { CanvasApi } from '../canvas/canvasApi'
import {
  criteriaFromQuery,
  elementMatchesCriteria,
  elementMatchesWithDetails,
  hasSearchCriteria,
  parseSearchQuery,
  searchableFromData,
  type SearchCriteria
} from './search'

export interface SearchState {
  searchOverlayOpen: boolean
  searchQuery: string
  deepSearchEnabled: boolean
  setDeepSearchEnabled: React.Dispatch<React.SetStateAction<boolean>>
  deepSearchLoading: boolean
  searchRun: boolean
  searchMatchIds: Set<string>
  searchMatchOrder: string[]
  searchMatchCursor: number
  searchIcon: IconRef | null
  searchIconPicker: DOMRect | null
  setSearchIconPicker: React.Dispatch<React.SetStateAction<DOMRect | null>>
  searchQueryProblems: string[]
  searchUnreadable: string[]
  isolateActive: boolean
  focusSearchMatch: (id: string) => void
  runSearch: () => Promise<void>
  nextSearchMatch: () => void
  prevSearchMatch: () => void
  runIsolate: () => Promise<void>
  onSearchQueryChange: (value: string) => void
  closeSearchOverlay: () => void
  toggleSearchOverlay: () => void
  pickSearchIcon: (icon: IconRef) => Promise<void>
  toggleSearchIconPicker: (anchorRect: DOMRect) => void
  clearSearchIcon: () => void
  resetSearch: () => void
}

// Search overlay (ADR 0062), Isolate (ADR 0063) and icon search (ADR 0072). All session-only,
// reset on load like every other panel's open/enabled state.
export function useSearch(
  { rfInstance, setNodes, setEdges, currentPath }: CanvasApi,
  nodes: Node[],
  edges: Edge[],
  noteShadowsRef: React.RefObject<Record<string, NoteShadow>>
): SearchState {
  // searchRun distinguishes "haven't searched yet" from "searched, zero results";
  // matchOrder is the stable id ordering next/prev cycles through
  // (recomputed each run — nodes first, then edges, insertion order).
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deepSearchEnabled, setDeepSearchEnabled] = useState(false)
  const [deepSearchLoading, setDeepSearchLoading] = useState(false)
  const [searchRun, setSearchRun] = useState(false)
  const [searchMatchIds, setSearchMatchIds] = useState<Set<string>>(new Set())
  const [searchMatchOrder, setSearchMatchOrder] = useState<string[]>([])
  const [searchMatchCursor, setSearchMatchCursor] = useState(0)
  // Icon-identity search (ADR 0072) — when set, the query is "every node
  // carrying this exact icon" and the free-text box is disabled; the two
  // are deliberately not combined (ADR 0062 defers all criteria-combining
  // to a future query language). searchIconPicker holds the anchor rect of
  // the overlay's icon button while its IconBrowser popup is open.
  const [searchIcon, setSearchIcon] = useState<IconRef | null>(null)
  const [searchIconPicker, setSearchIconPicker] = useState<DOMRect | null>(null)
  // Query-token problems (unknown `has:` value, empty `tag:`) shown in the
  // overlay so a typo isn't silently "no matches" (ADR 0096).
  const searchQueryProblems = useMemo(() => parseSearchQuery(searchQuery).problems, [searchQuery])
  // Linked diagrams that couldn't be read during the last deep search — shown
  // in the overlay so a broken link is never silently "no match" (ADR 0097).
  const [searchUnreadable, setSearchUnreadable] = useState<string[]>([])
  // "Isolate" (ADR 0063) — search-driven only: a separate explicit toggle next to Search, not folded
  // into
  // running a search itself, so turning it on/off doesn't require
  // re-searching. Always cleared alongside search results (see
  // clearSearchResults below) since it's meaningless without a live match
  // set to isolate down to.
  const [isolateActive, setIsolateActive] = useState(false)

  // Selects exactly the one matched
  // element and frames the viewport on it — the "fit-to-node/selection"
  // piece folded into search's scope. An edge has no bounding box of
  // its own to fit on, so it fits on its two endpoint nodes instead.
  const focusSearchMatch = useCallback(
    (id: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id }))
      )
      setEdges((eds) =>
        eds.map((e) => (e.selected === (e.id === id) ? e : { ...e, selected: e.id === id }))
      )
      const edge = edges.find((e) => e.id === id)
      if (edge) {
        rfInstance.fitView({
          nodes: [{ id: edge.source }, { id: edge.target }],
          duration: 300,
          padding: 0.5
        })
      } else {
        rfInstance.fitView({ nodes: [{ id }], duration: 300, padding: 0.5 })
      }
    },
    [edges, setNodes, setEdges, rfInstance]
  )

  // Shared "commit this match list" step — the text/deep path in
  // computeAndSetMatches and the icon path in applyIconMatches both end here.
  const applyMatchOrder = useCallback((matchedIds: Set<string>, order: string[]) => {
    setSearchMatchIds(matchedIds)
    setSearchMatchOrder(order)
    setSearchMatchCursor(0)
    setSearchRun(true)
  }, [])

  // Every element that satisfies the criteria (ADR 0096, 0097): free text over id/label/tags and
  // the node's details note, an exact icon, has: facets, all ANDed. A note is read from its unsaved
  // in-memory copy when one is open, else from disk. With Deep search on, a node that links to
  // another diagram also matches when anything in that linked subtree does, so the match lands on
  // the entity in this diagram and cycles like any other. Edges carry no icons, references or
  // notes, so those criteria exclude them.
  const computeMatchIds = useCallback(
    async (criteria: SearchCriteria): Promise<Set<string>> => {
      const matchedIds = new Set<string>()
      setDeepSearchLoading(true)
      try {
        const nodeHits = await Promise.all(
          nodes.map((n) => {
            const shadow = noteShadowsRef.current[n.id]
            const searchable = searchableFromData(n.id, n.data)
            // A note that is open but never saved (a new note, or any note on an unsaved diagram)
            // has no stored path yet, since data.details stays unset until the first save (the
            // sync-on-save convention), but its shadow holds real, searchable content. Without
            // this, elementMatchesViaDetails' `!el.details` gate would treat it as nonexistent. The
            // placeholder value is never read as a path (the shadow branch wins first); it only has
            // to be truthy.
            const details = searchable.details ?? (shadow ? '(unsaved note)' : undefined)
            return elementMatchesWithDetails(
              criteria,
              { ...searchable, details },
              async (relativePath) => {
                if (shadow) return shadow.content
                return currentPath ? window.api.readDetails(currentPath, relativePath) : ''
              }
            )
          })
        )
        nodes.forEach((n, i) => {
          if (nodeHits[i]) matchedIds.add(n.id)
        })
        for (const e of edges) {
          if (elementMatchesCriteria(criteria, searchableFromData(e.id, e.data))) {
            matchedIds.add(e.id)
          }
        }

        if (deepSearchEnabled && currentPath && hasSearchCriteria(criteria)) {
          // The in-memory links, so a link added since the last save is searched.
          const links = nodes.flatMap((n) => {
            const link = n.data?.linkedDiagram
            return typeof link === 'string' && link.trim() !== '' && !matchedIds.has(n.id)
              ? [{ nodeId: n.id, relativePath: link }]
              : []
          })
          try {
            const linked = await window.api.searchLinkedDiagrams(currentPath, links, criteria)
            for (const id of linked.matchedNodeIds) matchedIds.add(id)
            setSearchUnreadable(linked.unreadable)
          } catch (error) {
            showAlert(
              `Couldn't search linked diagrams: ${error instanceof Error ? error.message : String(error)}`
            )
          }
        }
      } finally {
        setDeepSearchLoading(false)
      }
      return matchedIds
    },
    [nodes, edges, currentPath, deepSearchEnabled, noteShadowsRef]
  )

  // The stable next/prev order: nodes in their current array order, then edges.
  const orderMatches = useCallback(
    (matchedIds: Set<string>): string[] =>
      [...nodes, ...edges].filter((el) => matchedIds.has(el.id)).map((el) => el.id),
    [nodes, edges]
  )

  // Shared by both trigger buttons (ADR 0063 split Search and
  // Isolate into two independent actions over the same underlying match
  // computation — only what happens *after* matching differs). Returns the
  // match order, empty when no criterion is set.
  const computeAndSetMatches = useCallback(async (): Promise<string[]> => {
    const criteria: SearchCriteria = criteriaFromQuery(searchQuery, searchIcon)
    if (!hasSearchCriteria(criteria)) return []
    setSearchUnreadable([])
    const matchedIds = await computeMatchIds(criteria)
    const order = orderMatches(matchedIds)
    applyMatchOrder(matchedIds, order)
    return order
  }, [searchIcon, searchQuery, computeMatchIds, orderMatches, applyMatchOrder])

  const runSearch = useCallback(async () => {
    const order = await computeAndSetMatches()
    if (order.length > 0) focusSearchMatch(order[0])
  }, [computeAndSetMatches, focusSearchMatch])

  // Isolate's own viewport action (ADR 0063) — frames every
  // match at once rather than jumping to one, the whole point of the
  // "scope the view down to a working set" framing. rfInstance.fitView
  // already computes the union bounding box for however many node ids
  // it's given, so no manual bbox math is needed here — an edge match
  // just contributes its two endpoint nodes to that set, same reasoning
  // as focusSearchMatch's single-match case above.
  const fitAllMatches = useCallback(
    (order: string[]) => {
      if (order.length === 0) return
      const nodeIds = new Set<string>()
      for (const id of order) {
        const edge = edges.find((e) => e.id === id)
        if (edge) {
          nodeIds.add(edge.source)
          nodeIds.add(edge.target)
        } else {
          nodeIds.add(id)
        }
      }
      rfInstance.fitView({
        nodes: [...nodeIds].map((id) => ({ id })),
        duration: 300,
        padding: 0.5
      })
    },
    [edges, rfInstance]
  )

  const nextSearchMatch = useCallback(() => {
    if (searchMatchOrder.length === 0) return
    const next = (searchMatchCursor + 1) % searchMatchOrder.length
    setSearchMatchCursor(next)
    focusSearchMatch(searchMatchOrder[next])
  }, [searchMatchOrder, searchMatchCursor, focusSearchMatch])

  const prevSearchMatch = useCallback(() => {
    if (searchMatchOrder.length === 0) return
    const prev = (searchMatchCursor - 1 + searchMatchOrder.length) % searchMatchOrder.length
    setSearchMatchCursor(prev)
    focusSearchMatch(searchMatchOrder[prev])
  }, [searchMatchOrder, searchMatchCursor, focusSearchMatch])

  // Shared by the query-changing (stale results shouldn't stay highlighted
  // once the query no longer matches what's on screen) and close paths.
  const clearSearchResults = useCallback(() => {
    setSearchMatchIds(new Set())
    setSearchMatchOrder([])
    setSearchMatchCursor(0)
    setSearchRun(false)
    // Isolate has no meaning without a live match set — see its own state
    // comment above.
    setIsolateActive(false)
    // Any query change or close drops icon mode too (ADR 0072) — the icon
    // and free-text searches never coexist.
    setSearchIcon(null)
    setSearchUnreadable([])
  }, [])

  // Isolate (ADR 0063) is its own trigger, available from the start and not gated on Search having
  // run. When off, it runs the same matching Search does against the typed query and frames every
  // match at once (fitAllMatches) instead of jumping to one. When already on, a second click turns
  // it off and leaves the match set (and Search's next/prev over it) alone: Isolate is a dimming
  // toggle layered on top of it, not a separate state.
  const runIsolate = useCallback(async () => {
    if (isolateActive) {
      setIsolateActive(false)
      return
    }
    const order = await computeAndSetMatches()
    if (order.length === 0) return
    setIsolateActive(true)
    fitAllMatches(order)
  }, [isolateActive, computeAndSetMatches, fitAllMatches])

  const onSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      clearSearchResults()
    },
    [clearSearchResults]
  )

  const closeSearchOverlay = useCallback(() => {
    setSearchOverlayOpen(false)
    setSearchIconPicker(null)
    clearSearchResults()
  }, [clearSearchResults])

  // Shared by the Ctrl+F keydown handler and the command palette's "Open or
  // close search" row (ADR 0100) — one place for the toggle logic instead of
  // two copies drifting.
  const toggleSearchOverlay = useCallback(() => {
    if (searchOverlayOpen) closeSearchOverlay()
    else setSearchOverlayOpen(true)
  }, [searchOverlayOpen, closeSearchOverlay])

  // Auto-run on pick (ADR 0072) — same as IconPicker's own pick-and-close
  // flow: choosing an icon replaces whatever's in the text box, closes the
  // popup, and immediately runs the search + frames the first hit.
  const pickSearchIcon = useCallback(
    async (icon: IconRef) => {
      setSearchQuery('')
      setSearchIcon(icon)
      setSearchIconPicker(null)
      setIsolateActive(false)
      setSearchUnreadable([])
      const matchedIds = await computeMatchIds({
        any: [],
        labels: [],
        ids: [],
        tags: [],
        has: [],
        icon
      })
      const order = orderMatches(matchedIds)
      applyMatchOrder(matchedIds, order)
      if (order.length > 0) focusSearchMatch(order[0])
    },
    [computeMatchIds, orderMatches, applyMatchOrder, focusSearchMatch]
  )

  const toggleSearchIconPicker = useCallback((anchorRect: DOMRect) => {
    setSearchIconPicker((cur) => (cur ? null : anchorRect))
  }, [])

  const clearSearchIcon = useCallback(() => {
    setSearchIconPicker(null)
    clearSearchResults()
  }, [clearSearchResults])

  // Back to the closed, empty state when a diagram is loaded.
  const resetSearch = useCallback(() => {
    setSearchOverlayOpen(false)
    setSearchQuery('')
    setDeepSearchEnabled(false)
    setSearchMatchIds(new Set())
    setSearchMatchOrder([])
    setSearchMatchCursor(0)
    setSearchRun(false)
    setIsolateActive(false)
    setSearchIcon(null)
    setSearchIconPicker(null)
    setSearchUnreadable([])
  }, [])

  return {
    searchOverlayOpen,
    searchQuery,
    deepSearchEnabled,
    setDeepSearchEnabled,
    deepSearchLoading,
    searchRun,
    searchMatchIds,
    searchMatchOrder,
    searchMatchCursor,
    searchIcon,
    searchIconPicker,
    setSearchIconPicker,
    searchQueryProblems,
    searchUnreadable,
    isolateActive,
    focusSearchMatch,
    runSearch,
    nextSearchMatch,
    prevSearchMatch,
    runIsolate,
    onSearchQueryChange,
    closeSearchOverlay,
    toggleSearchOverlay,
    pickSearchIcon,
    toggleSearchIconPicker,
    clearSearchIcon,
    resetSearch
  }
}
