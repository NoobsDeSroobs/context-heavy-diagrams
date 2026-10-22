import { useCallback, useMemo, useRef, useState } from 'react'
import type { Node } from '@xyflow/react'
import type { IconRef, IconSlot, LegendEntry, RequiredTagDefinition } from '@shared/diagram'
import type { CanvasApi } from '../canvas/canvasApi'
import { syncEdgeMetadata, syncNodeMetadata } from '../tagging/syncElements'
import type { MissingFileEntry } from './DiagnosticsPanel'
import { collectResourceRefs } from './resourceRefs'

export interface DiagnosticsState {
  diagnostics: string[]
  hierarchyLoadNotes: string[]
  setHierarchyLoadNotes: React.Dispatch<React.SetStateAction<string[]>>
  stagedFileRemovals: MissingFileEntry[]
  setStagedFileRemovals: React.Dispatch<React.SetStateAction<MissingFileEntry[]>>
  visibleMissingFiles: MissingFileEntry[]
  runSync: (tags: RequiredTagDefinition[]) => void
  scanMissingFiles: (
    nodeList: Node[],
    legendList: LegendEntry[],
    diagramPath: string | null
  ) => Promise<void>
  stageMissingFileRemoval: (entry: MissingFileEntry) => void
  unstageMissingFileRemoval: (entry: MissingFileEntry) => void
  dismissMissingFile: (entry: MissingFileEntry) => void
  relinkMissingFile: (entry: MissingFileEntry) => Promise<void>
}

// The data behind the Diagnostics panel: required-tag sync notices, load-time hierarchy repairs
// and files that no longer resolve (ADR 0084). Session-only. Whether the panel is open is one of
// the dock panels and lives with them.
export function useDiagnostics({
  setNodes,
  setEdges,
  pushSnapshot,
  markDirty,
  currentPath
}: CanvasApi): DiagnosticsState {
  // Non-blocking notices from the most recent syncElementMetadata pass, *replaced* on every sync,
  // not appended: they show what the last backfill had to correct, not a history log. A file with
  // nothing to correct clears the list.
  const [diagnostics, setDiagnostics] = useState<string[]>([])
  // Notices from healHierarchy at load time (ADR 0075) — a dangling or cyclic
  // parentId that was silently repaired. Session-only, replaced on every load,
  // kept separate from `diagnostics` so a later required-tags sync doesn't
  // wipe it; combined for display in `displayedDiagnostics`.
  const [hierarchyLoadNotes, setHierarchyLoadNotes] = useState<string[]>([])
  // Elements referencing a file that no longer resolves: a linked diagram, custom icon, reference
  // image or details `.md` (ADR 0084). Refreshed by scanMissingFiles on load and by the Diagnostics
  // "Recheck" button; it is an async fs check, so it can't be derived during render. Session-only.
  //
  // "Remove" in the panel doesn't mutate anything: it moves the entry into `stagedFileRemovals`,
  // applied to nodes/legend only on save (persistDiagram). `dismissedFileKeys` hides a row for the
  // session. Both reset on the next scan.
  const [missingFiles, setMissingFiles] = useState<MissingFileEntry[]>([])
  const [stagedFileRemovals, setStagedFileRemovals] = useState<MissingFileEntry[]>([])
  const [dismissedFileKeys, setDismissedFileKeys] = useState<Set<string>>(new Set())

  // Reconciles every eligible node/edge's metadata against `tags` via syncElementMetadata (see its
  // comment for the rules). Runs on file open, in case of hand-edited drift, and whenever the
  // requiredTags template is edited. Deliberately not wrapped in pushSnapshot: this is a
  // diagram-level settings change, not a canvas gesture, and requiredTags isn't part of the {nodes,
  // edges} snapshot, so undoing the metadata edits without the template change would leave the two
  // out of sync.
  const runSync = useCallback(
    (tags: RequiredTagDefinition[]) => {
      const notices: string[] = []
      setNodes((nds) => syncNodeMetadata(nds, tags, notices))
      setEdges((eds) => syncEdgeMetadata(eds, tags, notices))
      setDiagnostics(notices)
    },
    [setNodes, setEdges]
  )

  // Missing-file scan for the Diagnostics panel (ADR 0084): collect every
  // on-disk resource a diagram element references — linked diagrams, custom
  // icons, reference images, details files — ask main which don't resolve,
  // and keep those. Takes the node/legend lists + diagram path explicitly
  // so it can run against a freshly-loaded diagram before that state has
  // committed. An unsaved diagram (no path) can't have resolvable
  // references — reports none.
  const missingFileScanRef = useRef(0)
  const scanMissingFiles = useCallback(
    async (nodeList: Node[], legendList: LegendEntry[], diagramPath: string | null) => {
      // Guard against a stale async result stomping a newer scan (load A
      // then quickly reload B in the same window).
      const scanId = ++missingFileScanRef.current
      // A fresh scan supersedes any pending per-row decisions.
      setStagedFileRemovals([])
      setDismissedFileKeys(new Set())
      const refs = collectResourceRefs(nodeList, legendList)
      if (!diagramPath || refs.length === 0) {
        setMissingFiles([])
        return
      }
      const uniquePaths = [...new Set(refs.map((r) => r.relativePath))]
      let results: { relativePath: string; resolvedPath: string; found: boolean }[]
      try {
        results = await window.api.checkResourceFiles(diagramPath, uniquePaths)
      } catch {
        return
      }
      if (scanId !== missingFileScanRef.current) return
      const missing = new Set(results.filter((r) => !r.found).map((r) => r.relativePath))
      const resolvedByPath = new Map(results.map((r) => [r.relativePath, r.resolvedPath]))
      setMissingFiles(
        refs
          .filter((r) => missing.has(r.relativePath))
          .map((r) => ({
            ...r,
            resolvedPath: resolvedByPath.get(r.relativePath) ?? r.relativePath
          }))
      )
    },
    []
  )

  // Diagnostics missing-file row actions (ADR 0084). None of these touch a
  // file on disk. A removal is *staged* — moved into stagedFileRemovals —
  // and only applied (to nodes/legend) when the diagram is saved, in
  // persistDiagram. "Dismiss" hides a row for the session. "Relink" is an
  // in-memory edit like any other (undoable, dirties, needs a save).
  const stageMissingFileRemoval = useCallback(
    (entry: MissingFileEntry) => {
      setMissingFiles((prev) => prev.filter((m) => m.key !== entry.key))
      setStagedFileRemovals((prev) => [...prev, entry])
      markDirty()
    },
    [markDirty]
  )

  const unstageMissingFileRemoval = useCallback((entry: MissingFileEntry) => {
    setStagedFileRemovals((prev) => prev.filter((m) => m.key !== entry.key))
    setMissingFiles((prev) => [...prev, entry])
  }, [])

  const dismissMissingFile = useCallback((entry: MissingFileEntry) => {
    setDismissedFileKeys((prev) => new Set(prev).add(entry.key))
  }, [])

  const relinkMissingFile = useCallback(
    async (entry: MissingFileEntry) => {
      if (!currentPath || entry.ownerKind !== 'node') return
      let newPath: string | null = null
      if (entry.resourceKind === 'linkedDiagram') {
        newPath = await window.api.pickExistingLinkedDiagram(currentPath)
      } else if (entry.resourceKind === 'icon') {
        newPath = await window.api.pickAndCopyCustomIcon(currentPath)
      }
      if (!newPath) return
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== entry.ownerId) return n
          const d: Record<string, unknown> = { ...n.data }
          if (entry.resourceKind === 'linkedDiagram') {
            d.linkedDiagram = newPath
          } else if (entry.resourceKind === 'icon' && entry.iconSlot) {
            const icons = { ...(d.icons as Partial<Record<IconSlot, IconRef>> | undefined) }
            icons[entry.iconSlot as IconSlot] = { source: 'custom', path: newPath! }
            d.icons = icons
          }
          return { ...n, data: d }
        })
      )
      setMissingFiles((prev) => prev.filter((m) => m.key !== entry.key))
    },
    [currentPath, pushSnapshot, setNodes]
  )

  // Missing-file rows still awaiting a decision (dismissed ones hidden).
  const visibleMissingFiles = useMemo(
    () => missingFiles.filter((m) => !dismissedFileKeys.has(m.key)),
    [missingFiles, dismissedFileKeys]
  )

  return {
    diagnostics,
    hierarchyLoadNotes,
    setHierarchyLoadNotes,
    stagedFileRemovals,
    setStagedFileRemovals,
    visibleMissingFiles,
    runSync,
    scanMissingFiles,
    stageMissingFileRemoval,
    unstageMissingFileRemoval,
    dismissMissingFile,
    relinkMissingFile
  }
}
