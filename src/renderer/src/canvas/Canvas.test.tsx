import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseDiagram, type DiagramFile } from '@shared/diagram'
import { renderCanvas } from './canvasHarness'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const example = (rel: string): DiagramFile =>
  parseDiagram(readFileSync(resolve('examples', rel), 'utf8'))

// A small diagram whose highlight group already matches its required tag, so loading it changes nothing.
const withHighlights = (): DiagramFile => ({
  version: 1,
  requiredTags: [{ key: 'env', lock: 'lockedEditable', allowedValues: ['dev', 'prod'] }],
  highlights: [
    { key: 'env', value: 'dev', color: '#00aa00' },
    { key: 'env', value: 'prod', color: '#cc0000' },
    { key: 'env', value: null, color: '#999999' }
  ],
  legend: [{ id: 'l1', kind: 'entity', label: 'Systems', color: '#336699' }],
  nodes: [
    {
      id: 'a',
      type: 'entity',
      position: { x: 0, y: 0 },
      size: { width: 140, height: 60 },
      zIndex: 40,
      metadata: { env: { value: 'prod', lock: 'lockedEditable' } },
      data: { label: 'Billing' }
    }
  ],
  edges: []
})

describe('Canvas', () => {
  it('mounts an empty diagram', () => {
    const { container } = renderCanvas()
    expect(container.querySelector('.react-flow')).not.toBeNull()
  })

  it('loads a diagram from its path and shows its elements', async () => {
    renderCanvas(withHighlights())
    expect(await screen.findByText('Billing')).toBeTruthy()
  })
})

describe('closing the window', () => {
  it('closes without asking when nothing was changed', async () => {
    const { api, requestClose } = renderCanvas(example('hello-world.chd'))
    await screen.findAllByText(/./, { selector: '.entity-node-label' })
    await requestClose()
    expect(api.closeApproved).toHaveBeenCalled()
    expect(api.requestCloseDecision).not.toHaveBeenCalled()
  })

  it('does not count opening the legend and the highlights panel, or toggling a highlight, as a change', async () => {
    const { api, requestClose } = renderCanvas(withHighlights())
    await screen.findByText('Billing')
    fireEvent.click(screen.getByLabelText('Show legend'))
    fireEvent.click(screen.getByLabelText('Show highlights'))
    fireEvent.click((await screen.findAllByLabelText('Disabled'))[0])
    await waitFor(() => expect(screen.getAllByLabelText('Enabled').length).toBeGreaterThan(0))
    await requestClose()
    expect(api.requestCloseDecision).not.toHaveBeenCalled()
    expect(api.closeApproved).toHaveBeenCalled()
  })

  it('asks what to do after a real change, here removing a highlight', async () => {
    const { api, requestClose } = renderCanvas(withHighlights())
    await screen.findByText('Billing')
    fireEvent.click(screen.getByLabelText('Show highlights'))
    fireEvent.click((await screen.findAllByLabelText('Remove'))[0])
    await requestClose()
    expect(api.requestCloseDecision).toHaveBeenCalledTimes(1)
    expect(api.closeApproved).not.toHaveBeenCalled()
  })
})

// Whatever the load repairs by itself leaves the file different from what is on disk, so the diagram
// counts as changed and closing it asks to save (ADR 0128).
describe('a diagram the load had to repair', () => {
  const alpha = (extra: Record<string, unknown> = {}): DiagramFile['nodes'][number] =>
    ({
      id: 'a',
      type: 'entity',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 40 },
      zIndex: 40,
      data: { label: 'Alpha' },
      ...extra
    }) as DiagramFile['nodes'][number]
  const plain = (over: Partial<DiagramFile> = {}): DiagramFile => ({
    version: 1,
    nodes: [alpha()],
    edges: [],
    ...over
  })

  const asksToSave = async (d: DiagramFile): Promise<boolean> => {
    const { api, requestClose } = renderCanvas(d)
    await screen.findByText('Alpha')
    await requestClose()
    return (api.requestCloseDecision as ReturnType<typeof vi.fn>).mock.calls.length > 0
  }

  it.each([
    [
      'a container reference that points nowhere',
      () => plain({ nodes: [alpha({ parentId: 'gone' })] })
    ],
    [
      'a security reference to an entity that is gone',
      () =>
        plain({
          security: { threats: [{ id: 't', name: 'T' }], matrixEntityIds: ['a', 'deleted'] }
        })
    ],
    [
      'a required tag value that is not allowed',
      () =>
        plain({
          requiredTags: [
            { key: 'env', lock: 'lockedEditable', allowedValues: ['dev'], defaultValue: 'dev' }
          ],
          nodes: [alpha({ metadata: { env: { value: 'qa', lock: 'lockedEditable' } } })]
        })
    ],
    [
      'an element that lacks a required tag',
      () => plain({ requiredTags: [{ key: 'env', lock: 'lockedEditable', defaultValue: 'dev' }] })
    ],
    [
      'a highlight group that is missing a value its tag allows',
      () =>
        plain({
          requiredTags: [{ key: 'env', lock: 'lockedEditable', allowedValues: ['dev', 'prod'] }],
          highlights: [{ key: 'env', value: 'dev', color: '#00aa00' }],
          nodes: [alpha({ metadata: { env: { value: 'dev', lock: 'lockedEditable' } } })]
        })
    ]
  ])('asks to save after %s', async (_name, make) => {
    expect(await asksToSave(make())).toBe(true)
  })

  it.each([
    ['a zIndex the file leaves out', () => plain({ nodes: [alpha({ zIndex: undefined })] })],
    ['a file written by an older version', () => plain({ savedWith: '0.0.1' })]
  ])('does not ask to save for %s', async (_name, make) => {
    expect(await asksToSave(make())).toBe(false)
  })
})

describe('the example diagrams', () => {
  const root = resolve('examples')
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((f) =>
    f.endsWith('.chd')
  )

  it.each(files)('%s opens without needing to be saved', async (rel) => {
    const d = parseDiagram(readFileSync(`${root}/${rel}`, 'utf8'))
    const label = d.nodes.map((n) => n.data.label).find((l) => l && !l.includes('\n'))
    const { api, requestClose } = renderCanvas(d)
    if (label) await screen.findAllByText(label)
    await requestClose()
    expect(api.requestCloseDecision).not.toHaveBeenCalled()
  })
})
