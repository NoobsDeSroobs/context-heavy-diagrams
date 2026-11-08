import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import UtilityDock from './UtilityDock'

afterEach(cleanup)

function dock(width = 360, onWidthChange = vi.fn()): { onWidthChange: typeof onWidthChange } {
  render(
    <UtilityDock width={width} onWidthChange={onWidthChange}>
      <div>panel</div>
    </UtilityDock>
  )
  return { onWidthChange }
}

const handle = (): HTMLElement => screen.getByRole('separator')

describe('the side dock width handle', () => {
  it('takes the width it is given', () => {
    dock(420)
    expect(handle().getAttribute('aria-valuenow')).toBe('420')
    expect(document.querySelector<HTMLElement>('.utility-dock')?.style.width).toBe('420px')
  })

  it('is wider when the pointer moves left, and reports the width once, on release', () => {
    const { onWidthChange } = dock(360)
    fireEvent.pointerDown(handle(), { clientX: 1000, pointerId: 1 })
    fireEvent.pointerMove(handle(), { clientX: 950, pointerId: 1 })
    expect(handle().getAttribute('aria-valuenow')).toBe('410')
    expect(onWidthChange).not.toHaveBeenCalled()
    fireEvent.pointerUp(handle(), { clientX: 900, pointerId: 1 })
    expect(onWidthChange).toHaveBeenCalledTimes(1)
    expect(onWidthChange).toHaveBeenCalledWith(460)
  })

  it('stops at the narrowest and the widest width', () => {
    const { onWidthChange } = dock(360)
    fireEvent.pointerDown(handle(), { clientX: 1000, pointerId: 1 })
    fireEvent.pointerUp(handle(), { clientX: 5000, pointerId: 1 })
    expect(onWidthChange).toHaveBeenLastCalledWith(280)
    fireEvent.pointerDown(handle(), { clientX: 1000, pointerId: 1 })
    fireEvent.pointerUp(handle(), { clientX: -5000, pointerId: 1 })
    expect(onWidthChange).toHaveBeenLastCalledWith(900)
  })

  it('goes back to the default on a double-click', () => {
    const { onWidthChange } = dock(600)
    fireEvent.doubleClick(handle())
    expect(onWidthChange).toHaveBeenCalledWith(360)
  })

  it('moves a step with the arrow keys, a larger one with Shift', () => {
    const { onWidthChange } = dock(360)
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' })
    expect(onWidthChange).toHaveBeenLastCalledWith(376)
    fireEvent.keyDown(handle(), { key: 'ArrowRight', shiftKey: true })
    expect(onWidthChange).toHaveBeenLastCalledWith(296)
  })

  it('renders nothing when no panel is open', () => {
    render(
      <UtilityDock width={360} onWidthChange={vi.fn()}>
        {false}
      </UtilityDock>
    )
    expect(screen.queryByRole('separator')).toBeNull()
  })
})
