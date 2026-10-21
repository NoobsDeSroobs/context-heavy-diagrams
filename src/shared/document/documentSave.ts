// Pure model behind saving a diagram and the files it owns as one operation
// (docs/decisions/0092-unified-multi-file-save-and-change-detection.md).
//
// The diagram file is the "hub"; each detail note the user has touched is a "shadow" (NoteShadow):
// an in-memory copy of one real file with its own dirty flag, kept apart from the diagram's data
// model. The module has no runtime imports and no I/O (a type import only), so it can be
// unit-tested with plain node:test (`npm test`). The renderer owns the shadows; main executes the
// plan (src/main/document/documentSaveExec.ts). Paths are relative to the diagram file's directory,
// '/'-separated.

import type { DiagramFile } from '../diagram'

// A file's cheap change fingerprint (mtime:size, see src/main/document/fileStamp.ts).
// null = no baseline / file absent.
export type Stamp = string | null

export interface NoteShadow {
  nodeId: string
  // The real file this shadow mirrors — the file's identity until Save moves
  // it. null = the note has no file on disk yet.
  originalPath: string | null
  baselineStamp: Stamp
  // What the file contained when last read/written; `dirty` is exactly
  // `content !== baselineContent`, maintained at the one edit site.
  baselineContent: string
  content: string
  dirty: boolean
}

// A note the user opened that has no file yet.
export function newNoteShadow(nodeId: string): NoteShadow {
  return {
    nodeId,
    originalPath: null,
    baselineStamp: null,
    baselineContent: '',
    content: '',
    dirty: false
  }
}

// A note freshly read from disk.
export function loadedNoteShadow(
  nodeId: string,
  originalPath: string,
  stamp: Stamp,
  content: string
): NoteShadow {
  return {
    nodeId,
    originalPath,
    baselineStamp: stamp,
    baselineContent: content,
    content,
    dirty: false
  }
}

// A draft restored from a crash-recovery snapshot: no baseline is known, so it
// is dirty and never conflict-checked (same as before this model existed).
export function recoveredNoteShadow(
  nodeId: string,
  originalPath: string | null,
  content: string
): NoteShadow {
  return {
    nodeId,
    originalPath,
    baselineStamp: null,
    baselineContent: '',
    content,
    dirty: true
  }
}

// The one edit site. Comparing just the edited note keeps the flag exact
// (typing something back to the original text is clean again) at the cost of a
// single string compare per keystroke.
export function editNote(shadow: NoteShadow, content: string): NoteShadow {
  return { ...shadow, content, dirty: content !== shadow.baselineContent }
}

// Take the disk's version: baseline and content both become it, edits dropped.
export function adoptDisk(shadow: NoteShadow, content: string, stamp: Stamp): NoteShadow {
  return { ...shadow, baselineStamp: stamp, baselineContent: content, content, dirty: false }
}

// Record a successful write of `savedContent` to `path`. If the user kept
// typing while the save was in flight, the newer text stays dirty.
export function markSaved(
  shadow: NoteShadow,
  path: string,
  stamp: Stamp,
  savedContent: string
): NoteShadow {
  return {
    ...shadow,
    originalPath: path,
    baselineStamp: stamp,
    baselineContent: savedContent,
    dirty: shadow.content !== savedContent
  }
}

// What is remembered about a note's file so a note restored from a crash-recovery
// snapshot can still tell whether the file changed on disk in the meantime.
export interface NoteBaseline {
  originalPath: string | null
  stamp: Stamp
  baselineContent: string
}

export interface RecoverySnapshot {
  diagram: DiagramFile
  detailsDrafts: Record<string, string>
  // Absent in snapshots written by older builds.
  noteBaselines?: Record<string, NoteBaseline>
}

export function dirtyBaselines(shadows: Record<string, NoteShadow>): Record<string, NoteBaseline> {
  const out: Record<string, NoteBaseline> = {}
  for (const id in shadows) {
    const s = shadows[id]
    if (s.dirty) {
      out[id] = {
        originalPath: s.originalPath,
        stamp: s.baselineStamp,
        baselineContent: s.baselineContent
      }
    }
  }
  return out
}

// A note restored from a snapshot WITH its baseline: unlike recoveredNoteShadow the
// disk check still works, so an outside edit made before the crash is still noticed.
export function restoredNoteShadow(
  nodeId: string,
  content: string,
  baseline: NoteBaseline
): NoteShadow {
  return {
    nodeId,
    originalPath: baseline.originalPath,
    baselineStamp: baseline.stamp,
    baselineContent: baseline.baselineContent,
    content,
    dirty: content !== baseline.baselineContent
  }
}

export function anyNoteDirty(shadows: Record<string, NoteShadow>): boolean {
  for (const id in shadows) if (shadows[id].dirty) return true
  return false
}

// Crash-recovery snapshots only need the notes with unsaved edits.
export function dirtyDrafts(shadows: Record<string, NoteShadow>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id in shadows) if (shadows[id].dirty) out[id] = shadows[id].content
  return out
}

// ---------------------------------------------------------------------------
// Planning

export interface PlanNoteInput {
  nodeId: string
  // Where the note belongs, derived from the label at save time (never stored).
  desiredPath: string
  // The diagram's current `data.details` for this node, or null.
  nodeDetailsPath: string | null
  shadow: NoteShadow | undefined
}

export interface PlanInput {
  // The hub has unsaved edits (or the caller forces a write: first save, link
  // creation, staged removals).
  hubDirty: boolean
  // Save As / first save: paths relative to the previous location mean nothing
  // there, so nothing is moved or conflict-checked — dirty notes are simply
  // written to the new location.
  newLocation: boolean
  notes: PlanNoteInput[]
}

export type NoteOp =
  // Write `content` to `to`. `from` is the file we read it from (conflict
  // check + removal of the old name if the label changed), or null.
  | {
      kind: 'write'
      nodeId: string
      from: string | null
      to: string
      content: string
      expectedStamp: Stamp
    }
  // An unedited note whose label changed: its on-disk content is moved, never
  // re-written from possibly-stale memory.
  | { kind: 'move'; nodeId: string; from: string; to: string }

export interface SavePlan {
  writeHub: boolean
  ops: NoteOp[]
  // nodeId -> the path the diagram's `data.details` should hold once saved.
  finalPaths: Record<string, string>
}

export function planSave(input: PlanInput): SavePlan {
  const ops: NoteOp[] = []
  const finalPaths: Record<string, string> = {}
  let referencesChanged = false

  for (const note of input.notes) {
    const { shadow, desiredPath, nodeDetailsPath } = note
    const current = input.newLocation ? null : (shadow?.originalPath ?? nodeDetailsPath)
    let finalPath = nodeDetailsPath

    if (shadow?.dirty) {
      ops.push({
        kind: 'write',
        nodeId: note.nodeId,
        from: current,
        to: desiredPath,
        content: shadow.content,
        expectedStamp: input.newLocation ? null : shadow.baselineStamp
      })
      finalPath = desiredPath
    } else if (current !== null && current !== desiredPath) {
      ops.push({ kind: 'move', nodeId: note.nodeId, from: current, to: desiredPath })
      finalPath = desiredPath
    }

    if (finalPath !== null) finalPaths[note.nodeId] = finalPath
    if (finalPath !== nodeDetailsPath) referencesChanged = true
  }

  return { writeHub: input.hubDirty || referencesChanged, ops, finalPaths }
}

// ---------------------------------------------------------------------------
// The wire format between the renderer (which plans) and main (which executes)

export interface Conflict {
  kind: 'hub' | 'note'
  // Absolute path for the hub, folder-relative for a note.
  path: string
  nodeId?: string
}

export type SavedNote = { path: string; stamp: Stamp }

export type SaveOutcome =
  // Everything that could be saved was. `conflicts` lists what was held back
  // (changed on disk AND edited here); `remaining` is what a second request with
  // overwrite must still do to finish the job.
  | {
      status: 'saved'
      hubWritten: boolean
      hubStamp: Stamp
      notes: Record<string, SavedNote>
      skippedMoves: string[]
      warnings: string[]
      conflicts: Conflict[]
      remaining: { hub: boolean; nodeIds: string[] }
    }
  | {
      status: 'failed'
      error: string
      // What was completed before the failure.
      hubWritten: boolean
      hubStamp: Stamp
      notes: Record<string, SavedNote>
    }

export interface SaveDocumentRequest {
  diagramPath: string
  // The window's pre-save recovery identity (ADR 0040).
  sessionId: string
  diagram: DiagramFile
  writeHub: boolean
  expectedHubStamp: Stamp
  ops: NoteOp[]
  // nodeId -> the path `data.details` keeps (null = none) if that node's note
  // did not reach its new path: a move with no source file, or an op held back
  // by a conflict.
  fallbackPaths: Record<string, string | null>
  overwrite: boolean
}

// ---------------------------------------------------------------------------
// Resolving conflicts, per file (ADR 0092 item 4)

// The key the diagram file itself uses in a decision map (notes use their nodeId).
export const HUB_KEY = 'hub'

// 'mine' = overwrite the disk version with what is in the editor;
// 'disk' = drop my edits to that file and take what is on disk.
export type Decision = 'mine' | 'disk'

// An op that changes which path the diagram must reference (a rename or a new
// note), as opposed to rewriting a note in place.
export function changesReference(op: NoteOp): boolean {
  return op.kind === 'move' || op.from !== op.to
}

export interface Resolution {
  // What to send as the finishing (overwrite) request.
  runOps: NoteOp[]
  writeHub: boolean
  // Notes whose in-memory copy is replaced by the disk's version.
  adoptDiskNodeIds: string[]
  // The diagram is to be reloaded from disk — the save stops there.
  reloadHub: boolean
}

// Turns the user's per-file choices into the finishing request. `pendingOps` is what
// the first pass held back (the conflicting notes, plus any create/rename held only
// because the diagram itself was held); `decisions` has an entry per *conflicting*
// file (HUB_KEY for the diagram, else nodeId).
export function resolveConflicts(
  pendingOps: NoteOp[],
  decisions: Record<string, Decision>
): Resolution {
  const hub = decisions[HUB_KEY]
  const reloadHub = hub === 'disk'
  const runOps: NoteOp[] = []
  const adoptDiskNodeIds: string[] = []

  for (const op of pendingOps) {
    const decision = decisions[op.nodeId]
    if (decision === 'disk') {
      adoptDiskNodeIds.push(op.nodeId)
      // A pending rename still happens — moving whatever is on disk now.
      if (!reloadHub && op.from !== null && op.from !== op.to) {
        runOps.push({ kind: 'move', nodeId: op.nodeId, from: op.from, to: op.to })
      }
      continue
    }
    if (reloadHub) {
      // The diagram is about to be replaced by the disk's version, so a create or a
      // rename planned against the old one is off — only in-place writes stay safe.
      // Whatever is dropped stays dirty / is re-planned on the next Save.
      if (decision === 'mine' && op.kind === 'write' && op.from === op.to) runOps.push(op)
      continue
    }
    runOps.push(op)
  }

  return {
    runOps,
    adoptDiskNodeIds,
    writeHub: !reloadHub && (hub === 'mine' || runOps.some(changesReference)),
    reloadHub
  }
}
