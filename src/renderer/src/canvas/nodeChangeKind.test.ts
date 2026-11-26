import { describe, expect, it } from 'vitest'
import type { NodeChange } from '@xyflow/react'
import { classifyNodeChanges } from './nodeChangeKind'

const dims = (resizing?: boolean): NodeChange => ({
  type: 'dimensions',
  id: 'a',
  dimensions: { width: 100, height: 40 },
  resizing
})

describe('classifyNodeChanges', () => {
  it('does not count React Flow measuring a node as an edit', () => {
    expect(classifyNodeChanges([dims()])).toEqual({
      starting: false,
      ending: false,
      discrete: false
    })
  })

  it('treats a dragged resize as one gesture', () => {
    expect(classifyNodeChanges([dims(true)]).starting).toBe(true)
    expect(classifyNodeChanges([dims(false)]).ending).toBe(true)
    expect(classifyNodeChanges([dims(true)]).discrete).toBe(false)
  })

  it('counts add, remove and replace as discrete edits', () => {
    const node = { id: 'a', position: { x: 0, y: 0 }, data: {} }
    expect(classifyNodeChanges([{ type: 'add', item: node }]).discrete).toBe(true)
    expect(classifyNodeChanges([{ type: 'remove', id: 'a' }]).discrete).toBe(true)
    expect(classifyNodeChanges([{ type: 'replace', id: 'a', item: node }]).discrete).toBe(true)
  })

  it('counts a position change without a dragging flag (arrow-key nudge) as discrete', () => {
    const nudge: NodeChange = { type: 'position', id: 'a', position: { x: 1, y: 0 } }
    expect(classifyNodeChanges([nudge]).discrete).toBe(true)
  })

  it('treats a drag as one gesture', () => {
    const drag = (dragging: boolean): NodeChange => ({
      type: 'position',
      id: 'a',
      position: { x: 5, y: 5 },
      dragging
    })
    expect(classifyNodeChanges([drag(true)])).toMatchObject({ starting: true, discrete: false })
    expect(classifyNodeChanges([drag(false)])).toMatchObject({ ending: true, discrete: false })
  })

  it('ignores selection changes', () => {
    expect(classifyNodeChanges([{ type: 'select', id: 'a', selected: true }])).toEqual({
      starting: false,
      ending: false,
      discrete: false
    })
  })
})
