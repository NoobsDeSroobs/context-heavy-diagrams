import { useCallback, useState } from 'react'
import type { LegendEntry } from '@shared/diagram'
import type { CanvasApi } from '../canvas/canvasApi'
import { newNodeId } from '../canvas/nodeFields'

export interface LegendState {
  legend: LegendEntry[]
  setLegend: React.Dispatch<React.SetStateAction<LegendEntry[]>>
  legendPanelOpen: boolean
  setLegendPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  legendPanelAnchor: DOMRect | null
  addLegendEntry: (entry: Omit<LegendEntry, 'id'>) => void
  updateLegendEntry: (id: string, patch: Partial<Omit<LegendEntry, 'id'>>) => void
  removeLegendEntry: (id: string) => void
  toggleLegendPanel: (anchorRect: DOMRect) => void
}

export function useLegend({ markDirty }: CanvasApi): LegendState {
  // Legend catalog (ADR 0033) — same file-scoped, persisted
  // treatment as highlights. Unlike highlights, there's no per-entry
  // enabled state; the whole panel's shown/hidden state below is what's
  // session-local instead.
  const [legend, setLegend] = useState<LegendEntry[]>([])
  const [legendPanelOpen, setLegendPanelOpen] = useState(false)
  // Anchors the floating panel next to whichever <ControlButton> opened it —
  // same convention as iconPicker/colorPicker/linePicker's own anchorRect.
  const [legendPanelAnchor, setLegendPanelAnchor] = useState<DOMRect | null>(null)

  // Legend CRUD — no uniqueness constraint (unlike highlights, two entries
  // can legitimately look identical, e.g. two red dots explaining two
  // different unrelated conventions) and no undo/redo integration, same
  // treatment as the highlight catalog.
  const addLegendEntry = useCallback(
    (entry: Omit<LegendEntry, 'id'>) => {
      setLegend((prev) => [...prev, { ...entry, id: newNodeId('legend') }])
      markDirty()
    },
    [markDirty]
  )

  const updateLegendEntry = useCallback(
    (id: string, patch: Partial<Omit<LegendEntry, 'id'>>) => {
      setLegend((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
      markDirty()
    },
    [markDirty]
  )

  const removeLegendEntry = useCallback(
    (id: string) => {
      setLegend((prev) => prev.filter((entry) => entry.id !== id))
      markDirty()
    },
    [markDirty]
  )

  // Anchors the floating panel to whichever element opened it — same
  // convention as iconPicker/colorPicker/linePicker's own anchorRect.
  const toggleLegendPanel = useCallback((anchorRect: DOMRect) => {
    setLegendPanelAnchor(anchorRect)
    setLegendPanelOpen((open) => !open)
  }, [])

  return {
    legend,
    setLegend,
    legendPanelOpen,
    setLegendPanelOpen,
    legendPanelAnchor,
    addLegendEntry,
    updateLegendEntry,
    removeLegendEntry,
    toggleLegendPanel
  }
}
