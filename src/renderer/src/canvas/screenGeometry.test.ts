import { afterEach, describe, expect, it } from 'vitest'
import type { FinalConnectionState } from '@xyflow/react'
import {
  connectionRadiusForZoom,
  isVoidDrop,
  pointFromEvent,
  visibleCanvasCenter
} from './screenGeometry'

const state = (isValid: boolean): FinalConnectionState => ({ isValid }) as FinalConnectionState
const eventOn = (target: Element): MouseEvent => {
  const e = new MouseEvent('mouseup')
  Object.defineProperty(e, 'target', { value: target })
  return e
}
const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect

afterEach(() => {
  document.body.innerHTML = ''
})

describe('isVoidDrop', () => {
  it('is true only when the drag ended invalid over the bare pane', () => {
    const pane = document.createElement('div')
    pane.className = 'react-flow__pane'
    const other = document.createElement('div')
    expect(isVoidDrop(eventOn(pane), state(false))).toBe(true)
    expect(isVoidDrop(eventOn(pane), state(true))).toBe(false)
    expect(isVoidDrop(eventOn(other), state(false))).toBe(false)
  })
})

describe('connectionRadiusForZoom', () => {
  it('keeps the default at or above a zoom of 1', () => {
    expect(connectionRadiusForZoom(1)).toBe(20)
    expect(connectionRadiusForZoom(2)).toBe(20)
  })

  it('doubles per halving of the zoom, keeping the screen radius within 14 to 28 px', () => {
    expect(connectionRadiusForZoom(0.5)).toBe(40)
    expect(connectionRadiusForZoom(0.25)).toBe(80)
    for (const zoom of [0.9, 0.7, 0.4, 0.2, 0.1, 0.05]) {
      const screen = connectionRadiusForZoom(zoom) * zoom
      expect(screen).toBeGreaterThanOrEqual(14)
      expect(screen).toBeLessThanOrEqual(28.3)
    }
  })

  it('falls back to the default for a zoom that is not a positive number', () => {
    expect(connectionRadiusForZoom(0)).toBe(20)
    expect(connectionRadiusForZoom(Number.NaN)).toBe(20)
  })
})

describe('pointFromEvent', () => {
  it('reads a mouse event directly and a touch event from changedTouches', () => {
    const mouse = new MouseEvent('mouseup', { clientX: 3, clientY: 4 })
    expect(pointFromEvent(mouse)).toBe(mouse)
    const touch = { clientX: 8, clientY: 9 }
    expect(pointFromEvent({ changedTouches: [touch] } as unknown as TouchEvent)).toBe(touch)
  })
})

describe('visibleCanvasCenter', () => {
  it('falls back to the window centre before the canvas is mounted', () => {
    expect(visibleCanvasCenter()).toEqual({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  })

  it('is the centre of the React Flow pane', () => {
    const flow = document.createElement('div')
    flow.className = 'react-flow'
    flow.getBoundingClientRect = () => rect(100, 50, 400, 200)
    document.body.append(flow)
    expect(visibleCanvasCenter()).toEqual({ x: 300, y: 150 })
  })
})
