import { useCallback, useState } from 'react'
import type { ChangesSinceSave } from '@shared/document/changesSinceSave'
import type { NoteShadow } from '@shared/document/documentSave'
import { newNoteShadow } from '@shared/document/documentSave'
import type { CanvasApi } from './canvasApi'

export interface PanelsState {
  detailsPanelNodeId: string | null
  setDetailsPanelNodeId: React.Dispatch<React.SetStateAction<string | null>>
  diagnosticsPanelOpen: boolean
  setDiagnosticsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  preferencesPanelOpen: boolean
  setPreferencesPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  layerPanelOpen: boolean
  setLayerPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  entityHighlightNodeId: string | null
  setEntityHighlightNodeId: React.Dispatch<React.SetStateAction<string | null>>
  stylePalettePanelOpen: boolean
  setStylePalettePanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  alignDistributePanelOpen: boolean
  setAlignDistributePanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  diagramSettingsPanelOpen: boolean
  setDiagramSettingsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  referencesPanelOpen: boolean
  setReferencesPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  changesPanelOpen: boolean
  setChangesPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  changesDiff: ChangesSinceSave | null
  setChangesDiff: React.Dispatch<React.SetStateAction<ChangesSinceSave | null>>
  persona: 'diagram' | 'matrix'
  openDetailsPanel: (nodeId: string) => void
  toggleDiagnosticsPanel: () => void
  togglePreferencesPanel: () => void
  toggleStylePalettePanel: () => void
  toggleAlignDistributePanel: () => void
  toggleLayerPanel: () => void
  toggleDiagramSettingsPanel: () => void
  toggleReferencesPanel: () => void
  toggleChangesPanelWith: (computeChangesDiff: () => void) => void
  handlePersonaChange: (next: 'diagram' | 'matrix') => void
}

// Which dock panel is open, and the persona (diagram or Security Matrix). The Changes panel's
// diff reads the whole diagram, so the canvas computes it and passes the function to
// toggleChangesPanelWith.
export function usePanels(
  { rfInstance, currentPath }: CanvasApi,
  {
    setNoteShadows,
    setDefaultEdgeStylePicker
  }: {
    setNoteShadows: React.Dispatch<React.SetStateAction<Record<string, NoteShadow>>>
    setDefaultEdgeStylePicker: React.Dispatch<React.SetStateAction<DOMRect | null>>
  }
): PanelsState {
  const [diagnosticsPanelOpen, setDiagnosticsPanelOpen] = useState(false)
  const [preferencesPanelOpen, setPreferencesPanelOpen] = useState(false)
  const [stylePalettePanelOpen, setStylePalettePanelOpen] = useState(false)
  const [alignDistributePanelOpen, setAlignDistributePanelOpen] = useState(false)
  const [diagramSettingsPanelOpen, setDiagramSettingsPanelOpen] = useState(false)
  const [detailsPanelNodeId, setDetailsPanelNodeId] = useState<string | null>(null)
  // Layer panel (ADR 0035) — same UtilityDock family as
  // Highlights/Required tags/Diagnostics. No catalog of its own: it reads
  // straight off `nodes`' own zIndex, there's nothing separate to persist.
  const [layerPanelOpen, setLayerPanelOpen] = useState(false)
  // Which node the panel currently points at — an "entity highlight," see
  // DiagramContext's own comment on this field. Session-only, reset on load.
  const [entityHighlightNodeId, setEntityHighlightNodeId] = useState<string | null>(null)
  // Reference images (ADR 0069). `referencesPanelOpen` is the
  // diagram-wide inventory View (same UtilityDock family as Layers).
  const [referencesPanelOpen, setReferencesPanelOpen] = useState(false)
  // "Changes since last save" (ADR 0102) — v1 scope, nodes/edges
  // only. null means "not computed yet" (opening the panel triggers the
  // async reread), distinct from an empty diff (no changes).
  const [changesPanelOpen, setChangesPanelOpen] = useState(false)
  const [changesDiff, setChangesDiff] = useState<ChangesSinceSave | null>(null)
  // Persona switch (see ADR 0055) — akin to FreeCAD's workbench
  // switcher/Affinity's persona tabs: swaps the entire main view, not a
  // split or overlay. Render-only prototype for now (ThreatMatrixView),
  // purely to validate whether a mode swap like this feels right at all —
  // no data flows between personas yet, and diagram state (nodes/edges,
  // panels, etc.) is untouched underneath while 'matrix' is shown, same
  // as switching tabs never destroys the other tab's content.
  const [persona, setPersona] = useState<'diagram' | 'matrix'>('diagram')

  // The utility dock shows one surface at a time (ADR 0013): opening any panel in the family closes
  // the others, so each toggle names every sibling. The repetition is deliberate and low-risk, not
  // worth a generic exclusive-panel abstraction. Highlights and Legend are not in this family: both
  // are floating popups near the bottom-left <Controls>, independent of the dock. Required tags and
  // line bend presets are collapsible sections of DiagramSettingsPanel (ADR 0071), so one toggle
  // covers all three.
  const openDetailsPanel = useCallback(
    (nodeId: string) => {
      setDiagnosticsPanelOpen(false)
      setPreferencesPanelOpen(false)
      setLayerPanelOpen(false)
      setStylePalettePanelOpen(false)
      setAlignDistributePanelOpen(false)
      setDiagramSettingsPanelOpen(false)
      setReferencesPanelOpen(false)
      setChangesPanelOpen(false)
      setDetailsPanelNodeId(nodeId)
      // With no existing file (or nothing saved yet to resolve one against), the shadow is seeded
      // synchronously here, not in the effect below: nothing asynchronous happens in this branch.
      // The functional-updater guard (no closure read of noteShadows) keeps this callback's
      // identity stable however often noteShadows changes (every keystroke while editing), which
      // matters because it goes through DiagramContext's memoized value (ADR 0056).
      // Reads the node off the React Flow instance, not a closed-over `nodes`, for the same
      // stability reason (ADR 0073), as in openReferencesFor.
      const node = rfInstance.getNode(nodeId)
      const existingPath = typeof node?.data?.details === 'string' ? node.data.details : undefined
      if (!existingPath || !currentPath) {
        setNoteShadows((prev) =>
          nodeId in prev ? prev : { ...prev, [nodeId]: newNoteShadow(nodeId) }
        )
      }
    },
    [rfInstance, currentPath, setNoteShadows]
  )

  const toggleDiagnosticsPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setPreferencesPanelOpen(false)
    setLayerPanelOpen(false)
    setStylePalettePanelOpen(false)
    setAlignDistributePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setReferencesPanelOpen(false)
    setChangesPanelOpen(false)
    setDiagnosticsPanelOpen((open) => !open)
  }, [])

  const togglePreferencesPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setLayerPanelOpen(false)
    setStylePalettePanelOpen(false)
    setAlignDistributePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setReferencesPanelOpen(false)
    setChangesPanelOpen(false)
    setPreferencesPanelOpen((open) => !open)
  }, [])

  const toggleStylePalettePanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setPreferencesPanelOpen(false)
    setLayerPanelOpen(false)
    setAlignDistributePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setReferencesPanelOpen(false)
    setChangesPanelOpen(false)
    setStylePalettePanelOpen((open) => !open)
  }, [])

  const toggleAlignDistributePanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setPreferencesPanelOpen(false)
    setLayerPanelOpen(false)
    setStylePalettePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setReferencesPanelOpen(false)
    setChangesPanelOpen(false)
    setAlignDistributePanelOpen((open) => !open)
  }, [])

  const toggleLayerPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setPreferencesPanelOpen(false)
    setStylePalettePanelOpen(false)
    setAlignDistributePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setEntityHighlightNodeId(null)
    setReferencesPanelOpen(false)
    setChangesPanelOpen(false)
    setLayerPanelOpen((open) => !open)
  }, [])

  const toggleDiagramSettingsPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setPreferencesPanelOpen(false)
    setLayerPanelOpen(false)
    setStylePalettePanelOpen(false)
    setAlignDistributePanelOpen(false)
    setReferencesPanelOpen(false)
    setChangesPanelOpen(false)
    setDiagramSettingsPanelOpen((open) => !open)
  }, [])

  const toggleReferencesPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setPreferencesPanelOpen(false)
    setLayerPanelOpen(false)
    setStylePalettePanelOpen(false)
    setAlignDistributePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setChangesPanelOpen(false)
    setReferencesPanelOpen((open) => !open)
  }, [])

  const toggleChangesPanelWith = useCallback((computeChangesDiff: () => void) => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setPreferencesPanelOpen(false)
    setLayerPanelOpen(false)
    setStylePalettePanelOpen(false)
    setAlignDistributePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setReferencesPanelOpen(false)
    setChangesPanelOpen((open) => {
      const next = !open
      if (next) {
        setChangesDiff(null)
        computeChangesDiff()
      }
      return next
    })
  }, [])

  // Persona switch (ADR 0079). Switching to the Security Matrix closes the
  // diagram-only utility-dock panels so a stale Layers/Diagnostics/etc.
  // surface isn't left floating over a view whose menu no longer offers to
  // open it. Preferences stays — it's global, valid in both personas.
  const handlePersonaChange = useCallback(
    (next: 'diagram' | 'matrix') => {
      setPersona(next)
      if (next === 'matrix') {
        setDetailsPanelNodeId(null)
        setDiagnosticsPanelOpen(false)
        setLayerPanelOpen(false)
        setStylePalettePanelOpen(false)
        setAlignDistributePanelOpen(false)
        setDiagramSettingsPanelOpen(false)
        setReferencesPanelOpen(false)
        setChangesPanelOpen(false)
        setDefaultEdgeStylePicker(null)
      }
    },
    [setDefaultEdgeStylePicker]
  )

  return {
    detailsPanelNodeId,
    setDetailsPanelNodeId,
    diagnosticsPanelOpen,
    setDiagnosticsPanelOpen,
    preferencesPanelOpen,
    setPreferencesPanelOpen,
    layerPanelOpen,
    setLayerPanelOpen,
    entityHighlightNodeId,
    setEntityHighlightNodeId,
    stylePalettePanelOpen,
    setStylePalettePanelOpen,
    alignDistributePanelOpen,
    setAlignDistributePanelOpen,
    diagramSettingsPanelOpen,
    setDiagramSettingsPanelOpen,
    referencesPanelOpen,
    setReferencesPanelOpen,
    changesPanelOpen,
    setChangesPanelOpen,
    changesDiff,
    setChangesDiff,
    persona,
    openDetailsPanel,
    toggleDiagnosticsPanel,
    togglePreferencesPanel,
    toggleStylePalettePanel,
    toggleAlignDistributePanel,
    toggleLayerPanel,
    toggleDiagramSettingsPanel,
    toggleReferencesPanel,
    toggleChangesPanelWith,
    handlePersonaChange
  }
}
