import { describe, expect, it } from 'vitest'
import { LIST_WIDTH, listPlace } from './listPlace'

const anchor = (left: number, top: number, width = 120): DOMRect =>
  ({ left, right: left + width, top, bottom: top + 60, width, height: 60 }) as DOMRect

describe('the kind list of the palette', () => {
  it('pops out to the left of a palette on the right, wider than the palette', () => {
    const at = listPlace(anchor(1000, 200))
    expect(at.width).toBe(LIST_WIDTH)
    expect(at.left + at.width).toBeLessThanOrEqual(1000)
    expect(at.top).toBe(200)
  })

  it('goes to the right of the button when there is no room on the left', () => {
    const at = listPlace(anchor(100, 200))
    expect(at.left).toBeGreaterThanOrEqual(220)
  })

  it('is as tall as the window allows from the top of the button, and not shorter than 200', () => {
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true })
    expect(listPlace(anchor(1000, 200)).maxHeight).toBe(684)
    expect(listPlace(anchor(1000, 850)).maxHeight).toBe(200)
  })
})
