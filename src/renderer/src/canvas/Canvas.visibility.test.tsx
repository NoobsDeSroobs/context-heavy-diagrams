import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
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

const diagram = (): DiagramFile => ({
  version: 1,
  visibilitySets: [{ id: 'today', name: 'Today' }],
  nodes: [entity('a', 'Alpha', 0, ['today']), entity('b', 'Beta', 200), entity('c', 'Gamma', 400)],
  edges: [{ id: 'e1', source: 'a', target: 'b' }]
})

const openPanel = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Show visibility sets' }))
}

describe('visibility sets on the canvas (ADR 0194)', () => {
  it('shows everything when a diagram opens, and hides a set with its checkbox', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Today' }))
    // Alpha is in the hidden set; the elements in no set stay
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.getByText('Gamma')).toBeTruthy()
    // and it comes back
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Today' }))
    await screen.findByText('Alpha')
  })

  it('makes a set, puts the selected element in it, and hides it with the set', async () => {
    renderCanvas(diagram())
    await screen.findByText('Gamma')
    fireEvent.click(screen.getByText('Gamma').closest('.react-flow__node') as Element)
    openPanel()
    fireEvent.change(screen.getByRole('textbox', { name: 'New set name' }), {
      target: { value: 'Proposed' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add the selection to Proposed' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Proposed' }))
    await waitFor(() => expect(screen.queryByText('Gamma')).toBeNull())
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.getByText('Alpha')).toBeTruthy()
  })

  it('does not select what is hidden, with select all', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Today' }))
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    fireEvent.change(screen.getByRole('textbox', { name: 'New set name' }), {
      target: { value: 'Everything shown' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add the selection to Everything shown' })
    )
    // Beta, Gamma and the edge between Alpha and Beta have no set, so they are shown and selected;
    // Alpha is hidden, so select all did not reach it
    fireEvent.click(screen.getByRole('button', { name: 'Show what is in Everything shown' }))
    const list = screen.getByRole('list', { name: 'In Everything shown' })
    const labels = within(list)
      .getAllByTitle('Select it')
      .map((el) => el.textContent)
    expect(labels).toHaveLength(3)
    // (the edge is listed by the elements it joins, Alpha among them, so only elements are checked)
    expect(labels.filter((label) => label?.startsWith('Element')).join(' ')).not.toContain('Alpha')
  })

  it('lists what is in a set, and takes one element out of it', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    expect(screen.queryByRole('list', { name: 'In Today' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show what is in Today' }))
    const list = screen.getByRole('list', { name: 'In Today' })
    expect(within(list).getByTitle('Select it').textContent).toContain('Alpha')
    fireEvent.click(screen.getByRole('button', { name: 'Take Alpha out of Today' }))
    // Alpha stays on the canvas, now in no set
    expect(within(list).queryByTitle('Select it')).toBeNull()
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(document.querySelector('.visibility-set-count')?.textContent).toBe('today')
  })

  it('has Add and Remove buttons for the selection', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    const add = screen.getByRole('button', { name: 'Add the selection to Today' })
    const remove = screen.getByRole('button', { name: 'Remove the selection from Today' })
    expect(add.textContent).toBe('Add')
    expect(remove.textContent).toBe('Remove')
  })

  it('cannot put anything in a set with nothing selected', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    openPanel()
    const add = screen.getByRole('button', { name: 'Add the selection to Today' })
    expect((add as HTMLButtonElement).disabled).toBe(true)
  })
})
