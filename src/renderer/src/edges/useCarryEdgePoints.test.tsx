import { act, renderHook } from '@testing-library/react'
import { useState, type Dispatch, type SetStateAction } from 'react'
import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { useCarryEdgePoints } from './useCarryEdgePoints'

const node = (id: string, x: number, y: number, parentId?: string): Node => ({
  id,
  position: { x, y },
  width: 100,
  height: 50,
  data: {},
  ...(parentId ? { parentId } : {})
})
const looped: Edge = {
  id: 'e',
  source: 'a',
  target: 'b',
  data: { points: [{ x: 50, y: 200 }] }
}

interface Harness {
  n: Node[]
  e: Edge[]
  setNodes: Dispatch<SetStateAction<Node[]>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
}

function setup(nodes: Node[], edges: Edge[]): ReturnType<typeof renderHook<Harness, unknown>> {
  return renderHook((): Harness => {
    const [n, setNodes] = useState(nodes)
    const [e, setEdges] = useState(edges)
    useCarryEdgePoints(n, e, setEdges)
    return { n, e, setNodes, setEdges }
  })
}
const pointsOf = (edges: Edge[]): unknown => edges[0].data?.points

describe('useCarryEdgePoints', () => {
  it('carries the points when both ends move by the same amount', () => {
    const { result } = setup([node('a', 0, 0), node('b', 300, 0)], [looped])
    act(() =>
      result.current.setNodes((ns) =>
        ns.map((n) => ({ ...n, position: { x: n.position.x + 40, y: n.position.y - 10 } }))
      )
    )
    expect(pointsOf(result.current.e)).toEqual([{ x: 90, y: 190 }])
  })

  it('carries them through a container that moves', () => {
    const { result } = setup(
      [node('box', 0, 0), node('a', 10, 10, 'box'), node('b', 200, 10, 'box')],
      [looped]
    )
    act(() =>
      result.current.setNodes((ns) =>
        ns.map((n) => (n.id === 'box' ? { ...n, position: { x: 25, y: 25 } } : n))
      )
    )
    expect(pointsOf(result.current.e)).toEqual([{ x: 75, y: 225 }])
  })

  it('leaves them when only one end moves', () => {
    const { result } = setup([node('a', 0, 0), node('b', 300, 0)], [looped])
    act(() =>
      result.current.setNodes((ns) =>
        ns.map((n) => (n.id === 'a' ? { ...n, position: { x: 40, y: 0 } } : n))
      )
    )
    expect(pointsOf(result.current.e)).toEqual([{ x: 50, y: 200 }])
  })

  it('leaves them when the edges are replaced in the same step, as undo does', () => {
    const { result } = setup([node('a', 0, 0), node('b', 300, 0)], [looped])
    act(() => {
      result.current.setNodes((ns) =>
        ns.map((n) => ({ ...n, position: { x: n.position.x + 40, y: n.position.y } }))
      )
      result.current.setEdges([{ ...looped }])
    })
    expect(pointsOf(result.current.e)).toEqual([{ x: 50, y: 200 }])
  })

  it('carries each move once, however many there are', () => {
    const { result } = setup([node('a', 0, 0), node('b', 300, 0)], [looped])
    for (let i = 0; i < 3; i += 1) {
      act(() =>
        result.current.setNodes((ns) =>
          ns.map((n) => ({ ...n, position: { x: n.position.x + 10, y: n.position.y } }))
        )
      )
    }
    expect(pointsOf(result.current.e)).toEqual([{ x: 80, y: 200 }])
  })
})
