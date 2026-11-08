import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OutsideChangeNotice from './OutsideChangeNotice'

afterEach(cleanup)

const hub = { key: 'hub', label: 'shop.chd', stamp: '2:2', dirty: false }
const note = { key: 'n1', label: 'Note "Payments"', stamp: '3:3', dirty: true }

function notice(files: (typeof hub)[]): {
  onReview: () => void
  onReload: () => void
  onIgnore: () => void
} {
  const handlers = { onReview: vi.fn(), onReload: vi.fn(), onIgnore: vi.fn() }
  render(<OutsideChangeNotice files={files} {...handlers} />)
  return handlers
}

describe('the notice for files changed outside the app', () => {
  it('says nothing when no file changed', () => {
    const { container } = render(
      <OutsideChangeNotice files={[]} onReview={vi.fn()} onReload={vi.fn()} onIgnore={vi.fn()} />
    )
    expect(container.textContent).toBe('')
  })

  it('lists every changed file and marks the ones with unsaved edits', () => {
    notice([hub, note])
    expect(screen.getByRole('alert').textContent).toContain(
      'Changed outside the app: shop.chd, Note "Payments". You have unsaved edits to Note "Payments".'
    )
  })

  it('offers Review changes only when the diagram itself changed', () => {
    notice([note])
    expect(screen.queryByText('Review changes')).toBeNull()
    cleanup()
    notice([hub])
    expect(screen.getByText('Review changes')).toBeTruthy()
  })

  it('reloads or ignores', () => {
    const { onReload, onIgnore } = notice([hub])
    fireEvent.click(screen.getByText('Reload'))
    fireEvent.click(screen.getByText('Ignore'))
    expect(onReload).toHaveBeenCalled()
    expect(onIgnore).toHaveBeenCalled()
  })
})
