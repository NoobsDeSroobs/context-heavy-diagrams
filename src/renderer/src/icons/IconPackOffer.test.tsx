import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IconPackOffer from './IconPackOffer'

let offer: () => void
const answer = vi.fn(() => Promise.resolve())

beforeEach(() => {
  answer.mockClear()
  Object.assign(window, {
    api: {
      onIconPackOffer: (callback: () => void) => {
        offer = callback
        return () => undefined
      },
      answerIconPackOffer: answer
    }
  })
})
afterEach(cleanup)

describe('the first-start icon pack question', () => {
  it('shows nothing until main asks', () => {
    const { container } = render(<IconPackOffer />)
    expect(container.textContent).toBe('')
  })

  it('answers yes with Install and goes away', () => {
    render(<IconPackOffer />)
    act(() => offer())
    fireEvent.click(screen.getByText('Install'))
    expect(answer).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('answers no with Not now and goes away', () => {
    render(<IconPackOffer />)
    act(() => offer())
    fireEvent.click(screen.getByText('Not now'))
    expect(answer).toHaveBeenCalledWith(false)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
