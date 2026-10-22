import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { healHierarchy, removeContainerReparenting, sortNodesForHierarchy } from './hierarchy'

const node = (id: string, x: number, y: number, parentId?: string): Node => ({
  id,
  position: { x, y },
  data: {},
  ...(parentId ? { parentId } : {})
})

describe('sortNodesForHierarchy', () => {
  it('puts a parent before its children, however the input is ordered', () => {
    const out = sortNodesForHierarchy([node('c', 0, 0, 'b'), node('b', 0, 0, 'a'), node('a', 0, 0)])
    expect(out.map((n) => n.id)).toEqual(['a', 'b', 'c'])
  })

  it('terminates on a parent cycle and keeps every node once', () => {
    const out = sortNodesForHierarchy([node('a', 0, 0, 'b'), node('b', 0, 0, 'a')])
    expect(out.map((n) => n.id).sort()).toEqual(['a', 'b'])
  })
})

describe('healHierarchy', () => {
  it('leaves a sound hierarchy alone and reports nothing', () => {
    const nodes = [node('a', 0, 0), node('b', 5, 5, 'a')]
    const { nodes: out, notes } = healHierarchy(nodes)
    expect(notes).toEqual([])
    expect(out.map((n) => n.id)).toEqual(['a', 'b'])
    expect(out[1].parentId).toBe('a')
  })

  it('drops a parentId that points at a node not in the file, keeping the position numbers', () => {
    const { nodes, notes } = healHierarchy([node('b', 5, 6, 'gone')])
    expect(nodes[0].parentId).toBeUndefined()
    expect(nodes[0].position).toEqual({ x: 5, y: 6 })
    expect(notes).toEqual(["Removed 1 node reference to a container that isn't in this file."])
  })

  it('cuts a parent cycle at its entry node', () => {
    const { nodes, notes } = healHierarchy([node('a', 0, 0, 'b'), node('b', 0, 0, 'a')])
    expect(nodes.filter((n) => n.parentId).length).toBe(1)
    expect(notes).toEqual(['Broke 1 circular container nesting relationship.'])
  })
})

describe('removeContainerReparenting', () => {
  it('promotes the children of a removed top-level container to absolute positions', () => {
    const nodes = [node('box', 100, 50), node('kid', 10, 20, 'box')]
    const out = removeContainerReparenting(nodes, 'box')
    expect(out.map((n) => n.id)).toEqual(['kid'])
    expect(out[0].parentId).toBeUndefined()
    expect(out[0].position).toEqual({ x: 110, y: 70 })
  })

  it('hands the children to the removed container’s own parent, keeping them in place', () => {
    const nodes = [node('outer', 100, 100), node('box', 10, 10, 'outer'), node('kid', 5, 5, 'box')]
    const out = removeContainerReparenting(nodes, 'box')
    expect(out.map((n) => n.id)).toEqual(['outer', 'kid'])
    expect(out[1].parentId).toBe('outer')
    expect(out[1].position).toEqual({ x: 15, y: 15 })
  })

  it('returns the same array for an unknown container id', () => {
    const nodes = [node('a', 0, 0)]
    expect(removeContainerReparenting(nodes, 'nope')).toBe(nodes)
  })
})
