// Noticing that files changed outside the app (ADR 0092): one detector over the diagram and every
// note that is open or has unsaved edits, so the same rule applies to each and one notice lists
// them. Pure; the check itself (a stat per file) is `files:check` in the main process.

import type { Stamp } from './documentSave'

// The key of the diagram file among the tracked files; a note's key is its nodeId.
export const HUB_FILE_KEY = 'hub'

// A file the window holds a copy of, with what it last saw of it.
export interface TrackedFile {
  key: string
  // Folder-relative path of a note; null for the diagram file itself.
  relPath: string | null
  baselineStamp: Stamp
  // The name shown in the notice.
  label: string
  // This window has unsaved edits to it.
  dirty: boolean
}

// What `files:check` says of one file: whether it changed, and its stamp now.
export interface FileCheck {
  changed: boolean
  stamp: Stamp
}

// A tracked file that changed on disk, and was not already ignored at this very change.
export interface ChangedFile {
  key: string
  label: string
  stamp: Stamp
  dirty: boolean
}

// `dismissed` is the stamp the person chose to ignore, per key: the same change is not announced
// again, a later one is. The save-time check never looks at it.
export function changedFiles(
  tracked: TrackedFile[],
  checks: FileCheck[],
  dismissed: Record<string, string>
): ChangedFile[] {
  const out: ChangedFile[] = []
  tracked.forEach((file, index) => {
    const check = checks[index]
    if (!check?.changed) return
    if (check.stamp !== null && dismissed[file.key] === check.stamp) return
    out.push({ key: file.key, label: file.label, stamp: check.stamp, dirty: file.dirty })
  })
  return out
}

// The notice's sentence: what changed, and which of it has unsaved edits here.
export function changedFilesMessage(files: ChangedFile[]): string {
  const names = files.map((f) => f.label).join(', ')
  const dirty = files.filter((f) => f.dirty).map((f) => f.label)
  const head = `Changed outside the app: ${names}.`
  return dirty.length === 0 ? head : `${head} You have unsaved edits to ${dirty.join(', ')}.`
}

// What Reload asks before it discards: null when nothing has unsaved edits.
export function reloadWarning(files: ChangedFile[]): string | null {
  const dirty = files.filter((f) => f.dirty).map((f) => f.label)
  if (dirty.length === 0) return null
  return `Reload from disk? Your unsaved edits to ${dirty.join(', ')} will be lost.`
}
