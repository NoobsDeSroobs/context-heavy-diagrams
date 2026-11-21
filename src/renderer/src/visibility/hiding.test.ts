import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { visibleFilter } from '@shared/visibility/visibility'
import { fadeBetween, withVisibility } from './hiding'

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

describe('withVisibility', () => {
  it('marks what the rule hides and leaves everything else as it was', () => {
    const nodes = [node('a'), node('b', ['today']), node('c', ['proposed'])]
    const out = withVisibility(nodes, visibleFilter(catalogue, new Set(['today'])))
    expect(out.map((n) => n.hidden === true)).toEqual([false, true, false])
    expect(out[0]).toBe(nodes[0])
    expect(out[2]).toBe(nodes[2])
  })

  it('judges an edge by its own sets, not by its ends', () => {
    const edges = [edge('e1'), edge('e2', ['today'])]
    const out = withVisibility(edges, visibleFilter(catalogue, new Set(['today'])))
    expect(out.map((e) => e.hidden === true)).toEqual([false, true])
  })

  it('returns the same array when nothing is hidden, so nothing is redrawn', () => {
    const nodes = [node('a'), node('b', ['today'])]
    expect(withVisibility(nodes, visibleFilter(catalogue, new Set()))).toBe(nodes)
  })

  it('shows an element again when its set is shown', () => {
    const nodes = [node('b', ['today'])]
    const hidden = withVisibility(nodes, visibleFilter(catalogue, new Set(['today'])))
    expect(hidden[0].hidden).toBe(true)
    // the canvas state never holds `hidden`, so showing starts again from the state
    expect(withVisibility(nodes, visibleFilter(catalogue, new Set()))[0].hidden).toBeUndefined()
  })
})

describe('the fade of the presenter (ADR 0195)', () => {
  it('keeps what is leaving drawn, with the fade-out class, and marks what is entering', () => {
    const nodes = [node('a'), node('b', ['today']), node('c', ['proposed'])]
    const visible = visibleFilter(catalogue, new Set(['today']))
    const fade = { entering: new Set(['c']), leaving: new Set(['b']) }
    const out = withVisibility(nodes, visible, fade)
    // b is hidden by the rule but is leaving: still drawn, fading out
    expect(out[1].hidden).toBe(false)
    expect(out[1].className).toBe('story-fading-out')
    expect(out[2].className).toBe('story-fading-in')
    // untouched elements come back as they were
    expect(out[0]).toBe(nodes[0])
    // the canvas state is never given the class
    expect(nodes[1].className).toBeUndefined()
  })

  it('puts the class in an edge’s data too, since its label is drawn outside it', () => {
    const edges = [edge('e1', ['today'])]
    const out = withVisibility(edges, visibleFilter(catalogue, new Set()), {
      entering: new Set(['e1']),
      leaving: new Set()
    })
    expect(out[0].className).toBe('story-fading-in')
    expect(out[0].data?.fadeClass).toBe('story-fading-in')
  })

  it('adds to a class the element already has, and changes nothing without a fade', () => {
    const nodes = [{ ...node('b', ['today']), className: 'x' }]
    const out = withVisibility(nodes, visibleFilter(catalogue, new Set()), {
      entering: new Set(['b']),
      leaving: new Set()
    })
    expect(out[0].className).toBe('x story-fading-in')
    expect(withVisibility(nodes, visibleFilter(catalogue, new Set()), null)).toBe(nodes)
  })

  it('works out what enters and what leaves between two choices of hidden sets', () => {
    const elements = [
      node('a'),
      node('b', ['today']),
      node('c', ['proposed']),
      edge('e', ['today'])
    ]
    const fade = fadeBetween(
      elements,
      visibleFilter(catalogue, new Set(['today'])),
      visibleFilter(catalogue, new Set(['proposed']))
    )
    expect([...(fade?.entering ?? [])].sort()).toEqual(['b', 'e'])
    expect([...(fade?.leaving ?? [])]).toEqual(['c'])
    const same = visibleFilter(catalogue, new Set(['today']))
    expect(fadeBetween(elements, same, same)).toBeNull()
  })
})
