import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiagramFile } from '@shared/diagram'
import { renderCanvas } from './canvasHarness'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const diagram = (marked?: string): DiagramFile => ({
  version: 1,
  legend: [
    {
      id: 'data',
      kind: 'line',
      label: 'Data flow',
      color: '#4a90d9',
      lineStyle: 'solid',
      endMarker: 'arrowClosed',
      ...(marked === 'data' ? { forNewEdges: true } : {})
    },
    {
      id: 'event',
      kind: 'line',
      label: 'Event',
      lineStyle: 'dashed',
      ...(marked === 'event' ? { forNewEdges: true } : {})
    },
    { id: 'dot', kind: 'entity', label: 'GDPR', color: '#e6194b' }
  ],
  nodes: [
    {
      id: 'a',
      type: 'entity',
      position: { x: 0, y: 0 },
      size: { width: 120, height: 60 },
      zIndex: 40,
      data: { label: 'Alpha' }
    }
  ],
  edges: []
})

const swatch = (): HTMLElement =>
  screen.getByRole('button', { name: 'Default style for newly drawn edges' })

describe('the line new edges are drawn with (ADR 0196)', () => {
  it('lists the diagram lines first, marks the one picked, and says so on the button', async () => {
    renderCanvas(diagram())
    await screen.findByText('Alpha')
    expect(swatch().getAttribute('title')).toBe('Default style for newly drawn edges')
    fireEvent.click(swatch())
    expect(await screen.findByText('Lines of this diagram')).toBeTruthy()
    // only lines are offered, not the entity entry, and the presets come after them
    expect(screen.getByRole('button', { name: 'Data flow' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Event' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /GDPR/ })).toBeNull()
    expect(screen.getByText('Presets, for every diagram')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Data flow' }))
    await waitFor(() =>
      expect(swatch().getAttribute('title')).toBe(
        'New edges are drawn as "Data flow" (this diagram\'s legend)'
      )
    )
    // the picker shows it ticked, and picking it again stops using it
    fireEvent.click(swatch())
    const ticked = await screen.findByRole('button', { name: /Data flow/ })
    expect(ticked.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(ticked)
    await waitFor(() =>
      expect(swatch().getAttribute('title')).toBe('Default style for newly drawn edges')
    )
  })

  it('moves the mark to another line, and a preset takes it away', async () => {
    renderCanvas(diagram('data'))
    await screen.findByText('Alpha')
    await waitFor(() => expect(swatch().getAttribute('title')).toContain('"Data flow"'))
    fireEvent.click(swatch())
    fireEvent.click(await screen.findByRole('button', { name: 'Event' }))
    await waitFor(() => expect(swatch().getAttribute('title')).toContain('"Event"'))
    // a preset is the personal default now, so no line of the diagram is the look of new edges
    fireEvent.click(swatch())
    const presets = await screen.findAllByRole('button', { name: /arrow/i })
    fireEvent.click(presets[0])
    await waitFor(() =>
      expect(swatch().getAttribute('title')).toBe('Default style for newly drawn edges')
    )
  })

  it('offers only the presets when the diagram has no line', async () => {
    const plain = diagram()
    plain.legend = [{ id: 'dot', kind: 'entity', label: 'GDPR', color: '#e6194b' }]
    renderCanvas(plain)
    await screen.findByText('Alpha')
    fireEvent.click(swatch())
    await screen.findByPlaceholderText('Search line styles…')
    expect(screen.queryByText('Lines of this diagram')).toBeNull()
  })
})
