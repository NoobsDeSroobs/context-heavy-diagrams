import { afterEach, describe, expect, it, vi } from 'vitest'
import { includeEdgesInBounds } from './exportPng'

// jsdom has no SVG geometry, so each path is given the box the browser would report for it.
const SVG_NS = 'http://www.w3.org/2000/svg'
const viewportWith = (): HTMLElement => {
  const viewport = document.createElement('div')
  document.body.appendChild(viewport)
  return viewport
}
const addPath = (
  viewport: HTMLElement,
  box: { x: number; y: number; width: number; height: number },
  attrs: Record<string, string> = { d: 'M0 0' }
): void => {
  const svg = document.createElementNS(SVG_NS, 'svg')
  const path = document.createElementNS(SVG_NS, 'path') as SVGPathElement
  path.setAttribute('class', 'react-flow__edge-path')
  for (const [name, value] of Object.entries(attrs)) path.setAttribute(name, value)
  path.getBBox = () => box as DOMRect
  svg.appendChild(path)
  viewport.appendChild(svg)
}

const nodes = { x: 0, y: 0, width: 100, height: 50 }

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('includeEdgesInBounds', () => {
  it('leaves the bounds alone when there are no edges', () => {
    expect(includeEdgesInBounds(nodes, viewportWith())).toEqual(nodes)
  })

  it('grows the bounds to an edge route that runs past the outermost node', () => {
    const viewport = viewportWith()
    addPath(viewport, { x: 50, y: -300, width: 400, height: 300 })
    const bounds = includeEdgesInBounds(nodes, viewport)
    expect(bounds.y).toBeLessThan(-300)
    expect(bounds.x + bounds.width).toBeGreaterThan(450)
    // The node side that the edge does not pass is unchanged.
    expect(bounds.x).toBe(0)
    expect(bounds.y + bounds.height).toBe(50)
  })

  it('adds room for an arrowhead only when the edge has one', () => {
    const plain = viewportWith()
    addPath(plain, { x: 0, y: -100, width: 10, height: 10 })
    const withHead = viewportWith()
    addPath(
      withHead,
      { x: 0, y: -100, width: 10, height: 10 },
      { d: 'M0 0', 'marker-end': 'url(#a)' }
    )
    expect(includeEdgesInBounds(nodes, withHead).y).toBeLessThan(
      includeEdgesInBounds(nodes, plain).y
    )
  })

  it('ignores a path with no geometry, which would report a box at the origin', () => {
    const viewport = viewportWith()
    addPath(viewport, { x: -500, y: -500, width: 0, height: 0 }, {})
    expect(includeEdgesInBounds(nodes, viewport)).toEqual(nodes)
  })

  it('includes a label that sticks out, converting from screen to flow coordinates', () => {
    vi.stubGlobal(
      'DOMMatrixReadOnly',
      class {
        a = 2
      }
    )
    const viewport = viewportWith()
    viewport.getBoundingClientRect = () => ({ left: 100, top: 40 }) as DOMRect
    const label = document.createElement('div')
    label.className = 'edge-label'
    label.textContent = 'sends orders'
    // The label's right edge, 700px on screen, is (700 - 100) / 2 = 300 in flow space.
    label.getBoundingClientRect = () => ({ left: 300, top: 40, right: 700, bottom: 140 }) as DOMRect
    viewport.appendChild(label)
    const bounds = includeEdgesInBounds(nodes, viewport)
    expect(bounds.x + bounds.width).toBe(300)
    expect(bounds.y + bounds.height).toBe(50)
  })

  it('skips an empty label', () => {
    const viewport = viewportWith()
    const label = document.createElement('div')
    label.className = 'edge-label'
    label.getBoundingClientRect = () =>
      ({ left: 9000, top: 9000, right: 9100, bottom: 9100 }) as DOMRect
    viewport.appendChild(label)
    expect(includeEdgesInBounds(nodes, viewport)).toEqual(nodes)
  })
})
