import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { serializeDiagram, type DiagramFile } from '@shared/diagram'
import { renderCanvas } from './canvasHarness'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const entity = (id: string, label: string, x: number): DiagramFile['nodes'][number] => ({
  id,
  type: 'entity',
  position: { x, y: 0 },
  size: { width: 140, height: 60 },
  zIndex: 40,
  data: { label }
})

const twoEntities = (): DiagramFile => ({
  version: 1,
  nodes: [entity('a', 'Billing', 0), entity('b', 'Ticketing', 300)],
  edges: []
})

const key = (k: string, extra: Record<string, boolean> = {}): void => {
  fireEvent.keyDown(window, { key: k, ctrlKey: true, ...extra })
}
const entityCount = (c: HTMLElement): number => c.querySelectorAll('.entity-node').length

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

describe('adding, undoing and redoing', () => {
  it('adds an entity from the palette, and undo and redo take it away and bring it back', async () => {
    const { container } = renderCanvas(twoEntities())
    await screen.findByText('Billing')
    expect(entityCount(container)).toBe(2)

    fireEvent.click(screen.getByRole('button', { name: 'Entity' }))
    await waitFor(() => expect(entityCount(container)).toBe(3))

    key('z')
    await waitFor(() => expect(entityCount(container)).toBe(2))

    key('z', { shiftKey: true })
    await waitFor(() => expect(entityCount(container)).toBe(3))
  })

  it('treats an added entity as a change to save', async () => {
    const { api, container, requestClose } = renderCanvas(twoEntities())
    await screen.findByText('Billing')
    fireEvent.click(screen.getByRole('button', { name: 'Entity' }))
    await waitFor(() => expect(entityCount(container)).toBe(3))
    await requestClose()
    expect(api.requestCloseDecision).toHaveBeenCalledTimes(1)
  })
})

describe('saving', () => {
  it('writes the loaded diagram plus the new entity, and is clean afterwards', async () => {
    const original = twoEntities()
    const { api, container, requestClose } = renderCanvas(original, {
      saveDocument: vi.fn(async () => saved)
    })
    await screen.findByText('Billing')
    fireEvent.click(screen.getByRole('button', { name: 'Entity' }))
    await waitFor(() => expect(entityCount(container)).toBe(3))

    key('s')
    await waitFor(() => expect(api.saveDocument).toHaveBeenCalledTimes(1))
    const request = (api.saveDocument as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(request.diagramPath).toBe('/demo/test.chd')
    expect(request.writeHub).toBe(true)
    expect(request.diagram.nodes.map((n: { id: string }) => n.id).slice(0, 2)).toEqual(['a', 'b'])
    expect(request.diagram.nodes).toHaveLength(3)
    // The two nodes that were there come back exactly as they were loaded.
    const sent: DiagramFile = { ...request.diagram, nodes: request.diagram.nodes.slice(0, 2) }
    expect(serializeDiagram(sent)).toBe(serializeDiagram(original))

    await waitFor(async () => {
      await requestClose()
      expect(api.closeApproved).toHaveBeenCalled()
    })
    expect(api.requestCloseDecision).not.toHaveBeenCalled()
  })
})

describe('search', () => {
  it('finds an element by label and selects it', async () => {
    const { container } = renderCanvas(twoEntities())
    await screen.findByText('Billing')
    key('f')
    const input = await screen.findByPlaceholderText(/Search labels/)
    fireEvent.change(input, { target: { value: 'ticket' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      const selected = container.querySelectorAll('.react-flow__node.selected')
      expect(selected).toHaveLength(1)
      expect(selected[0].textContent).toContain('Ticketing')
    })
  })
})

describe('deleting', () => {
  it('removes the selected entity with Delete, and undo brings it back', async () => {
    const { container } = renderCanvas(twoEntities())
    await screen.findByText('Billing')
    fireEvent.click(container.querySelector('.react-flow__node') as Element)
    await waitFor(() =>
      expect(container.querySelectorAll('.react-flow__node.selected')).toHaveLength(1)
    )

    fireEvent.keyDown(document.body, { key: 'Delete' })
    await waitFor(() => expect(entityCount(container)).toBe(1))

    key('z')
    await waitFor(() => expect(entityCount(container)).toBe(2))
  })
})

describe('copy style', () => {
  it('applies the copied style to the next entity that is clicked', async () => {
    const diagram = twoEntities()
    diagram.nodes[0].style = { strokeWidth: 7 }
    const { container } = renderCanvas(diagram)
    await screen.findByText('Billing')
    const nodes = container.querySelectorAll('.react-flow__node')
    fireEvent.click(nodes[0])
    await waitFor(() =>
      expect(container.querySelectorAll('.react-flow__node.selected')).toHaveLength(1)
    )

    key('c', { shiftKey: true })
    await waitFor(() => expect(container.querySelector('.style-brush-active')).not.toBeNull())
    fireEvent.click(nodes[1])

    await waitFor(() => {
      const target = nodes[1].querySelector('.entity-node') as HTMLElement
      expect(target.style.borderWidth).toBe('7px')
    })
  })
})
