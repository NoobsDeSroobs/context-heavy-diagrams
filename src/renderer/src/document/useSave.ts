import { useCallback, useEffect, useRef, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import {
  adoptDisk,
  HUB_KEY,
  markSaved,
  planSave,
  resolveConflicts,
  type NoteBaseline,
  type NoteShadow,
  type PlanNoteInput,
  type SavedNote,
  type SaveDocumentRequest,
  type SaveOutcome,
  type Stamp
} from '@shared/document/documentSave'
import { derivedDetailsPath } from '@shared/details/detailPaths'
import type {
  DiagramFile,
  DiagramSecurity,
  EdgeDirectionSet,
  GravityPreset,
  HighlightDefinition,
  JsonValue,
  LegendEntry,
  RequiredTagDefinition
} from '@shared/diagram'
import { showAlert } from '../ui/alerts'
import type { CanvasApi } from '../canvas/canvasApi'
import { applyMissingFileRemoval } from '../diagnostics/resourceRefs'
import type { MissingFileEntry } from '../diagnostics/DiagnosticsPanel'
import { detailsNoteName } from '../details/detailsLabels'
import type { ReferenceWindowEntry } from '../references/useReferences'
import { askConflictResolution, type ConflictItem } from './conflictPrompt'
import { toDiagramFile } from './diagramConversion'
import { SaveAbortedError, isSaveAborted } from './saveAborted'

export interface SaveInputs {
  nodes: Node[]
  edges: Edge[]
  diagramMetadata: Record<string, JsonValue>
  requiredTags: RequiredTagDefinition[]
  highlights: HighlightDefinition[]
  legend: LegendEntry[]
  setLegend: React.Dispatch<React.SetStateAction<LegendEntry[]>>
  gravityPresets: GravityPreset[]
  diagramMaxConnectionPointsPerSide: number | undefined
  edgeDirectionSets: EdgeDirectionSet[]
  activeEdgeDirectionSetId: string | undefined
  security: DiagramSecurity
  stagedFileRemovals: MissingFileEntry[]
  setStagedFileRemovals: React.Dispatch<React.SetStateAction<MissingFileEntry[]>>
  hubDirty: boolean
  setHubDirty: React.Dispatch<React.SetStateAction<boolean>>
  noteShadows: Record<string, NoteShadow>
  setNoteShadows: React.Dispatch<React.SetStateAction<Record<string, NoteShadow>>>
  setReferenceWindows: React.Dispatch<React.SetStateAction<ReferenceWindowEntry[]>>
  setCurrentPath: React.Dispatch<React.SetStateAction<string | null>>
  sessionIdRef: React.MutableRefObject<string>
  loadedSavedWithRef: React.MutableRefObject<string | undefined>
  // Reloads the diagram file from disk keeping unsaved note edits — set once
  // loadDiagramIntoCanvas exists (it is declared after persistDiagram).
  reloadHubRef: React.MutableRefObject<((path: string) => Promise<void>) | null>
  hubBaselineRef: React.MutableRefObject<{ path: string | null; stamp: Stamp }>
  dismissedStampRef: React.MutableRefObject<string | null>
  setExternalChangeStamp: React.Dispatch<React.SetStateAction<string | null>>
}

export interface SaveState {
  showSavedFlash: boolean
  persistDiagram: (
    path: string,
    nodesToSave: Node[],
    opts?: { forceHub?: boolean }
  ) => Promise<Node[]>
  handleSave: () => Promise<void>
  handleSaveAs: () => Promise<void>
  performSaveNow: (nodesToSave: Node[], currentPathNow: string | null) => Promise<string | null>
}

// Saving the diagram and the detail notes it owns (ADR 0092).
export function useSave(
  { setNodes, currentPath }: CanvasApi,
  {
    nodes,
    edges,
    diagramMetadata,
    requiredTags,
    highlights,
    legend,
    setLegend,
    gravityPresets,
    diagramMaxConnectionPointsPerSide,
    edgeDirectionSets,
    activeEdgeDirectionSetId,
    security,
    stagedFileRemovals,
    setStagedFileRemovals,
    hubDirty,
    setHubDirty,
    noteShadows,
    setNoteShadows,
    setReferenceWindows,
    setCurrentPath,
    sessionIdRef,
    loadedSavedWithRef,
    reloadHubRef,
    hubBaselineRef,
    dismissedStampRef,
    setExternalChangeStamp
  }: SaveInputs
): SaveState {
  // Brief post-save confirmation next to the toolbar's Save button — see
  // flashSaved below. Purely transient UI state, not persisted, not reset
  // on load (nothing to reset — it's already false by the time any load
  // finishes).
  const [showSavedFlash, setShowSavedFlash] = useState(false)
  const savedFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Saves the diagram and the detail notes it owns as one operation (ADR 0092) and syncs canvas
  // state to what was written. It is the one place a diagram is persisted, so every save-adjacent
  // flow (manual save, link creation, forward link navigation) goes through it.
  //
  // Flow: build the desired file set (a note's path follows its label, derived now, never stored),
  // plan (planSave: which files are written or moved, is the diagram itself rewritten), then main
  // verifies every file it would overwrite against the disk and applies the writes in the
  // crash-safe order. A conflict writes nothing; the user is asked once and the request is re-sent
  // with overwrite. Only files with something to save are touched: editing one note doesn't rewrite
  // the diagram unless a path in it changes. forceHub: the caller changed the diagram outside
  // normal dirty tracking (link creation).
  const persistDiagram = useCallback(
    async (path: string, nodesToSave: Node[], opts?: { forceHub?: boolean }): Promise<Node[]> => {
      // Apply any staged missing-file removals (ADR 0084) — this is the one
      // point they reach disk. Also drop them from `legend` and close any
      // now-orphaned reference windows.
      let savedNodes = nodesToSave
      let legendToSave = legend
      for (const entry of stagedFileRemovals) {
        const r = applyMissingFileRemoval(savedNodes, legendToSave, entry)
        savedNodes = r.nodes
        legendToSave = r.legend
      }

      // Save As / first save: paths relative to the old location are meaningless.
      const baseline = hubBaselineRef.current
      const newLocation = baseline.path !== path
      const notes: PlanNoteInput[] = []
      for (const n of savedNodes) {
        const nodeDetailsPath = typeof n.data?.details === 'string' ? n.data.details : null
        const shadow = noteShadows[n.id]
        if (nodeDetailsPath === null && !shadow) continue
        const label = typeof n.data?.label === 'string' ? n.data.label : ''
        notes.push({
          nodeId: n.id,
          desiredPath: derivedDetailsPath(path, n.id, label),
          nodeDetailsPath,
          shadow
        })
      }
      const plan = planSave({
        hubDirty: hubDirty || !!opts?.forceHub || newLocation || stagedFileRemovals.length > 0,
        newLocation,
        notes
      })

      // Sets (or, for null, removes) each listed node's note path.
      const withPaths = (list: Node[], paths: Record<string, string | null>): Node[] =>
        list.map((n) => {
          const p = paths[n.id]
          if (p === undefined || (n.data?.details ?? null) === p) return n
          const data = { ...n.data }
          if (p === null) delete data.details
          else data.details = p
          return { ...n, data }
        })
      savedNodes = withPaths(savedNodes, plan.finalPaths)

      // Where each note's node points if that note does not reach its new path
      // (held back by a conflict, or nothing to move): its old path, or none.
      const fallbackPaths: Record<string, string | null> = {}
      const sentContent: Record<string, string> = {}
      for (const op of plan.ops) {
        fallbackPaths[op.nodeId] = op.from
        if (op.kind === 'write') sentContent[op.nodeId] = op.content
      }
      const buildDiagram = (list: Node[]): DiagramFile => ({
        ...toDiagramFile(
          list,
          edges,
          diagramMetadata,
          requiredTags,
          highlights,
          legendToSave,
          gravityPresets,
          diagramMaxConnectionPointsPerSide,
          edgeDirectionSets,
          activeEdgeDirectionSetId,
          security
        ),
        savedWith: loadedSavedWithRef.current
      })
      const request: SaveDocumentRequest = {
        diagramPath: path,
        sessionId: sessionIdRef.current,
        diagram: buildDiagram(savedNodes),
        writeHub: plan.writeHub,
        expectedHubStamp: newLocation ? null : baseline.stamp,
        ops: plan.ops,
        fallbackPaths,
        overwrite: false
      }

      // Records what actually reached disk on each note's shadow; text typed
      // while the save was in flight stays dirty (markSaved).
      const applyNoteResults = (results: Record<string, SavedNote>): void => {
        setNoteShadows((prev) => {
          const next = { ...prev }
          for (const [id, r] of Object.entries(results)) {
            const shadow = next[id]
            if (shadow) {
              next[id] = markSaved(
                shadow,
                r.path,
                r.stamp,
                sentContent[id] ?? shadow.baselineContent
              )
            }
          }
          return next
        })
      }
      const completed = new Set<string>()
      let hubWrittenEver = false
      const applySaved = (o: Extract<SaveOutcome, { status: 'saved' }>): void => {
        applyNoteResults(o.notes)
        for (const id of Object.keys(o.notes)) completed.add(id)
        if (o.hubWritten) {
          hubBaselineRef.current = { path, stamp: o.hubStamp }
          hubWrittenEver = true
        }
        if (o.warnings.length > 0) showAlert(o.warnings.join('\n'))
      }
      const failure = (o: Extract<SaveOutcome, { status: 'failed' }>): Error => {
        applyNoteResults(o.notes)
        if (o.hubWritten) hubBaselineRef.current = { path, stamp: o.hubStamp }
        return new Error(
          `${o.error} (${Object.keys(o.notes).length} note file(s) had already been written; the diagram file ${o.hubWritten ? 'was' : 'was not'} written)`
        )
      }

      // Save everything that can be saved first; conflicts (edited here AND
      // changed on disk) are held back by main and handled at the end.
      const first = await window.api.saveDocument(request)
      if (first.status === 'failed') throw failure(first)
      applySaved(first)
      let aborted = false
      let hubToReload = false
      if (first.conflicts.length > 0) {
        // What is left unsaved now exists only in memory until the user decides,
        // so snapshot it BEFORE asking: a crash during the popup or after Cancel
        // must still be recoverable. The periodic autosave can't be relied on
        // here — it may not have run yet, and an older snapshot predates the
        // diagram file just written, so recovery would ignore it.
        try {
          const heldPaths: Record<string, string | null> = {}
          const drafts: Record<string, string> = {}
          const baselines: Record<string, NoteBaseline> = {}
          for (const op of plan.ops) {
            if (completed.has(op.nodeId)) continue
            heldPaths[op.nodeId] = fallbackPaths[op.nodeId]
            const shadow = noteShadows[op.nodeId]
            if (op.kind === 'write' && shadow) {
              drafts[op.nodeId] = op.content
              baselines[op.nodeId] = {
                originalPath: shadow.originalPath,
                stamp: shadow.baselineStamp,
                baselineContent: shadow.baselineContent
              }
            }
          }
          await window.api.writeRecoverySnapshot(
            path,
            sessionIdRef.current,
            buildDiagram(withPaths(savedNodes, heldPaths)),
            drafts,
            baselines
          )
        } catch {
          // Best effort — never let the safety net block the save flow.
        }
        const items: ConflictItem[] = first.conflicts.map((c) =>
          c.kind === 'hub'
            ? { key: HUB_KEY, kind: 'hub', label: 'The diagram file' }
            : {
                key: c.nodeId ?? '',
                kind: 'note',
                label: detailsNoteName(savedNodes.find((n) => n.id === c.nodeId))
              }
        )
        const decisions = await askConflictResolution(items)
        if (decisions === null) {
          aborted = true
        } else {
          // Per-file resolution (ADR 0092): what to overwrite, what to take from disk.
          const pendingOps = plan.ops.filter((op) => first.remaining.nodeIds.includes(op.nodeId))
          const resolution = resolveConflicts(pendingOps, decisions)
          for (const id of resolution.adoptDiskNodeIds) {
            delete sentContent[id] // my text is being discarded, never recorded as saved
            const shadow = noteShadows[id]
            if (!shadow || shadow.originalPath === null) continue
            const disk = await window.api.readDetailsWithStamp(path, shadow.originalPath)
            setNoteShadows((prev) =>
              prev[id] ? { ...prev, [id]: adoptDisk(prev[id], disk.content, disk.stamp) } : prev
            )
          }
          if (resolution.runOps.length > 0 || resolution.writeHub) {
            const second = await window.api.saveDocument({
              ...request,
              ops: resolution.runOps,
              writeHub: resolution.writeHub,
              overwrite: true
            })
            if (second.status === 'failed') throw failure(second)
            applySaved(second)
          }
          hubToReload = resolution.reloadHub
          // Everything is resolved now, so the snapshot taken before asking is stale
          // (it would offer to "recover" edits that were just saved or discarded). If
          // the diagram is being reloaded, autosave re-snapshots any kept note edits.
          await window.api.deleteRecoverySnapshot(path, sessionIdRef.current)
          await window.api.deleteRecoverySnapshot(null, sessionIdRef.current)
        }
      }

      // The user took the disk's version of the diagram: reload it (unsaved notes
      // are kept) and stop — the plan above was built from state that just changed.
      if (hubToReload) {
        await reloadHubRef.current?.(path)
        showAlert(
          'The diagram was reloaded from disk. Your unsaved note edits were kept — review, then save again.'
        )
        throw new SaveAbortedError()
      }

      // A note that did not complete (missing source, or still held back) leaves
      // its node pointing at the old path.
      const notDone: Record<string, string | null> = {}
      for (const op of plan.ops)
        if (!completed.has(op.nodeId)) notDone[op.nodeId] = fallbackPaths[op.nodeId]
      savedNodes = withPaths(savedNodes, notDone)

      // Notes of elements that no longer exist have nothing left to save.
      const liveIds = new Set(savedNodes.map((n) => n.id))
      setNoteShadows((prev) =>
        Object.keys(prev).every((id) => liveIds.has(id))
          ? prev
          : Object.fromEntries(Object.entries(prev).filter(([id]) => liveIds.has(id)))
      )

      // The diagram's own state is only finalised if it was actually written (or
      // there was nothing to write). If it was held back it stays dirty and
      // staged removals stay staged, so the next save retries them.
      if (hubWrittenEver || !plan.writeHub) {
        setNodes(savedNodes)
        if (legendToSave !== legend) setLegend(legendToSave)
        if (stagedFileRemovals.length > 0) {
          const removedRefs = new Set(
            stagedFileRemovals
              .filter((e) => e.resourceKind === 'reference')
              .map((e) => `${e.ownerId}::${e.relativePath}`)
          )
          if (removedRefs.size > 0) {
            setReferenceWindows((prev) =>
              prev.filter((w) => !removedRefs.has(`${w.nodeId}::${w.path}`))
            )
          }
          setStagedFileRemovals([])
        }
        setHubDirty(false)
        setExternalChangeStamp(null)
        dismissedStampRef.current = null
      }
      // Something stayed unsaved (the user cancelled): not a "Saved" moment.
      if (aborted) throw new SaveAbortedError()
      return savedNodes
    },
    [
      edges,
      setNodes,
      setLegend,
      diagramMetadata,
      requiredTags,
      highlights,
      legend,
      stagedFileRemovals,
      gravityPresets,
      diagramMaxConnectionPointsPerSide,
      edgeDirectionSets,
      activeEdgeDirectionSetId,
      security,
      hubDirty,
      noteShadows,
      setStagedFileRemovals,
      setHubDirty,
      setNoteShadows,
      setReferenceWindows,
      hubBaselineRef,
      dismissedStampRef,
      setExternalChangeStamp,
      sessionIdRef,
      loadedSavedWithRef,
      reloadHubRef
    ]
  )

  // Brief "Saved" confirmation next to the toolbar's Save button — without it a successful save gave
  // no feedback at all (there was only ever an alert on *failure*). Re-triggering the
  // timeout on every successful save (not just the first) means rapid
  // successive saves each restart the same visible flash rather than the
  // indicator disappearing mid-flash.
  const flashSaved = useCallback(() => {
    if (savedFlashTimeoutRef.current != null) clearTimeout(savedFlashTimeoutRef.current)
    setShowSavedFlash(true)
    savedFlashTimeoutRef.current = setTimeout(() => setShowSavedFlash(false), 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (savedFlashTimeoutRef.current != null) clearTimeout(savedFlashTimeoutRef.current)
    }
  }, [])

  const performSave = useCallback(
    async (forceNewPath: boolean) => {
      try {
        let path = forceNewPath ? null : currentPath
        if (!path) {
          path = await window.api.pickSavePath()
          if (!path) return
        }
        await persistDiagram(path, nodes)
        setCurrentPath(path)
        flashSaved()
      } catch (error) {
        if (isSaveAborted(error)) return
        showAlert(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [currentPath, nodes, persistDiagram, flashSaved, setCurrentPath]
  )

  const handleSave = useCallback(() => performSave(false), [performSave])
  const handleSaveAs = useCallback(() => performSave(true), [performSave])

  // Shared by the close-prompt's Save and the drop-prompt's "Save & Open Here": both need "pick a
  // path if there isn't one, then persist" outside an interactive Save click, so it takes its
  // inputs as arguments instead of closing over possibly stale `currentPath`/`nodes` (callers track
  // fresh values via refs, as persistDiagram does with nodesToSave). Returns the path saved to, or
  // null if cancelled or failed.
  const performSaveNow = useCallback(
    async (nodesToSave: Node[], currentPathNow: string | null): Promise<string | null> => {
      let path = currentPathNow
      if (!path) {
        path = await window.api.pickSavePath()
        if (!path) return null
      }
      try {
        await persistDiagram(path, nodesToSave)
        setCurrentPath(path)
        return path
      } catch (error) {
        if (isSaveAborted(error)) return null
        showAlert(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
        return null
      }
    },
    [persistDiagram, setCurrentPath]
  )

  return { showSavedFlash, persistDiagram, handleSave, handleSaveAs, performSaveNow }
}
