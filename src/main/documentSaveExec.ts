import { copyFile, mkdir, unlink, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { Conflict, NoteOp, SavedNote, SaveOutcome, Stamp } from '../shared/documentSave'

// Executes a save plan (see src/shared/documentSave.ts and ADR 0092): checks
// every file it is about to overwrite against the disk, saves everything that
// does NOT conflict, and reports what was held back so the caller can ask about
// it at the end. Writes happen in the crash-safe order — new/changed files,
// then the diagram, then old paths removed — so that at every instant the
// on-disk diagram points only at files that exist. No rollback: on a failure
// part-way, what was completed is reported so the caller updates exactly those
// baselines.
//
// Free of Electron and of any project imports (dependencies are injected) so
// it can be tested against a real temp directory with plain node:test.

export interface SaveRequest {
  // Absolute path of the diagram file; note paths are relative to its folder.
  diagramPath: string
  writeHub: boolean
  expectedHubStamp: Stamp
  ops: NoteOp[]
  // The user already chose "overwrite" after seeing the conflicts.
  overwrite: boolean
}

export interface ExecDeps {
  stamp: (absolutePath: string) => Promise<Stamp>
  // Called after the note files are in place. `revertNodeIds` are nodes whose
  // note is NOT at its new path (a move with no source file, or an op held
  // back by a conflict) — the diagram must keep pointing at the old path (or at
  // nothing, for a brand-new note) instead of at a file that doesn't exist.
  serializeHub: (revertNodeIds: string[]) => string
}

// Both sides known and different. Unknown baseline (null) or a vanished file is
// never a conflict: there is nothing of the outside world's to lose.
function changedOnDisk(expected: Stamp, current: Stamp): boolean {
  return expected !== null && current !== null && expected !== current
}

// An op that changes which path the diagram must reference (a rename or a new
// note), as opposed to rewriting a note in place.
function changesReference(op: NoteOp): boolean {
  return op.kind === 'move' || op.from !== op.to
}

export async function executeSave(req: SaveRequest, deps: ExecDeps): Promise<SaveOutcome> {
  const baseDir = dirname(req.diagramPath)
  const abs = (rel: string): string => join(baseDir, rel)

  // 1. Find what conflicts — but don't stop: everything else still saves.
  const conflicts: Conflict[] = []
  const conflictedNodes = new Set<string>()
  let hubHeld = false
  if (!req.overwrite) {
    if (req.writeHub && changedOnDisk(req.expectedHubStamp, await deps.stamp(req.diagramPath))) {
      hubHeld = true
      conflicts.push({ kind: 'hub', path: req.diagramPath })
    }
    for (const op of req.ops) {
      if (op.kind !== 'write' || op.from === null) continue
      if (changedOnDisk(op.expectedStamp, await deps.stamp(abs(op.from)))) {
        conflicts.push({ kind: 'note', path: op.from, nodeId: op.nodeId })
        conflictedNodes.add(op.nodeId)
      }
    }
  }
  // A conflicting note is held back. So is any create/rename while the diagram
  // itself is held back: the diagram can't be updated to point at it, and a
  // rename would delete the name the (unchanged) diagram still uses.
  const runNow = req.ops.filter(
    (op) => !conflictedNodes.has(op.nodeId) && !(hubHeld && changesReference(op))
  )
  const heldNodeIds = req.ops.filter((op) => !runNow.includes(op)).map((op) => op.nodeId)

  const notes: Record<string, SavedNote> = {}
  const skippedMoves: string[] = []
  const warnings: string[] = []
  let hubWritten = false
  let hubStamp: Stamp = null

  try {
    // 2. New and changed note files (a move copies, so the old name is still
    //    valid until the diagram points elsewhere).
    for (const op of runNow) {
      await mkdir(dirname(abs(op.to)), { recursive: true })
      if (op.kind === 'write') {
        await writeFile(abs(op.to), op.content, 'utf-8')
      } else {
        const exists = (await deps.stamp(abs(op.from))) !== null
        if (!exists) {
          skippedMoves.push(op.nodeId)
          continue
        }
        await copyFile(abs(op.from), abs(op.to))
      }
      notes[op.nodeId] = { path: op.to, stamp: await deps.stamp(abs(op.to)) }
    }

    // 3. The diagram, now that every path it mentions exists.
    if (req.writeHub && !hubHeld) {
      await writeFile(req.diagramPath, deps.serializeHub([...skippedMoves, ...heldNodeIds]), 'utf-8')
      hubWritten = true
      hubStamp = await deps.stamp(req.diagramPath)
    }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      hubWritten,
      hubStamp,
      notes
    }
  }

  // 4. Old names last. Best effort: a leftover file is a warning, not a
  //    failed save — the new state is already fully in place.
  for (const op of runNow) {
    if (op.from === null || op.from === op.to || !(op.nodeId in notes)) continue
    try {
      await unlink(abs(op.from))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        warnings.push(`Couldn't remove the old file ${op.from}`)
      }
    }
  }

  // What is still to do if the caller resolves the conflicts (a second request
  // with overwrite). The diagram must be rewritten if it was held, or if any
  // remaining op changes a path it references.
  const pending = req.ops.filter((op) => !(op.nodeId in notes) && !skippedMoves.includes(op.nodeId))
  return {
    status: 'saved',
    hubWritten,
    hubStamp,
    notes,
    skippedMoves,
    warnings,
    conflicts,
    remaining: {
      hub: (req.writeHub && !hubWritten) || pending.some(changesReference),
      nodeIds: pending.map((op) => op.nodeId)
    }
  }
}
