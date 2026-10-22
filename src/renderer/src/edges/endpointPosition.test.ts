import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { resolveEndpointPosition } from './endpointPosition'

const box = (extra: Partial<Node> = {}): Node => ({
  id: 'n',
  position: { x: 100, y: 200 },
  width: 80,
  height: 40,
  data: { connectionPoints: [{ id: 'right-q', side: 'right', offset: 0.25 }] },
  ...extra
})
const byId = (...nodes: Node[]): Map<string, Node> => new Map(nodes.map((n) => [n.id, n]))

describe('resolveEndpointPosition', () => {
  it('is the origin for an unknown node', () => {
    expect(resolveEndpointPosition('nope', null, byId())).toEqual({ x: 0, y: 0 })
  })

  it('falls back to the middle of the left side with no handle', () => {
    expect(resolveEndpointPosition('n', null, byId(box()))).toEqual({
      x: 100,
      y: 220,
      direction: { x: -1, y: 0 }
    })
  })

  it('places a custom point by side and offset, with its outward direction', () => {
    expect(resolveEndpointPosition('n', 'right-q', byId(box()))).toEqual({
      x: 180,
      y: 210,
      direction: { x: 1, y: 0 }
    })
  })

  it('adds the parents’ positions for a nested node', () => {
    const parent: Node = { id: 'p', position: { x: 10, y: 10 }, data: {} }
    const child = box({ parentId: 'p' })
    expect(resolveEndpointPosition('n', 'right-q', byId(parent, child))).toMatchObject({
      x: 190,
      y: 220
    })
  })
})
