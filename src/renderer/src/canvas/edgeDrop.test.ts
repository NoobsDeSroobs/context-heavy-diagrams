import type { Edge } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { connectionToNewEntity, reconnectToNewEntity } from './edgeDrop'

describe('connectionToNewEntity', () => {
  it('keeps the point the drag started from and leaves the new end automatic', () => {
    expect(connectionToNewEntity({ nodeId: 'a', handleId: 'right' }, 'new')).toEqual({
      source: 'a',
      sourceHandle: 'right',
      target: 'new',
      targetHandle: null
    })
  })

  it('keeps an automatic start automatic too', () => {
    const c = connectionToNewEntity({ nodeId: 'a', handleId: null }, 'new')
    expect(c.sourceHandle).toBeNull()
    expect(c.targetHandle).toBeNull()
  })
})

describe('reconnectToNewEntity', () => {
  const edge: Edge = {
    id: 'e',
    source: 'a',
    sourceHandle: 'right',
    target: 'b',
    targetHandle: 'left'
  }

  it('moves a dragged target to the new entity, automatic, and keeps the source end', () => {
    expect(reconnectToNewEntity(edge, 'source', 'new')).toEqual({
      ...edge,
      target: 'new',
      targetHandle: null
    })
  })

  it('moves a dragged source to the new entity, automatic, and keeps the target end', () => {
    expect(reconnectToNewEntity(edge, 'target', 'new')).toEqual({
      ...edge,
      source: 'new',
      sourceHandle: null
    })
  })
})
