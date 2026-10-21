import type { Node } from '@xyflow/react'

// DetailsPanel's own header — the element's current label (first line only,
// same convention as the on-disk detail filename), falling back to that
// file's own name for a blank-labeled element. Lets the user tell which
// element's details they're looking at without having to check the canvas
// selection, especially when navigating between several in a row.
export function detailsPanelTitle(node: Node | undefined): string {
  const label = typeof node?.data?.label === 'string' ? node.data.label.split('\n')[0].trim() : ''
  if (label) return label
  const path = typeof node?.data?.details === 'string' ? node.data.details : undefined
  return path ? (path.split(/[/\\]/).pop() ?? path) : 'Untitled'
}

// Names the note in the toolbar's "changed outside the app" notice: the
// element's label (first line), else "This note".
export function detailsNoteName(node: Node | undefined): string {
  const label = typeof node?.data?.label === 'string' ? node.data.label.split('\n')[0].trim() : ''
  return label ? `Note "${label}"` : 'This note'
}
