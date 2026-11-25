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
    stencil('begin', 'event-start', 'Begin', 0),
    stencil('check', 'branch-exclusive', 'Approved?', 160),
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
    expect(shape('event-start')?.className).toContain('stencil-node--circle')
    expect(shape('branch-exclusive')?.className).toContain('stencil-node--square')
    expect(shape('step')?.className).toContain('stencil-node--arrow')
    expect(shape('branch-exclusive')?.querySelector('.stencil-node-mark')).not.toBeNull()
    expect(shape('step')?.querySelector('.stencil-node-mark')).toBeNull()
  })

  it('draws a mark in the slot of a step and a second ring on an event in the middle of a flow', async () => {
    const nodes = [
      stencil('user', 'step-human', 'Review', 0),
      stencil('wait', 'event-timer', 'Wait', 200),
      stencil('plain', 'event', 'Happens', 300)
    ]
    const { container } = renderCanvas({ ...flow(), nodes })
    await screen.findByText('Review')
    const shape = (kind: string): Element | null =>
      container.querySelector(`.stencil-node[data-stencil-kind="${kind}"]`)
    expect(shape('step-human')?.querySelector('.stencil-node-mark--slot')).not.toBeNull()
    expect(shape('event-timer')?.querySelector('.stencil-node-ring')).not.toBeNull()
    expect(shape('event-timer')?.querySelector('.stencil-node-mark--ringed')).not.toBeNull()
    expect(shape('event')?.querySelector('.stencil-node-mark')).toBeNull()
    expect(shape('event')?.querySelector('.stencil-node-ring')).not.toBeNull()
  })

  it('adds a step from the palette, saves it with its kind, and undo takes it away', async () => {
    const { api, container } = renderCanvas(flow(), { saveDocument: vi.fn(async () => saved) })
    await screen.findByText('Do the work')
    expect(container.querySelectorAll('.stencil-node')).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'Behaviour' }))
    await waitFor(() => expect(container.querySelectorAll('.stencil-node')).toHaveLength(4))

    key('s')
    await waitFor(() => expect(api.saveDocument).toHaveBeenCalledTimes(1))
    const sent = (api.saveDocument as ReturnType<typeof vi.fn>).mock.calls[0][0].diagram
    const added = sent.nodes[sent.nodes.length - 1]
    expect(added.type).toBe('stencil')
    expect(added.data.kind).toBe('step')
    expect(sent.nodes[1].data.kind).toBe('branch-exclusive')

    key('z')
    await waitFor(() => expect(container.querySelectorAll('.stencil-node')).toHaveLength(3))
  })

  it('adds the kind chosen in the palette list', async () => {
    const { container } = renderCanvas(flow())
    await screen.findByText('Do the work')
    fireEvent.click(screen.getByRole('button', { name: 'Choose a kind of behaviour' }))
    fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: 'gateway' } })
    // The BPMN term finds all the gateways, and the list stays in the app's own words.
    const list = within(screen.getByRole('listbox', { name: 'Kinds of behaviour' }))
    expect(list.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Decision',
      'Inclusive choice',
      'Run in parallel',
      'Wait for all',
      'Wait for first'
    ])
    fireEvent.click(list.getByRole('option', { name: 'Run in parallel' }))
    await waitFor(() =>
      expect(
        container.querySelectorAll('.stencil-node[data-stencil-kind="branch-parallel"]')
      ).toHaveLength(1)
    )
  })

  it('moves the label of a small shape from the property panel, and a step has no such field', async () => {
    const { container } = renderCanvas(flow())
    await screen.findByText('Do the work')
    const node = (id: string): HTMLElement =>
      container.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement
    expect(node('begin').querySelector('.stencil-node-label-box--below')).not.toBeNull()
    fireEvent.click(node('begin'))
    const position = await screen.findByRole('combobox', { name: 'Label position' })
    fireEvent.focus(position)
    fireEvent.change(position, { target: { value: 'Above' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Above' }))
    await waitFor(() =>
      expect(node('begin').querySelector('.stencil-node-label-box--above')).not.toBeNull()
    )
    fireEvent.click(node('work'))
    await waitFor(() =>
      expect(screen.queryByRole('combobox', { name: 'Label position' })).toBeNull()
    )
  })

  it('says from the property panel whether an event starts a flow, which takes away its second ring; the plain start has no such field', async () => {
    const { container } = renderCanvas({
      version: 1,
      nodes: [
        stencil('begin', 'event-start', 'Begin', 0),
        stencil('wait', 'event-timer', 'Wait', 160),
        stencil('done', 'event-end', 'Done', 320)
      ],
      edges: []
    })
    await screen.findByText('Wait')
    const node = (id: string): HTMLElement =>
      container.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement
    expect(node('wait').querySelector('.stencil-node-ring')).not.toBeNull()
    fireEvent.click(node('wait'))
    const position = await screen.findByRole('combobox', { name: 'Position' })
    fireEvent.focus(position)
    fireEvent.change(position, { target: { value: 'Starts' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Starts a flow' }))
    await waitFor(() => expect(node('wait').querySelector('.stencil-node-ring')).toBeNull())
    fireEvent.click(node('begin'))
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Position' })).toBeNull())
    fireEvent.click(node('done'))
    expect(await screen.findByRole('combobox', { name: 'Outcome' })).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: 'Position' })).toBeNull()
  })

  it('moves the label of a container to another side from the property panel', async () => {
    const lane = {
      id: 'lane',
      type: 'container',
      position: { x: 0, y: 100 },
      size: { width: 400, height: 200 },
      data: { label: 'Sales' }
    }
    const { container } = renderCanvas({ version: 1, nodes: [lane], edges: [] } as DiagramFile)
    await screen.findByText('Sales')
    const node = container.querySelector('.react-flow__node[data-id="lane"]') as HTMLElement
    expect(node.querySelector('.container-node-label-box--top-start')).not.toBeNull()
    fireEvent.click(node)
    const side = await screen.findByRole('combobox', { name: 'Label side' })
    fireEvent.focus(side)
    fireEvent.change(side, { target: { value: 'Left' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Left' }))
    await waitFor(() =>
      expect(node.querySelector('.container-node-label-box--left-start')).not.toBeNull()
    )
  })

  // The same request opens the label of an edge, but edges are not drawn in this test environment.
  it('opens the label of a behaviour on a double-click, written or not', async () => {
    const { container } = renderCanvas({
      version: 1,
      nodes: [
        stencil('begin', 'event-start', 'Begin', 0),
        stencil('check', 'branch-exclusive', '', 160)
      ],
      edges: []
    })
    await screen.findByText('Begin')
    const editor = (within: string): Promise<HTMLTextAreaElement> =>
      waitFor(() => {
        const field = container.querySelector(`${within} textarea`)
        expect(field).not.toBeNull()
        return field as HTMLTextAreaElement
      })
    // an empty label has nothing to hit, so the shape itself takes the double-click
    fireEvent.doubleClick(container.querySelector('.react-flow__node[data-id="check"]') as Element)
    const field = await editor('.react-flow__node[data-id="check"]')
    fireEvent.change(field, { target: { value: 'Approved?' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    await screen.findByText('Approved?')
    // a double-click on the open editor is the editor's own and leaves it as it is
    fireEvent.doubleClick(container.querySelector('.react-flow__node[data-id="begin"]') as Element)
    const begin = await editor('.react-flow__node[data-id="begin"]')
    fireEvent.change(begin, { target: { value: 'Start here' } })
    fireEvent.doubleClick(begin)
    expect((await editor('.react-flow__node[data-id="begin"]')).value).toBe('Start here')
  })

  it('copies a selected behaviour with Ctrl+C', async () => {
    const copyToClipboard = vi.fn()
    const { container } = renderCanvas(flow(), { copyToClipboard })
    await screen.findByText('Do the work')
    for (const id of ['check', 'work']) {
      fireEvent.click(container.querySelector(`.react-flow__node[data-id="${id}"]`) as Element)
      key('c')
      const payload = JSON.parse(copyToClipboard.mock.calls.at(-1)?.[0] as string)
      expect(payload.nodes.map((n: { id: string }) => n.id)).toEqual([id])
    }
  })

  it('still copies and pastes a behaviour after its label was opened with a double-click', async () => {
    let clipboard = ''
    const { container } = renderCanvas(flow(), {
      copyToClipboard: vi.fn((text: string) => {
        clipboard = text
      }),
      readClipboardText: vi.fn(() => clipboard)
    })
    await screen.findByText('Do the work')
    const node = container.querySelector('.react-flow__node[data-id="check"]') as Element
    fireEvent.click(node)
    fireEvent.doubleClick(node)
    const field = await waitFor(() => {
      const found = node.querySelector('textarea')
      expect(found).not.toBeNull()
      return found as HTMLTextAreaElement
    })
    fireEvent.change(field, { target: { value: 'Ok?' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    await screen.findByText('Ok?')
    expect(window.getSelection()?.toString()).toBe('')
    fireEvent.click(node)
    key('c')
    key('v')
    await waitFor(() => expect(container.querySelectorAll('.stencil-node')).toHaveLength(4))
  })

  it('pastes a copied behaviour as a new one', async () => {
    let clipboard = ''
    const { container } = renderCanvas(flow(), {
      copyToClipboard: vi.fn((text: string) => {
        clipboard = text
      }),
      readClipboardText: vi.fn(() => clipboard)
    })
    await screen.findByText('Do the work')
    fireEvent.click(container.querySelector('.react-flow__node[data-id="check"]') as Element)
    key('c')
    key('v')
    await waitFor(() => expect(container.querySelectorAll('.stencil-node')).toHaveLength(4))
  })

  it('has no zoom buttons in the corner panel unless asked for, and the legend is its last button', async () => {
    const { container } = renderCanvas(flow())
    await screen.findByText('Do the work')
    const panel = container.querySelector('.react-flow__controls') as HTMLElement
    expect(panel.querySelector('.react-flow__controls-zoomin')).toBeNull()
    expect(panel.querySelector('.react-flow__controls-zoomout')).toBeNull()
    expect(panel.querySelector('.react-flow__controls-interactive')).toBeNull()
    const labels = [...panel.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))
    expect(labels.slice(-3)).toEqual(['Show highlights', 'Mark crossings', 'Show legend'])
  })

  it('turns the crossings switch on from the corner panel', async () => {
    const { container } = renderCanvas(flow())
    await screen.findByText('Do the work')
    const button = screen.getByRole('button', { name: 'Mark crossings' })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(button)
    await waitFor(() => expect(button.getAttribute('aria-pressed')).toBe('true'))
    expect(container.querySelector('.react-flow__controls')).not.toBeNull()
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
      expect(
        container.querySelector('.stencil-node[data-stencil-kind="branch-exclusive"]')
      ).not.toBeNull()
    )
    expect(screen.getByText('Do the work')).toBeTruthy()
  })
})
