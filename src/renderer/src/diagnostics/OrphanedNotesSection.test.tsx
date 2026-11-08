import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OrphanedNotesSection from './OrphanedNotesSection'

afterEach(cleanup)

const edit = { nodeId: 'gone', path: 'notes/Billing-1.md', content: '# Billing\n\nWorks nightly.' }

describe('unsaved note edits whose element is gone', () => {
  it('shows nothing when there are none', () => {
    const { container } = render(
      <OrphanedNotesSection edits={[]} onCopy={vi.fn()} onDiscard={vi.fn()} />
    )
    expect(container.textContent).toBe('')
  })

  it('names the file and the first line of the text', () => {
    render(<OrphanedNotesSection edits={[edit]} onCopy={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.getByText('Unsaved note edits (1)')).toBeTruthy()
    expect(screen.getByText('notes/Billing-1.md')).toBeTruthy()
    expect(screen.getByText(/“Billing”/)).toBeTruthy()
  })

  it('says so for a note that was never saved', () => {
    render(
      <OrphanedNotesSection
        edits={[{ ...edit, path: null }]}
        onCopy={vi.fn()}
        onDiscard={vi.fn()}
      />
    )
    expect(screen.getByText('not saved yet')).toBeTruthy()
  })

  it('copies or discards the one entry', () => {
    const onCopy = vi.fn()
    const onDiscard = vi.fn()
    render(<OrphanedNotesSection edits={[edit]} onCopy={onCopy} onDiscard={onDiscard} />)
    fireEvent.click(screen.getByText('Copy text'))
    expect(onCopy).toHaveBeenCalledWith(edit)
    fireEvent.click(screen.getByText('Discard'))
    expect(onDiscard).toHaveBeenCalledWith(edit)
  })
})
