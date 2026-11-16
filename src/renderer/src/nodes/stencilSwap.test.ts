import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { swapStencilKind } from './stencilSwap'

const step = (extra: Partial<Node> = {}, data: Record<string, unknown> = {}): Node => ({
  id: 's',
  type: 'stencil',
  position: { x: 100, y: 100 },
  width: 150,
  height: 56,
  data: { label: 'Step', kind: 'step', ...data },
  ...extra
})

describe('swapStencilKind', () => {
  it('takes the new kind, its default label and its size, keeping the centre', () => {
    const swapped = swapStencilKind(step(), 'branch-exclusive')
    expect(swapped.data).toMatchObject({ kind: 'branch-exclusive', label: 'Decision' })
    expect([swapped.width, swapped.height]).toEqual([48, 48])
    expect(swapped.position).toEqual({ x: 151, y: 104 })
  })

  it('keeps a label the person typed', () => {
    const swapped = swapStencilKind(step({}, { label: 'Approve invoice' }), 'branch-exclusive')
    expect(swapped.data?.label).toBe('Approve invoice')
  })

  it('keeps a size the person set', () => {
    const swapped = swapStencilKind(step({ width: 200, height: 80 }), 'branch-exclusive')
    expect([swapped.width, swapped.height]).toEqual([200, 80])
    expect(swapped.position).toEqual({ x: 100, y: 100 })
  })

  it('keeps the link, the style and the place of the element', () => {
    const swapped = swapStencilKind(
      step({}, { linkedDiagram: 'detail.chd', style: { stroke: '#fff' } }),
      'branch-parallel'
    )
    expect(swapped.data).toMatchObject({ linkedDiagram: 'detail.chd', style: { stroke: '#fff' } })
  })

  it('does nothing for the kind it already has', () => {
    const node = step()
    expect(swapStencilKind(node, 'step')).toBe(node)
  })
})
