import { useCallback, useEffect, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import {
  dirtyBaselines,
  dirtyDrafts,
  type NoteShadow,
  type Stamp
} from '@shared/document/documentSave'
import {
  createEmptyDiagram,
  type DiagramFile,
  type DiagramSecurity,
  type EdgeDirectionSet,
  type GravityPreset,
  type HighlightDefinition,
  type JsonValue,
  type LegendEntry,
  type RequiredTagDefinition
} from '@shared/diagram'
import { diffDiagrams, summarizeChanges } from '@shared/document/changesSinceSave'
import { showAlert } from '../ui/alerts'
import type { CanvasApi } from '../canvas/canvasApi'
import { toDiagramFile } from './diagramConversion'
import { shadowsFromSnapshot } from './noteShadows'

export interface WindowLifecycleInputs {
  isDirty: boolean
  nodes: Node[]
  edges: Edge[]
  diagramMetadata: Record<string, JsonValue>
  requiredTags: RequiredTagDefinition[]
  highlights: HighlightDefinition[]
  legend: LegendEntry[]
  gravityPresets: GravityPreset[]
  diagramMaxConnectionPointsPerSide: number | undefined
  edgeDirectionSets: EdgeDirectionSet[]
  activeEdgeDirectionSetId: string | undefined
  security: DiagramSecurity
  noteShadows: Record<string, NoteShadow>
  setNoteShadows: React.Dispatch<React.SetStateAction<Record<string, NoteShadow>>>
  sessionIdRef: React.MutableRefObject<string>
  loadedSavedWithRef: React.MutableRefObject<string | undefined>
  loadDiagramIntoCanvas: (
    path: string | null,
    diagram: DiagramFile,
    stamp?: Stamp,
    opts?: { keepNoteShadows?: boolean }
  ) => void
  performSaveNow: (nodesToSave: Node[], currentPathNow: string | null) => Promise<string | null>
}

// How this window starts (the diagram it was opened with, recovery of an unexpected close) and
// ends (autosave snapshots, the close prompt, files dropped on it), ADR 0040.
export function useWindowLifecycle(
  { rfInstance, markDirty, currentPath }: CanvasApi,
  {
    isDirty,
    nodes,
    edges,
    diagramMetadata,
    requiredTags,
    highlights,
    legend,
    gravityPresets,
    diagramMaxConnectionPointsPerSide,
    edgeDirectionSets,
    activeEdgeDirectionSetId,
    security,
    noteShadows,
    setNoteShadows,
    sessionIdRef,
    loadedSavedWithRef,
    loadDiagramIntoCanvas,
    performSaveNow
  }: WindowLifecycleInputs
): void {
  // A window opened with an initial diagram (File -> Open, or either link-navigation flow) gets it
  // via a ?path= query string, read here rather than in main so it reuses the tested load path (ADR
  // 0023). Ref-guarded, not an empty deps array, so it survives StrictMode's dev double-invoke and
  // doesn't re-fire if loadDiagramIntoCanvas's identity changes (ADR 0018 covers why this file is
  // careful about effect double-runs).
  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    const path = new URLSearchParams(window.location.search).get('path')
    if (!path) return
    window.api
      .openDiagramAtPath(path)
      .then(async ({ diagram, stamp }) => {
        loadDiagramIntoCanvas(path, diagram, stamp)
        // Crash recovery (ADR 0040) — a snapshot newer than the
        // real file means the last session ended without saving (crash or
        // force-quit). Prompted, not silently preferred, so a stale
        // recovery snapshot can never clobber a real out-of-app edit.
        const recovered = await window.api.checkRecoveryForPath(path)
        if (!recovered) return
        if (
          confirm(
            'Unsaved changes from an unexpected close were found for this diagram. Recover them?'
          )
        ) {
          loadDiagramIntoCanvas(path, recovered.diagram)
          setNoteShadows(shadowsFromSnapshot(recovered))
          markDirty()
        } else {
          window.api.deleteRecoverySnapshot(path, sessionIdRef.current)
        }
      })
      .catch((error) => {
        showAlert(
          `Couldn't open ${path}: ${error instanceof Error ? error.message : String(error)}`
        )
      })
  }, [loadDiagramIntoCanvas, markDirty, setNoteShadows, sessionIdRef])

  // A window created by the startup orphan scan (recovery.ts) — a diagram
  // that crashed before ever being saved, so there's no path for the
  // effect above to key a lookup against. Main pushes the content directly
  // once this fresh window's finished loading. Loaded as unsaved (no
  // path, marked dirty) rather than treated as already-saved content.
  useEffect(() => {
    return window.api.onRecoveredOrphan((snapshot) => {
      loadDiagramIntoCanvas(null, snapshot.diagram)
      setNoteShadows(shadowsFromSnapshot(snapshot))
      markDirty()
    })
  }, [loadDiagramIntoCanvas, markDirty, setNoteShadows])

  // Periodic autosave (ADR 0040) — every 5 s (was 60 s; an edit made and then
  // killed within the minute was simply lost), but only while isDirty AND only if
  // something changed since the last snapshot (same object references = nothing
  // to write), so an idle dirty window costs nothing. Refs, not effect deps, carry the
  // latest values into the interval callback: re-creating the interval on
  // every nodes/edges change (which is most renders) would mean it almost
  // never actually reaches its own timeout.
  const autosaveStateRef = useRef({
    isDirty,
    currentPath,
    nodes,
    edges,
    diagramMetadata,
    requiredTags,
    highlights,
    legend,
    gravityPresets,
    diagramMaxConnectionPointsPerSide,
    edgeDirectionSets,
    activeEdgeDirectionSetId,
    security,
    noteShadows
  })
  useEffect(() => {
    autosaveStateRef.current = {
      isDirty,
      currentPath,
      nodes,
      edges,
      diagramMetadata,
      requiredTags,
      highlights,
      legend,
      gravityPresets,
      diagramMaxConnectionPointsPerSide,
      edgeDirectionSets,
      activeEdgeDirectionSetId,
      security,
      noteShadows
    }
  })
  const lastSnapshotStateRef = useRef<typeof autosaveStateRef.current | null>(null)
  useEffect(() => {
    const interval = setInterval(() => {
      const s = autosaveStateRef.current
      if (!s.isDirty) return
      const last = lastSnapshotStateRef.current
      if (last && (Object.keys(s) as (keyof typeof s)[]).every((k) => last[k] === s[k])) return
      lastSnapshotStateRef.current = s
      const diagram: DiagramFile = {
        ...toDiagramFile(
          s.nodes,
          s.edges,
          s.diagramMetadata,
          s.requiredTags,
          s.highlights,
          s.legend,
          s.gravityPresets,
          s.diagramMaxConnectionPointsPerSide,
          s.edgeDirectionSets,
          s.activeEdgeDirectionSetId,
          s.security
        ),
        savedWith: loadedSavedWithRef.current
      }
      window.api.writeRecoverySnapshot(
        s.currentPath,
        sessionIdRef.current,
        diagram,
        dirtyDrafts(s.noteShadows),
        dirtyBaselines(s.noteShadows)
      )
    }, 5_000)
    return () => clearInterval(interval)
  }, [rfInstance, sessionIdRef, loadedSavedWithRef])

  // Real OS window close (close button, Alt+F4) — main intercepts it and
  // asks the renderer whether it's safe to proceed (ADR 0040).
  // A clean window approves immediately; a dirty one drives the native
  // Save/Discard/Cancel dialog, reusing this window's own existing save
  // flow (performSave) rather than duplicating "how to actually save" in
  // main. Refs for the same reason as the autosave timer above — this
  // subscribes once, not on every isDirty/currentPath change.
  const closeCheckStateRef = useRef({ isDirty, currentPath, nodes })
  useEffect(() => {
    closeCheckStateRef.current = { isDirty, currentPath, nodes }
  })

  // One-line change-count for the close-prompt's native dialog (ADR 0102) —
  // reads the same autosaveStateRef the autosave snapshot uses,
  // for the same "don't rebind this listener on every nodes/edges change"
  // reason. Best-effort: any failure (e.g. an unreadable file) just omits
  // the detail line rather than blocking the close flow.
  const buildCloseChangesSummary = useCallback(async (): Promise<string | undefined> => {
    const s = autosaveStateRef.current
    try {
      const saved = s.currentPath
        ? ((await window.api.rereadDiagramForDiff(s.currentPath)) ?? createEmptyDiagram())
        : createEmptyDiagram()
      const current = toDiagramFile(
        s.nodes,
        s.edges,
        s.diagramMetadata,
        s.requiredTags,
        s.highlights,
        s.legend,
        s.gravityPresets,
        s.diagramMaxConnectionPointsPerSide,
        s.edgeDirectionSets,
        s.activeEdgeDirectionSetId,
        s.security
      )
      return summarizeChanges(diffDiagrams(saved, current)) || undefined
    } catch {
      return undefined
    }
  }, [])

  useEffect(() => {
    return window.api.onCloseRequested(async () => {
      const {
        isDirty: dirtyNow,
        currentPath: pathNow,
        nodes: nodesNow
      } = closeCheckStateRef.current
      if (!dirtyNow) {
        window.api.closeApproved(pathNow, sessionIdRef.current)
        return
      }
      const decision = await window.api.requestCloseDecision(await buildCloseChangesSummary())
      if (decision === 'cancel') return
      if (decision === 'discard') {
        window.api.closeApproved(pathNow, sessionIdRef.current)
        return
      }
      const savedPath = await performSaveNow(nodesNow, pathNow)
      if (savedPath) window.api.closeApproved(savedPath, sessionIdRef.current)
    })
  }, [performSaveNow, buildCloseChangesSummary, sessionIdRef])

  // "Save changes, Open Here" (drop onto a dirty window) —
  // main shows the dialog and asks back here since it can't perform the
  // save itself; once done, confirmSavedThenOpen tells main it's safe to
  // navigate this window to the dropped path. A cancelled/failed save
  // just leaves this window as-is, same as the close-prompt's own Cancel.
  useEffect(() => {
    return window.api.onPerformSaveThenOpenDropped(async (path) => {
      const { nodes: nodesNow, currentPath: pathNow } = closeCheckStateRef.current
      const savedPath = await performSaveNow(nodesNow, pathNow)
      if (savedPath) window.api.confirmSavedThenOpen(path)
    })
  }, [performSaveNow])

  // Drag-and-drop a .chd onto this window — attached to the
  // whole window, not a specific drop zone: React Flow's own node dragging
  // uses pointer events, not the HTML5 Drag-and-Drop API, so the two never
  // compete for the same gesture. Refs, not effect deps, for the same
  // reason as the autosave/close-check state above — this subscribes once.
  const dropStateRef = useRef({ isDirty, currentPath, nodes, edges })
  useEffect(() => {
    dropStateRef.current = { isDirty, currentPath, nodes, edges }
  })
  useEffect(() => {
    // Both dragenter and dragover need preventDefault — Chromium only
    // treats a drop target as valid once both agree, even though in
    // practice dragover alone is enough in most builds.
    const onDragEnter = (event: DragEvent): void => {
      event.preventDefault()
    }
    const onDragOver = (event: DragEvent): void => {
      event.preventDefault()
    }
    const onDrop = (event: DragEvent): void => {
      event.preventDefault()
      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return
      // Rejected upfront by extension, matching the file dialog's own
      // filter — no attempt to read a non-.chd file and fail gracefully.
      const paths = Array.from(files)
        .map((file) => window.api.getPathForFile(file))
        .filter((path) => path.toLowerCase().endsWith('.chd'))
      if (paths.length === 0) {
        showAlert('Only .chd diagram files can be opened this way.')
        return
      }
      const s = dropStateRef.current
      window.api.handleDroppedFiles(
        paths,
        s.nodes.length === 0 && s.edges.length === 0,
        s.isDirty,
        s.currentPath,
        sessionIdRef.current
      )
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [sessionIdRef])
}
