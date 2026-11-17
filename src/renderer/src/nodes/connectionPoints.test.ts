import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import type { ConnectionPoint } from '@shared/diagram'
import {
  insertConnectionPointAt,
  reassignConnectionPointHandles,
  setSideCustomPointCount
} from './connectionPoints'

const left = (id: string, offset: number): ConnectionPoint => ({ id, side: 'left', offset })
const idsOf = (points: ConnectionPoint[]): string[] => points.map((p) => p.id)

describe('setSideCustomPointCount', () => {
  it('gives a new point an id no other point of the node has, also after a reload', () => {
    // A saved diagram already holds cp-1 and cp-2; the id counter of a new session starts again at 1.
    const stored = [left('left', 0.75), left('cp-1', 0.5), left('cp-2', 0.25)]
    const { points } = setSideCustomPointCount(stored, 'left', 4)
    expect(points.filter((p) => p.side === 'left')).toHaveLength(4)
    expect(new Set(idsOf(points)).size).toBe(4)
    // The three that were there keep their ids, so their edges stay attached.
    expect(idsOf(points)).toEqual(expect.arrayContaining(['left', 'cp-1', 'cp-2']))
  })

  it('does not reuse an id of another side', () => {
    const stored = [left('cp-1', 0.5), { id: 'cp-2', side: 'top' as const, offset: 0.5 }]
    const { points } = setSideCustomPointCount(stored, 'left', 3)
    expect(new Set(idsOf(points)).size).toBe(points.length)
  })

  it('moves the edges of every removed point to the one that is left, not to one that goes too', () => {
    const stored = [left('cp-1', 0.75), left('cp-2', 0.5), left('cp-3', 0.25)]
    const { points, handleReassignments } = setSideCustomPointCount(stored, 'left', 1)
    expect(points.filter((p) => p.side === 'left')).toHaveLength(1)
    const survivor = points[0].id
    const edges = ['cp-1', 'cp-2', 'cp-3', 'cp-3'].map((handle, i): Edge => ({
      id: `e${i}`,
      source: `s${i}`,
      target: 'n',
      targetHandle: handle
    }))
    const moved = reassignConnectionPointHandles(edges, 'n', handleReassignments)
    expect(moved.map((e) => e.targetHandle)).toEqual([survivor, survivor, survivor, survivor])
  })

  it('moves edges one step when it removes one point', () => {
    const stored = [left('cp-1', 0.75), left('cp-2', 0.5), left('cp-3', 0.25)]
    const { handleReassignments } = setSideCustomPointCount(stored, 'left', 2)
    expect([...handleReassignments]).toEqual([['cp-3', 'cp-2']])
  })
})

describe('insertConnectionPointAt', () => {
  it('gives the new point an id no other point of the node has', () => {
    const stored = [left('left', 0.75), left('cp-1', 0.5), left('cp-2', 0.25)]
    const points = insertConnectionPointAt(stored, 'left', 0.6, 12)
    expect(points).toBeDefined()
    expect(new Set(idsOf(points!)).size).toBe(4)
  })
})
