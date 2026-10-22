import { useCallback, useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type {
  HighlightDefinition,
  JsonValue,
  MetadataEntry,
  RequiredTagDefinition
} from '@shared/diagram'
import {
  highlightGroupSourceValues,
  highlightId,
  matchingHighlights,
  reconcileHighlightGroup
} from '@shared/tagging/highlights'
import type { CanvasApi } from '../canvas/canvasApi'

export interface HighlightsState {
  highlights: HighlightDefinition[]
  setHighlights: React.Dispatch<React.SetStateAction<HighlightDefinition[]>>
  enabledHighlightIds: Set<string>
  setEnabledHighlightIds: React.Dispatch<React.SetStateAction<Set<string>>>
  highlightsPanelOpen: boolean
  setHighlightsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  highlightsPanelAnchor: DOMRect | null
  toggleHighlightsPanel: (anchorRect: DOMRect) => void
  addHighlight: (key: string, value: JsonValue, color: string) => void
  updateHighlightColor: (id: string, color: string) => void
  removeHighlight: (id: string) => void
  toggleHighlightEnabled: (id: string) => void
  toggleHighlightGroup: (ids: string[], enable: boolean) => void
  usedTags: { key: string; value: JsonValue }[]
  addOrResyncHighlightGroup: (key: string) => void
  matchHighlights: (metadata: Record<string, MetadataEntry> | undefined) => HighlightDefinition[]
}

export function useHighlights(
  { markDirty }: CanvasApi,
  nodes: Node[],
  edges: Edge[],
  requiredTags: RequiredTagDefinition[]
): HighlightsState {
  // Highlight catalog (ADR 0025) — persisted, same file-scoped
  // treatment as diagramMetadata/requiredTags. Which highlights are
  // currently *enabled* is a separate, deliberately volatile Set below —
  // reset on every load, never included in toDiagramFile's payload.
  const [highlights, setHighlights] = useState<HighlightDefinition[]>([])
  const [enabledHighlightIds, setEnabledHighlightIds] = useState<Set<string>>(new Set())
  const [highlightsPanelOpen, setHighlightsPanelOpen] = useState(false)
  // Floating popup next to Legend's, in the bottom-left <Controls> cluster
  // (fix/highlights-free-tags-and-toggle) — same anchorRect convention as
  // legendPanelAnchor, no longer the fixed-position UtilityDock shell
  // it used to be.
  const [highlightsPanelAnchor, setHighlightsPanelAnchor] = useState<DOMRect | null>(null)

  // Anchors the floating panel to whichever element opened it — same
  // convention as toggleLegendPanel/iconPicker/colorPicker/linePicker's own
  // anchorRect.
  const toggleHighlightsPanel = useCallback((anchorRect: DOMRect) => {
    setHighlightsPanelAnchor(anchorRect)
    setHighlightsPanelOpen((open) => !open)
  }, [])

  // Add: enforces key+value uniqueness in the catalog (two highlights for
  // the same exact match would be ambiguous — which color applies?), same
  // reasoning as highlightId's own doc comment. Silently no-ops on a
  // duplicate rather than erroring — the picker only ever offers tags
  // already in use, so a duplicate attempt means the same tag was already
  // added, not a real error condition worth interrupting the user for.
  const addHighlight = useCallback(
    (key: string, value: JsonValue, color: string) => {
      setHighlights((prev) =>
        prev.some((h) => h.key === key && JSON.stringify(h.value) === JSON.stringify(value))
          ? prev
          : [...prev, { key, value, color }]
      )
      markDirty()
    },
    [markDirty]
  )

  const updateHighlightColor = useCallback(
    (id: string, color: string) => {
      setHighlights((prev) => prev.map((h) => (highlightId(h) === id ? { ...h, color } : h)))
      markDirty()
    },
    [markDirty]
  )

  const removeHighlight = useCallback(
    (id: string) => {
      setHighlights((prev) => prev.filter((h) => highlightId(h) !== id))
      setEnabledHighlightIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      markDirty()
    },
    [markDirty]
  )

  const toggleHighlightEnabled = useCallback((id: string) => {
    setEnabledHighlightIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Bulk set (not toggle) — used by a group's tri-state "select all"
  // checkbox, ADR 0026: enabling/disabling every member at
  // once needs a uniform target state, not per-id toggling.
  const toggleHighlightGroup = useCallback((ids: string[], enable: boolean) => {
    setEnabledHighlightIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (enable) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  // Every distinct key/value pair currently tagged somewhere in the
  // diagram — the "Add highlight" picker only ever offers a tag that's
  // actually in use, not a blank freeform entry (a highlight for a tag
  // nothing carries yet would never match anything).
  const usedTags = useMemo(() => {
    const seen = new Map<string, { key: string; value: JsonValue }>()
    const collect = (metadata: Record<string, MetadataEntry> | undefined): void => {
      if (!metadata) return
      for (const [key, entry] of Object.entries(metadata)) {
        const id = `${key}::${JSON.stringify(entry.value)}`
        if (!seen.has(id)) seen.set(id, { key, value: entry.value })
      }
    }
    for (const n of nodes) collect(n.data?.metadata as Record<string, MetadataEntry> | undefined)
    for (const e of edges) collect(e.data?.metadata as Record<string, MetadataEntry> | undefined)
    return [...seen.values()]
  }, [nodes, edges])

  // "Add group" and each group's manual resync button both call this with the same key (ADR 0026).
  // It reconciles against highlightGroupSourceValues (allowedValues for a required tag, else a live
  // scan of every node/edge's metadata): a value with no entry gets a new white one, an entry whose
  // value nothing carries or allows anymore is dropped, the rest is untouched. It also prunes
  // enabledHighlightIds for dropped entries, so a removed row can't leave an orphaned enabled id.
  // The automatic resync below does this for existing groups; this stays the explicit entry point
  // for adding a group that doesn't exist yet.
  const addOrResyncHighlightGroup = useCallback(
    (key: string) => {
      const currentValues = highlightGroupSourceValues(key, requiredTags, usedTags)
      const next = reconcileHighlightGroup(highlights, key, currentValues)
      const nextIds = new Set(next.map(highlightId))
      setHighlights(next)
      setEnabledHighlightIds((prev) => {
        const filtered = new Set([...prev].filter((id) => nextIds.has(id)))
        return filtered.size === prev.size ? prev : filtered
      })
      markDirty()
    },
    [highlights, requiredTags, usedTags, markDirty]
  )

  // Automatic resync (ADR 0026 addendum): every existing group's entries follow their source as it
  // changes (a new allowed value on a required tag, a new value for a free tag appearing in the
  // diagram) without the manual ↻ button. It never creates a group for a key that has none; "Add
  // group" stays the deliberate first step.
  //
  // Computed in the render body, not a useEffect: this is "adjust state as a dependency changes",
  // which the React docs (and this project's lint setup) flag as a setState-in-effect anti-pattern.
  // It is cheap to run every render because reconcileHighlightGroup returns kept entries by
  // reference, so folding it over every key yields either the same array (no setState; the usual
  // case, e.g. during an unrelated drag) or a different one (setState fires once, the re-render
  // finds nothing changed, and it settles: never a loop).
  const existingHighlightKeys = [...new Set(highlights.map((h) => h.key))]
  let resyncedHighlights = highlights
  for (const key of existingHighlightKeys) {
    const currentValues = highlightGroupSourceValues(key, requiredTags, usedTags)
    const candidate = reconcileHighlightGroup(resyncedHighlights, key, currentValues)
    const unchanged =
      candidate.length === resyncedHighlights.length &&
      candidate.every((h, i) => h === resyncedHighlights[i])
    if (!unchanged) resyncedHighlights = candidate
  }
  if (resyncedHighlights !== highlights) {
    const nextIds = new Set(resyncedHighlights.map(highlightId))
    setHighlights(resyncedHighlights)
    setEnabledHighlightIds((prev) => {
      const filtered = new Set([...prev].filter((id) => nextIds.has(id)))
      return filtered.size === prev.size ? prev : filtered
    })
    markDirty()
  }

  const matchHighlights = useCallback(
    (metadata: Record<string, MetadataEntry> | undefined) =>
      matchingHighlights(metadata, highlights, enabledHighlightIds),
    [highlights, enabledHighlightIds]
  )

  return {
    highlights,
    setHighlights,
    enabledHighlightIds,
    setEnabledHighlightIds,
    highlightsPanelOpen,
    setHighlightsPanelOpen,
    highlightsPanelAnchor,
    toggleHighlightsPanel,
    addHighlight,
    updateHighlightColor,
    removeHighlight,
    toggleHighlightEnabled,
    toggleHighlightGroup,
    usedTags,
    addOrResyncHighlightGroup,
    matchHighlights
  }
}
