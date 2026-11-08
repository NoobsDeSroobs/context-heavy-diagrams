import type { Node } from '@xyflow/react'
import type { NoteShadow } from '@shared/document/documentSave'

// NotesPanel's own header — the element's current label (first line only,
// same convention as the on-disk note filename), falling back to that
// file's own name for a blank-labeled element. Lets the user tell which
// element's note they're looking at without having to check the canvas
// selection, especially when navigating between several in a row.
export function notesPanelTitle(node: Node | undefined): string {
  const label = typeof node?.data?.label === 'string' ? node.data.label.split('\n')[0].trim() : ''
  if (label) return label
  const path = typeof node?.data?.notes === 'string' ? node.data.notes : undefined
  return path ? (path.split(/[/\\]/).pop() ?? path) : 'Untitled'
}

// Names the note in the toolbar's "changed outside the app" notice: the
// element's label (first line), else "This note".
export function noteName(node: Node | undefined): string {
  const label = typeof node?.data?.label === 'string' ? node.data.label.split('\n')[0].trim() : ''
  return label ? `Note "${label}"` : 'This note'
}

// What the Notes panel says about the open note (ADR 0154): 'unsaved' while it has edits that are
// only in memory, 'saved' when the file on disk is what the panel shows, and nothing for a note
// that has no file and no edits yet (or is still being read).
export type NoteSaveState = 'unsaved' | 'saved' | null

export function noteSaveState(shadow: NoteShadow | undefined): NoteSaveState {
  if (!shadow) return null
  if (shadow.dirty) return 'unsaved'
  return shadow.originalPath !== null ? 'saved' : null
}
