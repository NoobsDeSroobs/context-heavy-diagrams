import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { resetElement, type Graph } from './resetElement'

const node = (id: string, label = id, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: { label },
  ...extra
})
const edge = (id: string, source: string, target: string, extra: Partial<Edge> = {}): Edge => ({
  id,
  source,
  target,
  ...extra
})
const graph = (nodes: Node[], edges: Edge[] = []): Graph => ({ nodes, edges })

function ok(result: ReturnType<typeof resetElement>): Graph {
  if (!result.ok) throw new Error(result.message)
  return result
}

describe('resetElement: a modified node', () => {
  it('takes the saved version of that node and leaves the rest alone', () => {
    const saved = graph([node('a', 'Old name'), node('b', 'B')])
    const live = graph([node('a', 'New name', { selected: true }), node('b', 'B changed')])
    const out = ok(resetElement(live, saved, 'node', 'a', 'modified'))
    expect(out.nodes.find((n) => n.id === 'a')?.data.label).toBe('Old name')
    expect(out.nodes.find((n) => n.id === 'a')?.selected).toBe(true)
    expect(out.nodes.find((n) => n.id === 'b')?.data.label).toBe('B changed')
  })

  it('keeps the saved container when it is still there', () => {
    const saved = graph([node('p'), node('c', 'C', { parentId: 'p', position: { x: 5, y: 6 } })])
    const live = graph([node('p'), node('c', 'C', { position: { x: 100, y: 100 } })])
    const out = ok(resetElement(live, saved, 'node', 'c', 'modified'))
    const c = out.nodes.find((n) => n.id === 'c')
    expect(c?.parentId).toBe('p')
    expect(c?.position).toEqual({ x: 5, y: 6 })
    expect(out.nodes.map((n) => n.id)).toEqual(['p', 'c'])
  })

  it('goes top level, where it was drawn, when its saved container is gone', () => {
    const saved = graph([
      node('p', 'P', { position: { x: 100, y: 50 } }),
      node('c', 'C', { parentId: 'p', position: { x: 5, y: 6 } })
    ])
    const live = graph([node('c', 'C')])
    const out = ok(resetElement(live, saved, 'node', 'c', 'modified'))
    const c = out.nodes.find((n) => n.id === 'c')
    expect(c?.parentId).toBeUndefined()
    expect(c?.position).toEqual({ x: 105, y: 56 })
  })

  it('does not make a container its own descendant', () => {
    // Saved: b inside a. Live since: a was put inside b.
    const saved = graph([node('a'), node('b', 'B', { parentId: 'a', position: { x: 1, y: 1 } })])
    const live = graph([node('b'), node('a', 'A', { parentId: 'b', position: { x: 3, y: 3 } })])
    const out = ok(resetElement(live, saved, 'node', 'b', 'modified'))
    expect(out.nodes.find((n) => n.id === 'b')?.parentId).toBeUndefined()
  })
})

describe('resetElement: an added node', () => {
  it('removes it and its connections', () => {
    const saved = graph([node('a')])
    const live = graph([node('a'), node('n')], [edge('e', 'a', 'n')])
    const out = ok(resetElement(live, saved, 'node', 'n', 'added'))
    expect(out.nodes.map((n) => n.id)).toEqual(['a'])
    expect(out.edges).toEqual([])
  })

  it('keeps what a removed container held', () => {
    const saved = graph([])
    const live = graph([
      node('box', 'Box', { position: { x: 10, y: 10 } }),
      node('in', 'In', { parentId: 'box', position: { x: 2, y: 3 } })
    ])
    const out = ok(resetElement(live, saved, 'node', 'box', 'added'))
    expect(out.nodes.map((n) => n.id)).toEqual(['in'])
    expect(out.nodes[0].parentId).toBeUndefined()
    expect(out.nodes[0].position).toEqual({ x: 12, y: 13 })
  })
})

describe('resetElement: a removed node', () => {
  it('brings it back with the connections that can be drawn again', () => {
    const saved = graph(
      [node('a'), node('gone'), node('c')],
      [edge('e1', 'a', 'gone'), edge('e2', 'gone', 'c'), edge('e3', 'a', 'c')]
    )
    // Live: gone and its two connections were deleted; c was deleted too.
    const live = graph([node('a')], [])
    const out = ok(resetElement(live, saved, 'node', 'gone', 'removed'))
    expect(out.nodes.map((n) => n.id).sort()).toEqual(['a', 'gone'])
    // e1 returns (a is there); e2 cannot (c is not); e3 never touched gone.
    expect(out.edges.map((e) => e.id)).toEqual(['e1'])
  })

  it('refuses when it is already there', () => {
    const saved = graph([node('a')])
    const result = resetElement(graph([node('a')]), saved, 'node', 'a', 'removed')
    expect(result.ok).toBe(false)
  })
})

describe('resetElement: edges', () => {
  it('puts a modified edge back', () => {
    const saved = graph([node('a'), node('b'), node('c')], [edge('e', 'a', 'b')])
    const live = graph([node('a'), node('b'), node('c')], [edge('e', 'a', 'c', { selected: true })])
    const out = ok(resetElement(live, saved, 'edge', 'e', 'modified'))
    expect(out.edges).toEqual([{ ...edge('e', 'a', 'b'), selected: true }])
  })

  it('removes an added edge and restores a removed one', () => {
    const saved = graph([node('a'), node('b')], [edge('old', 'a', 'b')])
    const live = graph([node('a'), node('b')], [edge('new', 'a', 'b')])
    expect(ok(resetElement(live, saved, 'edge', 'new', 'added')).edges).toEqual([])
    expect(ok(resetElement(live, saved, 'edge', 'old', 'removed')).edges.map((e) => e.id)).toEqual([
      'new',
      'old'
    ])
  })

  it('says which node to restore first when a connection leads to a deleted one', () => {
    const saved = graph([node('a'), node('b', 'Beta')], [edge('e', 'a', 'b')])
    const live = graph([node('a')], [])
    const result = resetElement(live, saved, 'edge', 'e', 'removed')
    expect(result).toEqual({
      ok: false,
      message: 'Restore "Beta" first: this connection leads to it.'
    })
  })
})
