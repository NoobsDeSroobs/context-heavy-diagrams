import type { Connection, Edge, HandleType } from '@xyflow/react'

// An edge dropped on empty canvas makes an entity for its loose end. That end names no connection
// point, so it attaches to the side that faces the other element and follows it as it moves
// (ADR 0200). The end that was already placed keeps its point.

// A new edge dragged from `origin` to a new entity. `null` is how an automatic end is held.
export function connectionToNewEntity(
  origin: { nodeId: string; handleId: string | null },
  entityId: string
): Connection {
  return {
    source: origin.nodeId,
    sourceHandle: origin.handleId,
    target: entityId,
    targetHandle: null
  }
}

// An existing edge whose loose end was dropped on empty canvas. `fixedEnd` is React Flow's
// `handleType` for a reconnect: the end that stays put, not the one that was dragged. The dragged
// end moves to the new entity with no connection point.
export function reconnectToNewEntity(edge: Edge, fixedEnd: HandleType, entityId: string): Edge {
  return fixedEnd === 'target'
    ? { ...edge, source: entityId, sourceHandle: null }
    : { ...edge, target: entityId, targetHandle: null }
}
