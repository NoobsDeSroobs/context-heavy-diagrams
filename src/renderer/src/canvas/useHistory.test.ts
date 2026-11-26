import { act, renderHook } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it, vi } from 'vitest'
import { useHistory } from './useHistory'

function setup(): {
  graphRef: { current: { nodes: Node[]; edges: Edge[] } }
  hook: ReturnType<typeof renderHook<ReturnType<typeof useHistory>, unknown>>
} {
  const graphRef = { current: { nodes: [] as Node[], edges: [] as Edge[] } }
  const hook = renderHook(() =>
    useHistory({ graphRef, setNodes: vi.fn(), setEdges: vi.fn(), markDirty: vi.fn() })
  )
  return { graphRef, hook }
}

describe('useHistory.pushSnapshot', () => {
  it('takes one step for an edit that is snapshotted twice before the graph changes', () => {
    const { hook } = setup()
    act(() => {
      hook.result.current.pushSnapshot()
      hook.result.current.pushSnapshot()
    })
    expect(hook.result.current.past).toHaveLength(1)
  })

  it('takes a step per edit once the graph has changed in between', () => {
    const { graphRef, hook } = setup()
    act(() => hook.result.current.pushSnapshot())
    graphRef.current = { nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: {} }], edges: [] }
    act(() => hook.result.current.pushSnapshot())
    expect(hook.result.current.past).toHaveLength(2)
  })
})
