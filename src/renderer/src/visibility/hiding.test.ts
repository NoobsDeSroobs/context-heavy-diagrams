import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { shownFilter } from '@shared/visibility/visibility'
import { applyHidden } from './hiding'

const catalogue = [
  { id: 'today', name: 'Today' },
  { id: 'proposed', name: 'Proposed' }
]
const node = (id: string, ids?: string[]): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: ids ? { label: id, visibilitySetIds: ids } : { label: id }
})
const edge = (id: string, ids?: string[]): Edge => ({
  id,
  source: 'a',
  target: 'b',
  data: ids ? { visibilitySetIds: ids } : {}
})

describe('applyHidden', () => {
  it('marks what the rule hides and leaves everything else as it was', () => {
    const nodes = [node('a'), node('b', ['today']), node('c', ['proposed'])]
    const out = applyHidden(nodes, shownFilter(catalogue, new Set(['today'])))
    expect(out.map((n) => n.hidden === true)).toEqual([false, true, false])
    expect(out[0]).toBe(nodes[0])
    expect(out[2]).toBe(nodes[2])
  })

  it('judges an edge by its own sets, not by its ends', () => {
    const edges = [edge('e1'), edge('e2', ['today'])]
    const out = applyHidden(edges, shownFilter(catalogue, new Set(['today'])))
    expect(out.map((e) => e.hidden === true)).toEqual([false, true])
  })

  it('returns the same array when nothing is hidden, so nothing is redrawn', () => {
    const nodes = [node('a'), node('b', ['today'])]
    expect(applyHidden(nodes, shownFilter(catalogue, new Set()))).toBe(nodes)
  })

  it('shows an element again when its set is shown', () => {
    const nodes = [node('b', ['today'])]
    const hidden = applyHidden(nodes, shownFilter(catalogue, new Set(['today'])))
    expect(hidden[0].hidden).toBe(true)
    // the canvas state never holds `hidden`, so showing starts again from the state
    expect(applyHidden(nodes, shownFilter(catalogue, new Set()))[0].hidden).toBeUndefined()
  })
})
