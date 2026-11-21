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
      steps: [
        { actions: [{ action: 'show', set: 'today' }] },
        {
          actions: [
            { action: 'hide', set: 'today' },
            { action: 'show', set: 'proposed' }
          ]
        }
      ]
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
    // what is hidden fades out first, so it goes a moment later
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    // past the end stays on the last step, and back is a replay
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('toolbar', { name: 'Presenter' }).textContent).toContain('2 / 2')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await screen.findByText('Alpha')
    await waitFor(() => expect(screen.queryByText('Beta')).toBeNull())

    // leaving with the panel open leaves the editor on the step the presenter ended on (step 1)
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('toolbar', { name: 'Presenter' })).toBeNull())
    await screen.findByText('Alpha')
    expect(screen.queryByText('Beta')).toBeNull()
    expect(container.querySelector('.app-shell')?.classList.contains('is-presenting')).toBe(false)
    // and closing the panel puts back what was hidden before: nothing
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await screen.findByText('Beta')
    expect(screen.getByText('Alpha')).toBeTruthy()
  })

  it('previews a step only while the panel is open', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    expect(screen.getByText('Beta')).toBeTruthy()
    // opening the panel previews the step it is on (Start)
    openPanel()
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    fireEvent.click(await screen.findByRole('button', { name: /^2s*Hide Today/ }))
    await screen.findByText('Beta')
    expect(screen.queryByText('Alpha')).toBeNull()
    // closing it shows everything again
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await screen.findByText('Alpha')
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.getByText('Base')).toBeTruthy()
    // opening it again previews the same step
    openPanel()
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    expect(screen.getByText('Beta')).toBeTruthy()
  })

  it('offers All sets apart from the sets, and hides every set with it', async () => {
    const blank = diagram()
    blank.stories = [
      {
        id: 's1',
        name: 'Blank start',
        steps: [
          {
            actions: [
              { action: 'hide', set: '*' },
              { action: 'show', set: 'today' }
            ]
          }
        ]
      }
    ]
    renderCanvas(blank)
    await screen.findByText('Alpha')
    openPanel()
    // the story names all sets, so before step 1 every set is hidden
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    expect(screen.queryByText('Beta')).toBeNull()
    expect(screen.getByText('Base')).toBeTruthy()
    // step 1: hide all sets, then show Today
    fireEvent.click(await screen.findByRole('button', { name: /^1s*Hide All sets · Show Today/ }))
    await screen.findByText('Alpha')
    expect(screen.queryByText('Beta')).toBeNull()
    // the meta choice comes first in the list of sets, in its own colour and above a line
    const sets = screen.getAllByRole('combobox', { name: 'Set' })[0] as HTMLSelectElement
    expect([...sets.options].map((o) => o.textContent)).toEqual([
      'All sets',
      '──────────',
      'Today',
      'Proposed'
    ])
    expect(sets.options[0].classList.contains('stories-option-meta')).toBe(true)
    expect(sets.options[1].disabled).toBe(true)
    expect(sets.selectedOptions[0].textContent).toBe('All sets')
  })

  it('keeps "Make steps from the sets" at the bottom of the panel, below the scrolling part', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    const make = await screen.findByRole('button', { name: 'Make steps from the sets' })
    expect(make.closest('.stories-panel-footer')).not.toBeNull()
    expect(make.closest('.stories-panel-body')).toBeNull()
  })

  it('fades what appears and what disappears between steps, in the presenter only', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    // picking a step in the editor is immediate: nothing is fading
    fireEvent.click(await screen.findByRole('button', { name: /^1\s*Show Today/ }))
    await screen.findByText('Alpha')
    await waitFor(() => expect(screen.queryByText('Beta')).toBeNull())
    expect(document.querySelector('.story-fading-in, .story-fading-out')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Present/ }))
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    const alpha = (await screen.findByText('Alpha')).closest('.react-flow__node')
    expect(alpha?.classList.contains('story-fading-in')).toBe(true)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    // Alpha is hidden by this step, but still drawn while it fades out, and Beta fades in
    const leaving = screen.getByText('Alpha').closest('.react-flow__node')
    expect(leaving?.classList.contains('story-fading-out')).toBe(true)
    expect(
      (await screen.findByText('Beta'))
        .closest('.react-flow__node')
        ?.classList.contains('story-fading-in')
    ).toBe(true)
    // then the fade is over: Alpha is gone and nothing is left fading
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    await waitFor(() =>
      expect(document.querySelector('.story-fading-in, .story-fading-out')).toBeNull()
    )
    expect(screen.getByText('Beta')).toBeTruthy()
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

  it('adds a step with no actions, then an action, and changes it with the two choices', async () => {
    const empty = diagram()
    empty.stories = undefined
    renderCanvas(empty)
    await screen.findByText('Alpha')
    openPanel()
    fireEvent.change(await screen.findByRole('textbox', { name: 'New story name' }), {
      target: { value: 'Mine' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add story' }))
    fireEvent.click(await screen.findByRole('button', { name: '+ Step' }))
    // a new step starts empty
    expect(await screen.findByText('No actions yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '+ Add action' }))
    // the first set not named yet, shown
    const action = (await screen.findByRole('combobox', { name: 'Action' })) as HTMLSelectElement
    const set = screen.getByRole('combobox', { name: 'Set' }) as HTMLSelectElement
    expect(action.value).toBe('show')
    expect(set.selectedOptions[0].textContent).toBe('Today')
    // the story names only Today, so Proposed is not part of it and stays shown
    await screen.findByText('Alpha')
    expect(screen.getByText('Beta')).toBeTruthy()
    fireEvent.change(set, { target: { value: 'proposed' } })
    // now it names Proposed: hidden before the step, and the step shows it
    await screen.findByText('Beta')
    // hiding it instead
    fireEvent.change(action, { target: { value: 'hide' } })
    await waitFor(() => expect(screen.queryByText('Beta')).toBeNull())
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^1s*Hide Proposed/ })).toBeTruthy()
  })

  it('reorders and removes the actions of a step, and the last action wins', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    fireEvent.click(await screen.findByRole('button', { name: /^2s*Hide Today/ }))
    // Hide Today, Show Proposed: Alpha is hidden, Beta shown
    await screen.findByText('Beta')
    expect(screen.queryByText('Alpha')).toBeNull()
    // move the Hide Today below Show Proposed: nothing changes, since they are about different sets
    fireEvent.click(screen.getAllByRole('button', { name: 'Move the action down' })[0])
    expect(screen.getByRole('button', { name: /^2s*Show Proposed · Hide Today/ })).toBeTruthy()
    // remove the Hide Today: Alpha is shown again, since step 1 showed it
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove the action' })[1])
    await screen.findByText('Alpha')
    expect(screen.getByRole('button', { name: /^2s*Show Proposed/ })).toBeTruthy()
  })

  it('says in a tooltip which sets are shown after a step', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    const step = await screen.findByRole('button', { name: /^1s*Show Today/ })
    expect(step.getAttribute('title')).toBe('Shown: Today. Hidden: Proposed')
    expect(step.textContent).toContain('1/2')
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
