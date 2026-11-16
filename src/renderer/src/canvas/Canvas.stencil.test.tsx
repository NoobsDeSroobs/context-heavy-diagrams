import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiagramFile } from '@shared/diagram'
import { renderCanvas } from './canvasHarness'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const stencil = (
  id: string,
  kind: string,
  label: string,
  x: number
): DiagramFile['nodes'][number] => ({
  id,
  type: 'stencil',
  position: { x, y: 0 },
  zIndex: 40,
  data: { label, kind }
})

const flow = (): DiagramFile => ({
  version: 1,
  nodes: [
    stencil('begin', 'start', 'Begin', 0),
    stencil('check', 'decision', 'Approved?', 160),
    {
      ...stencil('work', 'step', 'Do the work', 320),
      size: { width: 140, height: 56 }
    }
  ],
  edges: [{ id: 'e1', source: 'begin', target: 'check' }]
})

const key = (k: string, extra: Record<string, boolean> = {}): void => {
  fireEvent.keyDown(window, { key: k, ctrlKey: true, ...extra })
}

const saved = {
  status: 'saved',
  hubWritten: true,
  hubStamp: '2:2',
  notes: {},
  skippedMoves: [],
  warnings: [],
  conflicts: [],
  remaining: { hub: false, nodeIds: [] }
}

describe('stencils on the canvas (ADR 0180)', () => {
  it('draws each kind with its own shape, and a mark where the kind has one', async () => {
    const { container } = renderCanvas(flow())
    await screen.findByText('Do the work')
    const shape = (kind: string): Element | null =>
      container.querySelector(`.stencil-node[data-stencil-kind="${kind}"]`)
    expect(shape('start')?.className).toContain('stencil-node--circle')
    expect(shape('decision')?.className).toContain('stencil-node--square')
    expect(shape('step')?.className).toContain('stencil-node--pill')
    expect(shape('decision')?.querySelector('.stencil-node-mark')).not.toBeNull()
    expect(shape('step')?.querySelector('.stencil-node-mark')).toBeNull()
  })

  it('adds a step from the palette, saves it with its kind, and undo takes it away', async () => {
    const { api, container } = renderCanvas(flow(), { saveDocument: vi.fn(async () => saved) })
    await screen.findByText('Do the work')
    expect(container.querySelectorAll('.stencil-node')).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'Step' }))
    await waitFor(() => expect(container.querySelectorAll('.stencil-node')).toHaveLength(4))

    key('s')
    await waitFor(() => expect(api.saveDocument).toHaveBeenCalledTimes(1))
    const sent = (api.saveDocument as ReturnType<typeof vi.fn>).mock.calls[0][0].diagram
    const added = sent.nodes[sent.nodes.length - 1]
    expect(added.type).toBe('stencil')
    expect(added.data.kind).toBe('step')
    expect(sent.nodes[1].data.kind).toBe('decision')

    key('z')
    await waitFor(() => expect(container.querySelectorAll('.stencil-node')).toHaveLength(3))
  })

  it('adds the kind chosen in the palette list', async () => {
    const { container } = renderCanvas(flow())
    await screen.findByText('Do the work')
    fireEvent.click(screen.getByRole('button', { name: 'Choose a kind of step or event' }))
    fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: 'gateway' } })
    // The BPMN term finds both gateways, and the list stays in the app's own words.
    const list = within(screen.getByRole('listbox', { name: 'Kinds of step or event' }))
    expect(list.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Decision',
      'Parallel split or join'
    ])
    fireEvent.click(list.getByRole('option', { name: 'Parallel split or join' }))
    await waitFor(() =>
      expect(
        container.querySelectorAll('.stencil-node[data-stencil-kind="parallel"]')
      ).toHaveLength(1)
    )
  })

  it('changes the kind from the property panel, keeping the label a person typed', async () => {
    const { container } = renderCanvas(flow())
    await screen.findByText('Do the work')
    const node = container.querySelector('.react-flow__node[data-id="work"]') as HTMLElement
    fireEvent.click(node)
    const kind = await screen.findByRole('combobox', { name: 'Kind' })
    fireEvent.focus(kind)
    fireEvent.change(kind, { target: { value: 'gate' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Decision' }))
    await waitFor(() =>
      expect(container.querySelector('.stencil-node[data-stencil-kind="decision"]')).not.toBeNull()
    )
    expect(screen.getByText('Do the work')).toBeTruthy()
  })
})
