import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NotesPanel from './NotesPanel'
import type { NoteSaveState } from './notesLabels'

afterEach(cleanup)

function panel(saveState: NoteSaveState): void {
  render(
    <NotesPanel
      title="Billing"
      content="text"
      saveState={saveState}
      onChange={vi.fn()}
      onClose={vi.fn()}
    />
  )
}

describe('the notes panel save state', () => {
  it('says Unsaved while the edits are only in memory', () => {
    panel('unsaved')
    expect(screen.getByText('Unsaved')).toBeTruthy()
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('says Saved when the file is what the panel shows', () => {
    panel('saved')
    expect(screen.getByText('Saved')).toBeTruthy()
    expect(screen.queryByText('Unsaved')).toBeNull()
  })

  it('says nothing for a note with no file and no edits', () => {
    panel(null)
    expect(screen.queryByText('Saved')).toBeNull()
    expect(screen.queryByText('Unsaved')).toBeNull()
  })
})
