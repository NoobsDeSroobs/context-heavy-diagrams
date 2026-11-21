import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRESENTER_IDLE_MS, usePresenterActivity } from './usePresenterActivity'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('usePresenterActivity', () => {
  it('is hidden until the mouse moves, and hides again when it has been still', () => {
    const { result } = renderHook(() => usePresenterActivity(true))
    expect(result.current).toBe(false)
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'))
    })
    expect(result.current).toBe(true)
    // movement keeps it up
    act(() => {
      vi.advanceTimersByTime(PRESENTER_IDLE_MS - 100)
      window.dispatchEvent(new MouseEvent('mousemove'))
      vi.advanceTimersByTime(PRESENTER_IDLE_MS - 100)
    })
    expect(result.current).toBe(true)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe(false)
  })

  it('is never shown when not presenting, and ignores the keys', () => {
    const { result } = renderHook(() => usePresenterActivity(false))
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'))
    })
    expect(result.current).toBe(false)
    const presenting = renderHook(() => usePresenterActivity(true))
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    })
    expect(presenting.result.current).toBe(false)
  })
})
