import { copyFile, mkdir, readFile, rmdir, stat, unlink, writeFile } from 'fs/promises'
import { dirname } from 'path'
import type { AssetOp } from '../../shared/document/saveAsCopy'
import type {
  Conflict,
  NoteOp,
  SavedNote,
  SaveOutcome,
  Stamp
} from '../../shared/document/documentSave'

// Executes a save plan (see src/shared/document/documentSave.ts and ADR 0092): checks
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
  // Save As: the folder of the diagram's previous file, which `copy` ops read from.
  copyFromDir?: string
  // Save As: files copied or written before the diagram, each to a place that is free.
  assets?: AssetOp[]
}

export interface ExecDeps {
  // Resolves a stored note path against the diagram's folder, or null if it
  // would reach outside it (containedPath.ts, ADR 0115).
  contain: (baseDir: string, relativePath: string) => string | null
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
  return op.kind !== 'write' || op.from !== op.to
}

// The same file under two names (Save As in the same folder keeps the notes where they are).
async function sameFile(a: string, b: string): Promise<boolean> {
  try {
    const [x, y] = await Promise.all([stat(a, { bigint: true }), stat(b, { bigint: true })])
    return x.ino !== 0n && x.ino === y.ino && x.dev === y.dev
  } catch {
    return false
  }
}

export async function executeSave(req: SaveRequest, deps: ExecDeps): Promise<SaveOutcome> {
  const baseDir = dirname(req.diagramPath)
  // Note paths come from the diagram file, which is untrusted once diagrams are
  // shared (ADR 0115): a path outside the diagram's folder is never copied from,
  // written to or deleted. `inside` returns null for one; `mustBeInside` fails.
  const inside = (rel: string): string | null => deps.contain(baseDir, rel)
  const mustBeInside = (rel: string): string => {
    const path = inside(rel)
    if (path === null)
      throw new Error(`"${rel}" is outside the diagram's folder, so it was not touched`)
    return path
  }

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
      // An outside "old" path is never read or removed, so it cannot conflict.
      const from = inside(op.from)
      if (from !== null && changedOnDisk(op.expectedStamp, await deps.stamp(from))) {
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
    // 1b. Save As: the images and linked diagrams. Nothing is ever replaced, so every place is
    //     checked before the first file is written.
    const assets = req.assets ?? []
    const assetPaths = assets.map((asset) => mustBeInside(asset.to))
    for (const [i, to] of assetPaths.entries()) {
      if ((await deps.stamp(to)) !== null) {
        throw new Error(`"${assets[i].to}" already exists, so nothing was copied`)
      }
    }
    for (const [i, asset] of assets.entries()) {
      const to = assetPaths[i]
      await mkdir(dirname(to), { recursive: true })
      if (asset.kind === 'write') {
        await writeFile(to, asset.content, 'utf-8')
        continue
      }
      const from = req.copyFromDir === undefined ? null : deps.contain(req.copyFromDir, asset.from)
      if (from === null || (await deps.stamp(from)) === null) {
        warnings.push(`${asset.from} was not found, so it was not copied.`)
        continue
      }
      await copyFile(from, to)
    }

    // 2. New and changed note files (a move copies, so the old name is still
    //    valid until the diagram points elsewhere).
    for (const op of runNow) {
      const to = mustBeInside(op.to)
      await mkdir(dirname(to), { recursive: true })
      if (op.kind === 'write') {
        await writeFile(to, op.content, 'utf-8')
      } else if (op.kind === 'copy') {
        // Read from the previous folder; a source that is missing, or outside it, copies
        // nothing and the node keeps its old path.
        const from = req.copyFromDir === undefined ? null : deps.contain(req.copyFromDir, op.from)
        if (from === null || (await deps.stamp(from)) === null) {
          skippedMoves.push(op.nodeId)
          continue
        }
        if (!(await sameFile(from, to))) {
          if ((await deps.stamp(to)) === null) {
            await copyFile(from, to)
          } else if (!(await readFile(from)).equals(await readFile(to))) {
            // Never replace a file that is already there: it may be another diagram's note.
            warnings.push(
              `${op.to} already exists with other text, so it was kept and the saved diagram uses it.`
            )
          }
        }
      } else {
        // A move whose source is outside the folder is treated as having no
        // source: nothing is copied, and the node keeps its old path.
        const from = inside(op.from)
        const exists = from !== null && (await deps.stamp(from)) !== null
        if (!exists) {
          skippedMoves.push(op.nodeId)
          continue
        }
        await copyFile(from, to)
      }
      notes[op.nodeId] = { path: op.to, stamp: await deps.stamp(to) }
    }

    // 3. The diagram, now that every path it mentions exists.
    if (req.writeHub && !hubHeld) {
      await writeFile(
        req.diagramPath,
        deps.serializeHub([...skippedMoves, ...heldNodeIds]),
        'utf-8'
      )
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
  const emptied = new Set<string>()
  for (const op of runNow) {
    if (op.kind === 'copy' || op.from === null || op.from === op.to || !(op.nodeId in notes))
      continue
    const from = inside(op.from)
    if (from === null) continue
    try {
      await unlink(from)
      emptied.add(dirname(from))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        warnings.push(`Couldn't remove the old file ${op.from}`)
      }
    }
  }

  // 5. A folder the moves left empty goes too (notes moving from details/ to notes/ would
  //    otherwise leave the old folder behind). rmdir refuses a folder that still has anything
  //    in it, so this never removes content; the diagram's own folder is never a candidate.
  for (const folder of emptied) {
    if (folder === baseDir) continue
    await rmdir(folder).catch(() => undefined)
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
