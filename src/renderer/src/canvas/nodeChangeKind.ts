import type { NodeChange } from '@xyflow/react'

export interface NodeChangeKind {
  // A continuous gesture (drag, resize) begins: one snapshot for the whole gesture.
  starting: boolean
  ending: boolean
  // A one-off edit that gets its own undo snapshot.
  discrete: boolean
}

// How a batch of React Flow node changes maps onto undo history.
//
// A `dimensions` change that carries no `resizing` flag is React Flow measuring a node by itself
// (a node it has just mounted, or one whose content changed size). It is never an edit, so it
// must not take a snapshot: a snapshot clears Redo, and the unmeasured nodes it holds make the
// next Undo trigger another measurement and another snapshot, so Undo never gets past the node
// that was just added. Only a resize the person drags carries `resizing`.
export function classifyNodeChanges(changes: readonly NodeChange[]): NodeChangeKind {
  const meaningful = changes.filter((change) => change.type !== 'select')
  return {
    starting: meaningful.some(
      (change) =>
        (change.type === 'position' && change.dragging === true) ||
        (change.type === 'dimensions' && change.resizing === true)
    ),
    ending: meaningful.some(
      (change) =>
        (change.type === 'position' && change.dragging === false) ||
        (change.type === 'dimensions' && change.resizing === false)
    ),
    discrete: meaningful.some(
      (change) =>
        change.type === 'remove' ||
        change.type === 'add' ||
        change.type === 'replace' ||
        (change.type === 'position' && change.dragging === undefined)
    )
  }
}
