import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiagramFile } from '@shared/diagram'
import { renderCanvas } from './canvasHarness'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const entity = (
  id: string,
  label: string,
  x: number,
  visibilitySetIds?: string[]
): DiagramFile['nodes'][number] => ({
  id,
  type: 'entity',
  position: { x, y: 0 },
  size: { width: 120, height: 60 },
  zIndex: 40,
  ...(visibilitySetIds ? { visibilitySetIds } : {}),
  data: { label }
})

// Today and Proposed are sets; Base is in none. The story shows today, then lets proposed replace it.
const diagram = (): DiagramFile => ({
  version: 1,
  visibilitySets: [
    { id: 'today', name: 'Today' },
    { id: 'proposed', name: 'Proposed' }
  ],
  stories: [
    {
      id: 's1',
      name: 'Integration',
      steps: [{ show: ['today'] }, { hide: ['today'], show: ['proposed'] }]
    }
  ],
  nodes: [
    entity('a', 'Alpha', 0, ['today']),
    entity('b', 'Beta', 200, ['proposed']),
    entity('c', 'Base', 400)
  ],
  edges: []
})

const openPanel = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Stories' }))
}

describe('stories on the canvas (ADR 0195)', () => {
  it('shows the state of the step picked in the editor', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    // Start: the sets the story names are hidden
    fireEvent.click(await screen.findByRole('button', { name: /Start/ }))
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    expect(screen.queryByText('Beta')).toBeNull()
    expect(screen.getByText('Base')).toBeTruthy()
    // Step 1 shows today; step 2 swaps it for proposed
    fireEvent.click(screen.getByRole('button', { name: /^1\s*Show Today/ }))
    await screen.findByText('Alpha')
    expect(screen.queryByText('Beta')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^2\s*Hide Today/ }))
    await screen.findByText('Beta')
    expect(screen.queryByText('Alpha')).toBeNull()
  })

  it('presents the story from step 0, with the keys, and puts the sets back when it ends', async () => {
    const { container } = renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    fireEvent.click(await screen.findByRole('button', { name: /Present/ }))
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    expect(container.querySelector('.app-shell')?.classList.contains('is-presenting')).toBe(true)
    expect(screen.getByRole('toolbar', { name: 'Presenter' }).textContent).toContain('0 / 2')

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await screen.findByText('Alpha')
    expect(screen.getByRole('toolbar', { name: 'Presenter' }).textContent).toContain('1 / 2')
    fireEvent.keyDown(window, { key: ' ' })
    await screen.findByText('Beta')
    expect(screen.queryByText('Alpha')).toBeNull()
    // past the end stays on the last step, and back is a replay
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('toolbar', { name: 'Presenter' }).textContent).toContain('2 / 2')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await screen.findByText('Alpha')
    expect(screen.queryByText('Beta')).toBeNull()

    // leaving puts back what was hidden before: nothing
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('toolbar', { name: 'Presenter' })).toBeNull())
    await screen.findByText('Beta')
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(container.querySelector('.app-shell')?.classList.contains('is-presenting')).toBe(false)
  })

  it('runs no editor shortcut while presenting', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    fireEvent.click(await screen.findByRole('button', { name: /Present/ }))
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    // select all would select what is shown, and the dock would then show its properties
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    expect(document.querySelector('.react-flow__node.selected')).toBeNull()
  })

  it('makes a story and steps from the sets', async () => {
    const empty = diagram()
    empty.stories = undefined
    renderCanvas(empty)
    await screen.findByText('Alpha')
    openPanel()
    fireEvent.change(await screen.findByRole('textbox', { name: 'New story name' }), {
      target: { value: 'Walk through' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add story' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Make steps from the sets' }))
    await screen.findByRole('button', { name: /^1\s*Show Today/ })
    expect(screen.getByRole('button', { name: /^2\s*Show Proposed/ })).toBeTruthy()
  })

  it('refuses a second story with the same name, ignoring case', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    fireEvent.change(await screen.findByRole('textbox', { name: 'New story name' }), {
      target: { value: 'integration' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add story' }))
    expect((await screen.findByRole('alert')).textContent).toContain('already exists')
  })
})
