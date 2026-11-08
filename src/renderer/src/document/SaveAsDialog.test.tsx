import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaveAsPlan } from '@shared/document/saveAsCopy'
import SaveAsDialog from './SaveAsDialog'
import { askSaveAs, suggestedCopyPath, type SaveAsChoice } from './saveAsPrompt'

afterEach(cleanup)

const plan = (over: Partial<SaveAsPlan> = {}): SaveAsPlan => ({
  assets: [],
  rootRefs: {},
  counts: { notes: 4, images: 3, linked: 2 },
  removed: [],
  problems: [],
  ...over
})

let pickSavePath: ReturnType<typeof vi.fn>
beforeEach(() => {
  pickSavePath = vi.fn(async () => 'D:\\other\\B.chd')
  ;(window as unknown as { api: unknown }).api = { pickSavePath }
})

// Opens the dialog and returns what it answers with, once it does.
function open(planFor: (path: string, options: object) => Promise<SaveAsPlan>): {
  answer: Promise<SaveAsChoice | null>
} {
  render(<SaveAsDialog />)
  let answer!: Promise<SaveAsChoice | null>
  act(() => {
    answer = askSaveAs({ currentPath: 'D:\\work\\A.chd', planFor })
  })
  return { answer }
}

const browse = async (): Promise<void> => {
  fireEvent.click(screen.getByText('Browse…'))
  await waitFor(() => expect((screen.getByLabelText('Path of the copy') as HTMLInputElement).value))
}

describe('the Save As dialog', () => {
  it('starts the picker beside the current diagram and fills in the path', async () => {
    open(async () => plan())
    await browse()
    expect(pickSavePath).toHaveBeenCalledWith('D:\\work\\A copy.chd')
    expect((screen.getByLabelText('Path of the copy') as HTMLInputElement).value).toBe(
      'D:\\other\\B.chd'
    )
  })

  it('cannot save before a path is chosen, and shows what would be copied after', async () => {
    open(async () => plan())
    expect((screen.getByText('Save a copy') as HTMLButtonElement).disabled).toBe(true)
    await browse()
    await screen.findByText('4 notes')
    expect(screen.getByText('3 files')).toBeTruthy()
    // Linked diagrams start unticked, so the two links go.
    expect(screen.getByText('2 links removed')).toBeTruthy()
    expect((screen.getByText('Save a copy') as HTMLButtonElement).disabled).toBe(false)
  })

  it('plans again when a toggle changes, and answers with what the person chose', async () => {
    const planFor = vi.fn(async () => plan())
    const { answer } = open(planFor)
    await browse()
    await screen.findByText('4 notes')
    fireEvent.click(screen.getByLabelText(/Linked diagrams/))
    await waitFor(() =>
      expect(planFor).toHaveBeenLastCalledWith('D:\\other\\B.chd', {
        notes: true,
        images: true,
        linked: true
      })
    )
    await screen.findByText('2 diagrams')
    fireEvent.click(screen.getByText('Save a copy'))
    const choice = await answer
    expect(choice?.path).toBe('D:\\other\\B.chd')
    expect(choice?.options).toEqual({ notes: true, images: true, linked: true })
  })

  it('warns that what is not ticked is removed, and lists what cannot be copied', async () => {
    open(async () =>
      plan({
        removed: [{ owner: 'B.chd', label: 'Payments', path: 'D:\\billing.chd', reason: 'outside' }]
      })
    )
    expect(screen.getByText(/Anything not ticked is removed from the copy/)).toBeTruthy()
    await browse()
    await screen.findByText(/Payments → D:\\billing.chd \(outside\)/)
  })

  it('shows why a copy cannot be made and keeps Save a copy off', async () => {
    open(async () => plan({ problems: ['"B.chd" already exists in that folder.'] }))
    await browse()
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('already exists')
    expect((screen.getByText('Save a copy') as HTMLButtonElement).disabled).toBe(true)
  })

  it('Cancel and Escape answer null', async () => {
    const first = open(async () => plan())
    fireEvent.click(screen.getByText('Cancel'))
    expect(await first.answer).toBeNull()
    cleanup()
    const second = open(async () => plan())
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(await second.answer).toBeNull()
  })
})

describe('where the picker starts', () => {
  it('is beside the diagram, whichever separator the path uses', () => {
    expect(suggestedCopyPath('D:\\work\\A.chd')).toBe('D:\\work\\A copy.chd')
    expect(suggestedCopyPath('/home/me/A.chd')).toBe('/home/me/A copy.chd')
    expect(suggestedCopyPath('A.chd')).toBe('A copy.chd')
  })
})
