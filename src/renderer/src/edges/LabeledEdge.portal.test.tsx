import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReactFlowProvider, type EdgeProps } from '@xyflow/react'

const setCenter = vi.fn()
const updateEdgeData = vi.fn()

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BaseEdge: ({ id, path }: { id: string; path: string }) => (
    <path data-testid="base-edge" data-id={id} d={path} />
  ),
  useReactFlow: () => ({
    updateEdgeData,
    screenToFlowPosition: (p: unknown) => p,
    setCenter,
    getZoom: () => 1
  })
}))

import DiagramContext, { type DiagramContextValue } from '../canvas/DiagramContext'
import LabeledEdge from './LabeledEdge'

// jsdom has no SVG geometry: the label's place is measured on the real path in a browser.
Object.defineProperty(SVGElement.prototype, 'getTotalLength', { value: () => 100 })
Object.defineProperty(SVGElement.prototype, 'getPointAtLength', {
  value: () => ({ x: 0, y: 0 })
})

afterEach(() => {
  cleanup()
  setCenter.mockClear()
  updateEdgeData.mockClear()
})

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
  showCrossings: false,
  portalMark: 'tilde',
  portalNumbers: new Map([['e1', 4]]),
  edgeLengths: new Map()
} as unknown as DiagramContextValue

// A straight edge 400 units long, from (0, 30) to (400, 30).
function draw(style: object, selected = false, value = context): HTMLElement {
  const props = {
    id: 'e1',
    source: 'a',
    target: 'b',
    sourceX: 0,
    sourceY: 30,
    targetX: 400,
    targetY: 30,
    sourcePosition: 'right',
    targetPosition: 'left',
    selected,
    data: { style: { routingStyle: 'straight', ...style } }
  } as unknown as EdgeProps
  return render(
    <ReactFlowProvider>
      <DiagramContext.Provider value={value}>
        <svg>
          <LabeledEdge {...props} />
        </svg>
      </DiagramContext.Provider>
    </ReactFlowProvider>
  ).container
}

describe('a portal on an edge', () => {
  it('draws the edge in two parts, with a mark and the number at each end of the gap', () => {
    const container = draw({ portalStart: 0.4, portalEnd: 0.6 })
    expect(container.querySelectorAll('[data-testid="base-edge"]')).toHaveLength(2)
    expect(container.querySelectorAll('.edge-portal-tilde')).toHaveLength(2)
    expect(
      [...container.querySelectorAll('.edge-portal-number')].map((n) => n.textContent)
    ).toEqual(['4', '4'])
  })

  it('draws the whole edge when there is no portal, or only half of one', () => {
    for (const style of [{}, { portalStart: 0.4 }, { portalStart: 0.6, portalEnd: 0.4 }]) {
      const container = draw(style)
      expect(container.querySelectorAll('[data-testid="base-edge"]')).toHaveLength(1)
      expect(container.querySelectorAll('.edge-portal-mark')).toHaveLength(0)
      cleanup()
    }
  })

  it('draws the whole edge when the gap would leave no drawn part at an end', () => {
    expect(
      draw({ portalStart: 0.01, portalEnd: 0.5 }).querySelectorAll('.edge-portal-mark')
    ).toHaveLength(0)
  })

  it('draws an oval at each end when the preference says oval', () => {
    const container = draw({ portalStart: 0.4, portalEnd: 0.6 }, false, {
      ...context,
      portalMark: 'oval'
    })
    expect(container.querySelectorAll('.edge-portal-oval')).toHaveLength(2)
    expect(container.querySelectorAll('.edge-portal-tilde')).toHaveLength(0)
  })

  it('shows the whole edge while it is selected or a mark is hovered', () => {
    const selected = draw({ portalStart: 0.4, portalEnd: 0.6 }, true)
    expect(selected.querySelector('.edge-portal-whole')!.classList.contains('is-on')).toBe(true)
    cleanup()
    const container = draw({ portalStart: 0.4, portalEnd: 0.6 })
    const whole = container.querySelector('.edge-portal-whole')!
    expect(whole.classList.contains('is-on')).toBe(false)
    fireEvent.pointerEnter(container.querySelector('.edge-portal-mark')!)
    expect(whole.classList.contains('is-on')).toBe(true)
  })

  it('moves a mark only when it is dragged with Alt held', () => {
    SVGElement.prototype.setPointerCapture = () => {}
    SVGElement.prototype.releasePointerCapture = () => {}
    const drag = (altKey: boolean): void => {
      const container = draw({ portalStart: 0.4, portalEnd: 0.6 })
      const mark = container.querySelector('.edge-portal-mark')!
      fireEvent.pointerDown(mark, { button: 0, clientX: 160, clientY: 30, altKey })
      fireEvent.pointerMove(window, { clientX: 100, clientY: 30 })
      fireEvent.pointerUp(window)
      cleanup()
    }
    drag(false)
    expect(updateEdgeData).not.toHaveBeenCalled()
    drag(true)
    expect(updateEdgeData).toHaveBeenCalled()
  })

  it('takes the typed number when no numbers are supplied, as in a window that only reads', () => {
    const container = draw({ portalStart: 0.4, portalEnd: 0.6, portalNumber: 9 }, false, {
      ...context,
      portalNumbers: undefined,
      edgeLengths: undefined
    })
    expect(container.querySelector('.edge-portal-number')!.textContent).toBe('9')
  })
})
