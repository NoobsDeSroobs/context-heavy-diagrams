import { useCallback, useEffect, useRef, useState } from 'react'
import { adoptDisk, type NoteShadow, type Stamp } from '@shared/document/documentSave'
import {
  HUB_FILE_KEY,
  changedFiles,
  reloadWarning,
  type ChangedFile,
  type TrackedFile
} from '@shared/document/changedFiles'
import { showAlert } from '../ui/alerts'
import { useEventCallback } from '../canvas/useEventCallback'

export interface OutsideChanges {
  // The files that changed on disk since this window last read or wrote them, and were not
  // ignored. Empty means no notice.
  files: ChangedFile[]
  // Reload only the listed files (the diagram, notes, or both).
  reload: () => Promise<void>
  // Do not announce these changes again; a later change to the same file is announced.
  ignore: () => void
  // The diagram was written: its notice, and its ignored change, no longer apply.
  clear: () => void
  // A different diagram was loaded: forget everything.
  reset: () => void
}

interface Inputs {
  currentPath: string | null
  hubBaselineRef: React.MutableRefObject<{ path: string | null; stamp: Stamp }>
  hubDirty: boolean
  noteShadows: Record<string, NoteShadow>
  setNoteShadows: React.Dispatch<React.SetStateAction<Record<string, NoteShadow>>>
  noteLabel: (nodeId: string) => string
  notesPanelNodeId: string | null
  reloadHubRef: React.MutableRefObject<((path: string) => Promise<void>) | null>
}

// Noticing that the diagram or a note changed outside the app, with one notice for every file
// (ADR 0092, ADR 0159). The tracked files are the diagram and each note this window holds a copy
// of (open, or with unsaved edits). On window focus, and when a note panel opens, one `files:check`
// covers them all. Reload acts on the changed files only; it asks first when that would discard
// unsaved edits. The save-time check is separate and never reads the ignored stamps.
export function useOutsideChanges({
  currentPath,
  hubBaselineRef,
  hubDirty,
  noteShadows,
  setNoteShadows,
  noteLabel,
  notesPanelNodeId,
  reloadHubRef
}: Inputs): OutsideChanges {
  const [files, setFiles] = useState<ChangedFile[]>([])
  const dismissed = useRef<Record<string, string>>({})
  // Only the newest check may set the list: a slow one must not undo a newer answer.
  const latestCheck = useRef(0)

  const check = useEventCallback(async () => {
    const baseline = hubBaselineRef.current
    const tracked: TrackedFile[] = []
    if (currentPath && baseline.path === currentPath) {
      tracked.push({
        key: HUB_FILE_KEY,
        relPath: null,
        baselineStamp: baseline.stamp,
        label: currentPath.split(/[\\/]/).pop() ?? currentPath,
        dirty: hubDirty
      })
    }
    for (const [nodeId, shadow] of Object.entries(noteShadows)) {
      if (shadow.originalPath === null) continue
      tracked.push({
        key: nodeId,
        relPath: shadow.originalPath,
        baselineStamp: shadow.baselineStamp,
        label: noteLabel(nodeId),
        dirty: shadow.dirty
      })
    }
    const mine = ++latestCheck.current
    if (!currentPath || tracked.length === 0) {
      setFiles([])
      return
    }
    const checks = await window.api.checkFiles(
      currentPath,
      tracked.map((t) => ({ relPath: t.relPath, stamp: t.baselineStamp }))
    )
    if (mine === latestCheck.current) setFiles(changedFiles(tracked, checks, dismissed.current))
  })

  // Window focus is when an outside edit (another editor, git, an assistant) has most likely just
  // happened: a cheap stat per file, no watcher and no polling (ADR 0091).
  useEffect(() => {
    if (!currentPath) return undefined
    const onFocus = (): void => void check()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [currentPath, check])

  // A note panel opening on a copy already in memory would otherwise hide a change made meanwhile.
  useEffect(() => {
    if (notesPanelNodeId) void check()
  }, [notesPanelNodeId, check])

  const reload = useEventCallback(async () => {
    if (!currentPath || files.length === 0) return
    const warning = reloadWarning(files)
    if (warning && !confirm(warning)) return
    const hubChanged = files.some((f) => f.key === HUB_FILE_KEY)
    // Read before the diagram reloads, which rebuilds the copies.
    const notes = files
      .filter((f) => f.key !== HUB_FILE_KEY)
      .map((f) => ({ nodeId: f.key, path: noteShadows[f.key]?.originalPath ?? null }))
      .filter((n): n is { nodeId: string; path: string } => n.path !== null)
    if (hubChanged) await reloadHubRef.current?.(currentPath)
    for (const { nodeId, path } of notes) {
      try {
        const { content, stamp } = await window.api.readNotesWithStamp(currentPath, path)
        setNoteShadows((prev) =>
          prev[nodeId] ? { ...prev, [nodeId]: adoptDisk(prev[nodeId], content, stamp) } : prev
        )
      } catch (error) {
        showAlert(`Couldn't reload ${path}: ${error instanceof Error ? error.message : error}`)
      }
    }
    for (const f of files) delete dismissed.current[f.key]
    setFiles([])
  })

  const ignore = useCallback(() => {
    for (const f of files) if (f.stamp !== null) dismissed.current[f.key] = f.stamp
    setFiles([])
  }, [files])

  const clear = useCallback(() => {
    delete dismissed.current[HUB_FILE_KEY]
    setFiles([])
  }, [])

  const reset = useCallback(() => {
    dismissed.current = {}
    setFiles([])
  }, [])

  return { files, reload, ignore, clear, reset }
}
