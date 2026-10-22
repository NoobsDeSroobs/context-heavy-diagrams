import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import {
  applyZIndexBackfill,
  deriveEdgeFields,
  deriveNodeFields,
  isConnectableNodeType,
  newNodeId,
  nextZIndex,
  nodeMetadataEligible
} from './nodeFields'

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data
})

describe('deriveNodeFields', () => {
  it('returns the node itself when nothing needs deriving', () => {
    const n: Node = {
      ...node('a', 'entity', { zIndex: 4 }),
      zIndex: 4,
      draggable: true,
      deletable: true
    }
    expect(deriveNodeFields(n)).toBe(n)
  })

  it('maps locked onto draggable / deletable and data.zIndex onto zIndex', () => {
    const out = deriveNodeFields(node('a', 'entity', { locked: true, zIndex: 7 }))
    expect(out).toMatchObject({ zIndex: 7, draggable: false, deletable: false })
  })

  it('makes a line node’s bounding box click-through, once', () => {
    const line = deriveNodeFields(node('l', 'line'))
    expect(line.style).toMatchObject({ pointerEvents: 'none' })
    expect(deriveNodeFields(line)).toBe(line)
  })
})

describe('deriveEdgeFields', () => {
  it('only creates a new edge when the zIndex changes', () => {
    const e: Edge = { id: 'e', source: 'a', target: 'b', zIndex: 3 }
    expect(deriveEdgeFields(e, 3)).toBe(e)
    expect(deriveEdgeFields(e, 9)).toEqual({ ...e, zIndex: 9 })
  })
})

describe('newNodeId', () => {
  it('is the prefix plus a unique suffix', () => {
    const a = newNodeId('entity')
    expect(a).toMatch(/^entity-[0-9a-f-]{36}$/)
    expect(newNodeId('entity')).not.toBe(a)
  })
})

describe('z-index helpers', () => {
  it('backfills only nodes without a zIndex and keeps the others', () => {
    const nodes = [node('a', 'entity', { zIndex: 50 }), node('b', 'entity'), node('c', 'container')]
    const out = applyZIndexBackfill(nodes)
    expect(out[0]).toBe(nodes[0])
    expect(typeof out[1].data.zIndex).toBe('number')
    expect(typeof out[2].data.zIndex).toBe('number')
  })

  it('returns the same array when every node already has one', () => {
    const nodes = [node('a', 'entity', { zIndex: 1 }), node('b', 'text', { zIndex: 2 })]
    expect(applyZIndexBackfill(nodes)).toBe(nodes)
  })

  it('puts a new node above the existing nodes of its own type', () => {
    const nodes = [node('a', 'entity', { zIndex: 40 }), node('b', 'entity', { zIndex: 45 })]
    expect(nextZIndex(nodes, 'entity')).toBeGreaterThan(45)
  })

  it('keeps each type inside its own tier: a container starts below an entity', () => {
    expect(nextZIndex([], 'container')).toBeLessThan(nextZIndex([], 'entity'))
    expect(nextZIndex([], 'entity')).toBeLessThan(nextZIndex([], 'text'))
  })
})

describe('node type predicates', () => {
  it('only entities and containers carry metadata and connection handles', () => {
    for (const t of ['entity', 'container']) {
      expect(nodeMetadataEligible(t)).toBe(true)
      expect(isConnectableNodeType(t)).toBe(true)
    }
    for (const t of ['text', 'line', undefined]) {
      expect(nodeMetadataEligible(t)).toBe(false)
      expect(isConnectableNodeType(t)).toBe(false)
    }
  })
})
