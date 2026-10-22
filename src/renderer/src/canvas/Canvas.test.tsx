import { readFileSync } from 'node:fs'
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

  // Known issue: the automatic highlight resync adds the implicit "None" value to every group of
  // an older file while it renders, and that counts as a change. Opening the example and closing
  // it straight away should not ask to save; flip `fails` to a plain `it` when it is fixed.
  it.fails(
    'does not ask to save a diagram whose highlight groups only needed resyncing',
    async () => {
      const { api, requestClose } = renderCanvas(
        example('gallery/landscape/meridian-rail-landscape.chd')
      )
      await screen.findAllByText(/./, { selector: '.entity-node-label' })
      await requestClose()
      expect(api.requestCloseDecision).not.toHaveBeenCalled()
    }
  )
})
