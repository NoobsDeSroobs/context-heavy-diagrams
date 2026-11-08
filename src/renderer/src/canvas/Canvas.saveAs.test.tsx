import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiagramFile } from '@shared/diagram'
import type { SaveDocumentRequest } from '@shared/document/documentSave'
import type { SaveAsPlan } from '@shared/document/saveAsCopy'
import { renderCanvas } from './canvasHarness'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// One element with a note, an image and a link, in a diagram saved as /demo/test.chd.
const diagram = (): DiagramFile => ({
  version: 1,
  nodes: [
    {
      id: 'a',
      type: 'entity',
      position: { x: 0, y: 0 },
      size: { width: 140, height: 60 },
      zIndex: 40,
      data: {
        label: 'Billing',
        notes: 'test/notes/Billing-a.md',
        linkedDiagram: 'child.chd',
        references: ['test/assets/references/p.png']
      }
    }
  ],
  edges: []
})

const plan: SaveAsPlan = {
  assets: [
    { kind: 'copy', from: 'test/assets/references/p.png', to: 'copy/assets/references/p.png' },
    { kind: 'write', to: 'copy/child.chd', content: '{}' }
  ],
  rootRefs: {
    a: { linkedDiagram: 'copy/child.chd', references: ['copy/assets/references/p.png'] }
  },
  counts: { notes: 1, images: 1, linked: 1 },
  removed: [],
  problems: []
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

// The bridge stand-in answers every property, `then` included, so it must not be returned from an
// async function (the await would wait on it forever): it comes back in a wrapper.
async function openSaveAs(): Promise<{ api: ReturnType<typeof renderCanvas>['api'] }> {
  const planSaveAs = vi.fn(async () => plan)
  const { api } = renderCanvas(diagram(), {
    saveDocument: vi.fn(async () => saved),
    pickSavePath: vi.fn(async () => '/other/copy.chd'),
    planSaveAs
  })
  await screen.findByText('Billing')
  fireEvent.keyDown(window, { key: 's', ctrlKey: true, shiftKey: true })
  fireEvent.click(await screen.findByText('Browse…'))
  await waitFor(() => expect(planSaveAs).toHaveBeenCalled())
  await screen.findByText('1 note')
  return { api }
}

const sentRequest = (api: Record<string, unknown>): SaveDocumentRequest =>
  (api.saveDocument as ReturnType<typeof vi.fn>).mock.calls[0][0]

describe('Save As', () => {
  it('asks for the path and what to copy, and sends the plan with the save', async () => {
    const { api } = await openSaveAs()
    // The plan is made for the real diagram: its path and what the window holds.
    const call = (api.planSaveAs as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.currentPath).toBe('/demo/test.chd')
    expect(call.newPath).toBe('/other/copy.chd')
    expect(call.nodes[0].data).toMatchObject({ notes: 'test/notes/Billing-a.md' })

    fireEvent.click(screen.getByText('Save a copy'))
    await waitFor(() => expect(api.saveDocument).toHaveBeenCalledTimes(1))
    const request = sentRequest(api)
    expect(request.diagramPath).toBe('/other/copy.chd')
    expect(request.previousDiagramPath).toBe('/demo/test.chd')
    expect(request.assets).toEqual(plan.assets)
    // The diagram refers to the copies, and the note goes with it under the new name.
    expect(request.diagram.nodes[0].data).toMatchObject({
      linkedDiagram: 'copy/child.chd',
      references: ['copy/assets/references/p.png']
    })
    expect(request.ops).toEqual([
      { kind: 'copy', nodeId: 'a', from: 'test/notes/Billing-a.md', to: 'copy/notes/Billing-a.md' }
    ])
    await waitFor(() => expect(document.title).toContain('copy.chd'))
  })

  it('leaves the notes out of the copy when they are not ticked', async () => {
    const { api } = await openSaveAs()
    fireEvent.click(screen.getByLabelText(/^Notes/))
    await waitFor(() => expect(api.planSaveAs).toHaveBeenCalledTimes(2))
    await screen.findByText('1 note removed')
    fireEvent.click(screen.getByText('Save a copy'))
    await waitFor(() => expect(api.saveDocument).toHaveBeenCalledTimes(1))
    const request = sentRequest(api)
    expect(request.ops).toEqual([])
    expect(request.diagram.nodes[0].data.notes).toBeUndefined()
  })

  it('saves nothing when it is cancelled', async () => {
    const { api } = await openSaveAs()
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.queryByText('Save a copy')).toBeNull())
    expect(api.saveDocument).not.toHaveBeenCalled()
  })
})
