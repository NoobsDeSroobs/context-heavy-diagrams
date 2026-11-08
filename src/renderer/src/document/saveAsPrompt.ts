import type { SaveAsOptions, SaveAsPlan } from '@shared/document/saveAsCopy'

// Ask what a Save As should copy (ADR 0160). Promise-based and callable from anywhere, like
// conflictPrompt.ts: a tiny pub/sub the SaveAsDialog host subscribes to.

export interface SaveAsRequest {
  currentPath: string
  // What copying to `newPath` with `options` would do (main reads the old folder).
  planFor: (newPath: string, options: SaveAsOptions) => Promise<SaveAsPlan>
}

export interface SaveAsChoice {
  path: string
  options: SaveAsOptions
  plan: SaveAsPlan
}

type Listener = (request: SaveAsRequest, resolve: (choice: SaveAsChoice | null) => void) => void

let listener: Listener | null = null

export function askSaveAs(request: SaveAsRequest): Promise<SaveAsChoice | null> {
  return new Promise((resolve) => {
    // No host mounted (cannot happen once Canvas is up): the same as Cancel.
    if (!listener) resolve(null)
    else listener(request, resolve)
  })
}

export function subscribeToSaveAsDialog(l: Listener): () => void {
  listener = l
  return () => {
    if (listener === l) listener = null
  }
}

// Where the picker starts: beside the current diagram, named "<name> copy.chd". The path is
// whatever the OS handed us, so either separator.
export function suggestedCopyPath(currentPath: string): string {
  const cut = Math.max(currentPath.lastIndexOf('/'), currentPath.lastIndexOf('\\'))
  const dir = currentPath.slice(0, cut + 1)
  const name = currentPath.slice(cut + 1)
  const dot = name.lastIndexOf('.')
  return `${dir}${dot > 0 ? name.slice(0, dot) : name} copy.chd`
}
