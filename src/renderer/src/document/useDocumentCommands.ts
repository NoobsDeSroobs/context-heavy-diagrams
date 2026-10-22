import { useCallback, useEffect } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { Stamp } from '@shared/document/documentSave'
import type { DiagramFile } from '@shared/diagram'
import { showAlert } from '../ui/alerts'
import type { AppPreferences } from '../preferences/preferences'

export interface DocumentCommands {
  handleOpen: () => Promise<void>
  handleNew: () => void
  handleOpenRecent: (path: string) => Promise<void>
  handleClearRecent: () => void
  handleClose: () => void
  handleReload: () => Promise<void>
}

// File menu commands that open, close or reload a diagram (ADR 0023).
export function useDocumentCommands({
  nodes,
  edges,
  currentPath,
  isDirty,
  hubDirty,
  loadDiagramIntoCanvas,
  reloadHubRef,
  updatePreferences
}: {
  nodes: Node[]
  edges: Edge[]
  currentPath: string | null
  isDirty: boolean
  hubDirty: boolean
  loadDiagramIntoCanvas: (
    path: string | null,
    diagram: DiagramFile,
    stamp?: Stamp,
    opts?: { keepNoteShadows?: boolean }
  ) => void
  reloadHubRef: React.MutableRefObject<((path: string) => Promise<void>) | null>
  updatePreferences: (patch: Partial<AppPreferences>) => void
}): DocumentCommands {
  // Opens (or focuses, if already open elsewhere) a new window — except
  // when this window's own diagram is currently empty, in which case that
  // empty window is reused instead of leaving it around unused (see
  // ADR 0023's window-reuse addendum).
  const handleOpen = useCallback(async () => {
    try {
      // A window with nothing in it yet has nothing to lose by being
      // reused, rather than leaving it sitting there empty next to the
      // diagram you actually meant to open.
      await window.api.openInNewWindow(nodes.length === 0 && edges.length === 0)
    } catch (error) {
      showAlert(`Open failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [nodes, edges])

  // Always opens a new window, never replaces the current one — see
  // ADR 0023. No file is written, nothing is linked from anywhere.
  const handleNew = useCallback(() => {
    window.api.newWindow()
  }, [])

  // File -> Recent Diagrams -> (an entry). Opens/focuses a window for the
  // path exactly like following a link, except this window is reused
  // in-place if its own diagram is currently empty — same "nothing to
  // lose" rule as handleOpen/drag-and-drop. On a file that's since been
  // moved/deleted, main prunes it from the list and reports found:false —
  // the list re-renders without it once the preferences broadcast lands.
  const handleOpenRecent = useCallback(
    async (path: string) => {
      try {
        const result = await window.api.openRecentDiagram(
          path,
          nodes.length === 0 && edges.length === 0
        )
        if (!result.found)
          showAlert(`Diagram not found — it may have been moved or deleted:\n${path}`)
      } catch (error) {
        showAlert(
          `Couldn't open ${path}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
    [nodes, edges]
  )

  const handleClearRecent = useCallback(() => {
    updatePreferences({ recentDiagrams: [] })
  }, [updatePreferences])

  // File -> Close does not close the OS window: a window is a diagram, not necessarily disposable.
  // It resets the current diagram to a blank one in the same window through loadDiagramIntoCanvas,
  // the full-state reset every load path uses, instead of scattered setState(initial) calls. The
  // confirm() guard is skipped whenever isDirty says there is nothing to lose, not only when the
  // canvas is empty (a diagram can be dirty while empty: add an entity, delete it).
  const handleClose = useCallback(() => {
    if (isDirty && !confirm('Close this diagram? Any changes since the last save will be lost.'))
      return
    loadDiagramIntoCanvas(null, {
      version: 1,
      nodes: [],
      edges: []
    })
    // This is an in-place reset, not a page navigation — main's window
    // registry (windows.ts) otherwise never learns this window stopped
    // showing its old path, and a later attempt to open that same file
    // would just focus this (now blank) window instead of reloading it.
    window.api.clearWindowPath()
  }, [isDirty, loadDiagramIntoCanvas])

  // Re-reads this window's own file from disk and reloads it in place,
  // reusing the same loadDiagramIntoCanvas the initial mount effect uses
  // — for picking up changes made outside the app (hand-edited, or
  // written by other tooling) without quitting and relaunching. Now
  // dirty-aware — a clean window reloads without prompting.
  const handleReload = useCallback(async () => {
    if (!currentPath) return
    if (
      hubDirty &&
      !confirm(
        'Reload from disk? Unsaved changes to the diagram itself will be lost (unsaved note edits are kept).'
      )
    )
      return
    try {
      const { diagram, stamp } = await window.api.openDiagramAtPath(currentPath)
      loadDiagramIntoCanvas(currentPath, diagram, stamp, { keepNoteShadows: true })
    } catch (error) {
      showAlert(`Couldn't reload: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [currentPath, hubDirty, loadDiagramIntoCanvas])

  // Used by the save-conflict dialog's "Take disk" for the diagram — the user has
  // already chosen, so no second confirm (unlike handleReload).
  useEffect(() => {
    reloadHubRef.current = async (path: string) => {
      try {
        const { diagram, stamp } = await window.api.openDiagramAtPath(path)
        loadDiagramIntoCanvas(path, diagram, stamp, { keepNoteShadows: true })
      } catch (error) {
        showAlert(`Couldn't reload: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }, [loadDiagramIntoCanvas, reloadHubRef])

  return { handleOpen, handleNew, handleOpenRecent, handleClearRecent, handleClose, handleReload }
}
