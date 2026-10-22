import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import type { RequiredTagDefinition } from '@shared/diagram'
import { syncEdgeMetadata, syncNodeMetadata } from './syncElements'

const tags: RequiredTagDefinition[] = [{ key: 'env', lock: 'lockedEditable', defaultValue: 'dev' }]

describe('syncNodeMetadata', () => {
  it('gives entities and containers the required tags and leaves text and lines alone', () => {
    const nodes: Node[] = [
      { id: 'e', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'Box' } },
      { id: 'c', type: 'container', position: { x: 0, y: 0 }, data: { label: 'Zone' } },
      { id: 't', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Note' } }
    ]
    const out = syncNodeMetadata(nodes, tags, [])
    expect(out[0].data.metadata).toEqual({ env: { value: 'dev', lock: 'lockedEditable' } })
    expect(out[1].data.metadata).toEqual({ env: { value: 'dev', lock: 'lockedEditable' } })
    expect(out[2]).toBe(nodes[2])
  })

  it('names the element in each correction it reports', () => {
    const notices: string[] = []
    const bad: Node = {
      id: 'e',
      type: 'entity',
      position: { x: 0, y: 0 },
      data: { label: 'Box', metadata: { env: { value: 'qa', lock: 'lockedStatic' } } }
    }
    syncNodeMetadata([bad], [{ ...tags[0], lock: 'lockedStatic' }], notices)
    expect(notices).toEqual(['Invalid value in Entity "Box".env, reset to default value.'])
  })
})

describe('syncEdgeMetadata', () => {
  it('gives every edge the required tags', () => {
    const edges: Edge[] = [{ id: 'x', source: 'a', target: 'b', data: { label: 'calls' } }]
    expect(syncEdgeMetadata(edges, tags, [])[0].data?.metadata).toEqual({
      env: { value: 'dev', lock: 'lockedEditable' }
    })
  })
})
