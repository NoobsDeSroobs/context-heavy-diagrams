import { describe, expect, it } from 'vitest'
import { connectionSourceIds } from './multiConnection'

const entity = (id: string, selected = false): { id: string; type: string; selected: boolean } => ({
  id,
  type: 'entity',
  selected
})

describe('connectionSourceIds', () => {
  it('wires only the dragged node when it is not selected, even with another node selected', () => {
    // A was just moved, so it is selected; dragging from B onto A must not also give A an edge to A.
    const nodes = [entity('a', true), entity('b')]
    expect(connectionSourceIds(nodes, 'b', 'a')).toEqual(['b'])
    expect(connectionSourceIds(nodes, 'b')).toEqual(['b'])
  })

  it('wires only the dragged node when it is the one selected node', () => {
    expect(connectionSourceIds([entity('a', true), entity('b')], 'a', 'b')).toEqual(['a'])
  })

  it('wires every selected connectable node when the drag starts from one of them', () => {
    const nodes = [
      entity('a', true),
      entity('b', true),
      { id: 'note', type: 'text', selected: true },
      entity('c')
    ]
    expect(connectionSourceIds(nodes, 'a', 'c')).toEqual(['a', 'b'])
  })

  it('leaves the target out of the selected nodes, so no node is wired to itself', () => {
    const nodes = [entity('a', true), entity('b', true), entity('c', true)]
    expect(connectionSourceIds(nodes, 'b', 'a')).toEqual(['b', 'c'])
  })
})
