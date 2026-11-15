import { describe, expect, it } from 'vitest'
import type { AttachNode } from '@shared/geometry/autoAttach'
import { currentAutoHandles, resolveAutoHandles } from './pointSlideStore'

const box = (id: string, x: number, y: number): AttachNode => ({
  id,
  x,
  y,
  width: 100,
  height: 60,
  points: []
})

describe('resolveAutoHandles', () => {
  it('names the facing points for an edge with no handles', () => {
    const got = resolveAutoHandles(
      [box('a', 0, 0), box('b', 300, 0)],
      [{ id: 'e', source: 'a', target: 'b' }]
    )
    expect(got.get('e')).toEqual({ sourceHandle: 'right', targetHandle: 'left' })
    expect(currentAutoHandles()).toBe(got)
  })

  it('keeps the same map while the answer does not change, so edges keep their identity', () => {
    const edges = [{ id: 'e', source: 'a', target: 'b' }]
    const first = resolveAutoHandles([box('a', 0, 0), box('b', 300, 0)], edges)
    const second = resolveAutoHandles([box('a', 0, 0), box('b', 320, 5)], edges)
    expect(second).toBe(first)
    const moved = resolveAutoHandles([box('a', 0, 0), box('b', 0, 300)], edges)
    expect(moved).not.toBe(first)
    expect(moved.get('e')).toEqual({ sourceHandle: 'bottom', targetHandle: 'top' })
  })
})
