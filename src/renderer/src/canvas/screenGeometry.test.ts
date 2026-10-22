import { afterEach, describe, expect, it } from 'vitest'
import type { FinalConnectionState } from '@xyflow/react'
import { isVoidDrop, pointFromEvent, visibleCanvasCenter } from './screenGeometry'

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
