// Putting one element back as the earlier version has it, asked for in the compare window and done
// in the editor window of the same diagram. The compare window never changes a diagram itself.

import type { DiagramFile } from '../diagram'

export type RevertKind = 'node' | 'edge'

// What happened to the element between the two versions.
export type RevertChange = 'added' | 'removed' | 'modified'

export const REVERT_KINDS: readonly string[] = ['node', 'edge']
export const REVERT_CHANGES: readonly string[] = ['added', 'removed', 'modified']

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
