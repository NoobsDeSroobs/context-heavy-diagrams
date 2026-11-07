import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NumberField } from './fields'

afterEach(cleanup)

// jsdom's MouseEvent has no movementX, which is what the drag adds up.
function move(clientX: number, movementX: number, extra: Record<string, boolean> = {}): void {
  const event = new MouseEvent('mousemove', { clientX, bubbles: true, ...extra })
  Object.defineProperty(event, 'movementX', { value: movementX })
  document.dispatchEvent(event)
}

function setup(
  value: number | undefined = 10,
  mixed = false
): {
  onChange: ReturnType<typeof vi.fn>
  onSessionStart: ReturnType<typeof vi.fn>
  onSessionEnd: ReturnType<typeof vi.fn>
  label: HTMLElement
} {
  const onChange = vi.fn()
  const onSessionStart = vi.fn()
  const onSessionEnd = vi.fn()
  render(
    <NumberField
      label="Width"
      value={value}
      mixed={mixed}
      min={0}
      max={100}
      onChange={onChange}
      onSessionStart={onSessionStart}
      onSessionEnd={onSessionEnd}
    />
  )
  return { onChange, onSessionStart, onSessionEnd, label: screen.getByText('Width') }
}

describe('dragging a number field label', () => {
  it('changes the value by one step per pixel, in one session', () => {
    const { onChange, onSessionStart, onSessionEnd, label } = setup()
    fireEvent.mouseDown(label, { button: 0, clientX: 100 })
    move(101, 1)
    expect(onChange).not.toHaveBeenCalled()
    move(105, 4)
    move(112, 7)
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([15, 22])
    expect(onSessionStart).toHaveBeenCalledTimes(1)
    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(onSessionEnd).toHaveBeenCalledTimes(1)
  })

  it('stays inside min and max', () => {
    const { onChange, label } = setup()
    fireEvent.mouseDown(label, { button: 0, clientX: 0 })
    move(500, 500)
    expect(onChange).toHaveBeenLastCalledWith(100)
    move(0, -1000)
    expect(onChange).toHaveBeenLastCalledWith(0)
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('goes finer with Shift and coarser with Ctrl', () => {
    const { onChange, label } = setup(10)
    fireEvent.mouseDown(label, { button: 0, clientX: 0 })
    move(5, 5, { shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(10.5)
    move(6, 1, { ctrlKey: true })
    expect(onChange).toHaveBeenLastCalledWith(20.5)
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('starts from zero on a mixed selection', () => {
    const { onChange, label } = setup(undefined, true)
    fireEvent.mouseDown(label, { button: 0, clientX: 0 })
    move(8, 8)
    expect(onChange).toHaveBeenLastCalledWith(8)
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('leaves a plain click alone, so the box still takes focus', () => {
    const { onChange, onSessionStart, label } = setup()
    fireEvent.mouseDown(label, { button: 0, clientX: 50 })
    move(51, 1)
    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(onChange).not.toHaveBeenCalled()
    expect(onSessionStart).not.toHaveBeenCalled()
    expect(fireEvent.click(label)).toBe(true)
  })

  it('does not let the click that ends a drag focus the box', () => {
    const { label } = setup()
    fireEvent.mouseDown(label, { button: 0, clientX: 0 })
    move(20, 20)
    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(fireEvent.click(label)).toBe(false)
  })
})
