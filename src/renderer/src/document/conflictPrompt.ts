import type { Decision } from '@shared/document/documentSave'

// Ask the user, per file, what to do about files that have unsaved edits here AND
// changed on disk (ADR 0092). Promise-based and callable from anywhere — the same
// idea as alerts.ts: a tiny pub/sub the ConflictDialog host subscribes to.
// Resolves with one decision per item, or null if the user cancelled.

export interface ConflictItem {
  // HUB_KEY for the diagram file, else the note's nodeId — the key the answer uses.
  key: string
  kind: 'hub' | 'note'
  label: string
}

export type ConflictDecisions = Record<string, Decision>

type Listener = (items: ConflictItem[], resolve: (d: ConflictDecisions | null) => void) => void

let listener: Listener | null = null

export function askConflictResolution(items: ConflictItem[]): Promise<ConflictDecisions | null> {
  return new Promise((resolve) => {
    // No host mounted (shouldn't happen once Canvas is up): treat as Cancel — the
    // safe answer, nothing gets overwritten.
    if (!listener) resolve(null)
    else listener(items, resolve)
  })
}

export function subscribeToConflictDialog(l: Listener): () => void {
  listener = l
  return () => {
    if (listener === l) listener = null
  }
}
