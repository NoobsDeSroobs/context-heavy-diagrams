// Putting one element back as the earlier version has it, asked for in the compare window and done
// in the editor window of the same diagram. The compare window never changes a diagram itself.

import type { DiagramFile } from '../diagram'

export type RevertKind = 'node' | 'edge'

// What happened to the element between the two versions.
export type RevertChange = 'added' | 'removed' | 'modified'

export const REVERT_KINDS: readonly string[] = ['node', 'edge']
export const REVERT_CHANGES: readonly string[] = ['added', 'removed', 'modified']

// Pairs of earlier id -> later id the reviewer asked the comparison to treat as the same element
// (the ids of an assistant's rewrite). A revert has to see the earlier version the same way.
export interface RevertIdMatches {
  nodes: Record<string, string>
  edges: Record<string, string>
}

// What main sends to the editor window.
export interface RevertRequest {
  requestId: string
  // The earlier version, whole: the element is put back as it is in this.
  base: DiagramFile
  kind: RevertKind
  id: string
  change: RevertChange
}

export interface RevertResult {
  ok: boolean
  // Why it could not be done, in words for the reviewer.
  message?: string
}
