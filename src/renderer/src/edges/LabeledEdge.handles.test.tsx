import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReactFlowProvider, type EdgeProps } from '@xyflow/react'

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BaseEdge: () => <path />,
  useReactFlow: () => ({ updateEdgeData: vi.fn(), screenToFlowPosition: (p: unknown) => p })
}))

import DiagramContext, { type DiagramContextValue } from '../canvas/DiagramContext'
import LabeledEdge from './LabeledEdge'

afterEach(cleanup)

const context = {
  matchHighlights: () => [],
  edgeStraightSegmentLength: 8,
  theme: 'light',
  pushSnapshot: () => {},
  beginContinuousEdit: () => {},
  endContinuousEdit: () => {},
  openContextMenu: () => {},
  gravityPresets: [],
  searchMatchIds: new Set(),
  isolateActive: false,
  isolateOpacity: 0.3,
  showCrossings: false
} as unknown as DiagramContextValue

function draw(routingStyle: string, selected: boolean, to = { x: 300, y: 180 }): HTMLElement {
  const props = {
    id: 'e1',
    source: 'a',
    target: 'b',
    sourceX: 120,
    sourceY: 30,
    targetX: to.x,
    targetY: to.y,
    sourcePosition: 'right',
    targetPosition: 'left',
    selected,
    data: { style: { routingStyle } }
  } as unknown as EdgeProps
  return render(
    <ReactFlowProvider>
      <DiagramContext.Provider value={context}>
        <svg>
          <LabeledEdge {...props} />
        </svg>
      </DiagramContext.Provider>
    </ReactFlowProvider>
  ).container
}

// The segment handles of a step or smooth step edge are shown while the edge is selected or
// hovered, and stays while the pointer is on the handle itself, which lies over the edge's hover surface.
describe('segment handles of step edges', () => {
  Object.defineProperty(SVGElement.prototype, 'getTotalLength', { value: () => 100 })
  Object.defineProperty(SVGElement.prototype, 'getPointAtLength', {
    value: () => ({ x: 0, y: 0 })
  })

  it('stays while the pointer moves from the edge onto the handle, and goes when it leaves', () => {
    vi.useFakeTimers()
    try {
      const container = draw('step', false)
      const hit = [...container.querySelectorAll('path')].find(
        (p) => p.getAttribute('stroke') === 'transparent'
      )!
      fireEvent.pointerEnter(hit)
      // Reaching the handle ends the hover on the edge, and starts it on the handle.
      fireEvent.pointerLeave(hit)
      act(() => vi.advanceTimersByTime(20))
      fireEvent.pointerEnter(container.querySelector('.edge-segment-handle')!)
      act(() => vi.advanceTimersByTime(500))
      expect(container.querySelectorAll('.edge-segment-handle')).toHaveLength(3)
      fireEvent.pointerLeave(container.querySelector('.edge-segment-handle')!)
      act(() => vi.advanceTimersByTime(500))
      expect(container.querySelectorAll('.edge-segment-handle')).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  for (const style of ['step', 'smoothstep']) {
    it(`${style}: a selected edge shows a handle on each of its three segments`, () => {
      expect(draw(style, true).querySelectorAll('.edge-segment-handle')).toHaveLength(3)
    })
    it(`${style}: an unselected edge shows it while hovered`, () => {
      const container = draw(style, false)
      expect(container.querySelectorAll('.edge-segment-handle')).toHaveLength(0)
      const hit = [...container.querySelectorAll('path')].find(
        (p) => p.getAttribute('stroke') === 'transparent'
      )!
      fireEvent.pointerEnter(hit)
      expect(container.querySelectorAll('.edge-segment-handle')).toHaveLength(3)
    })
  }
})
