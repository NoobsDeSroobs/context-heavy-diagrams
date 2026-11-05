import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LayoutSection, { type LayoutEntry } from './LayoutSection'

const entry: LayoutEntry = {
  edgeId: 'e1',
  label: 'reads from',
  sourceId: 'a',
  targetId: 'b',
  gap: 23.4,
  needed: 74,
  horizontal: true,
  sourceName: 'Client',
  targetName: 'API'
}

describe('LayoutSection', () => {
  it('shows nothing when no label is hidden', () => {
    const { container } = render(<LayoutSection entries={[]} onRevealEdge={() => {}} />)
    expect(container.childElementCount).toBe(0)
  })

  it('names the edge, the room it has and what it needs, and finds it on a click', () => {
    const onRevealEdge = vi.fn()
    render(<LayoutSection entries={[entry]} onRevealEdge={onRevealEdge} />)
    expect(screen.getByText('Layout (1)')).toBeTruthy()
    const row = screen.getByRole('button', { name: /reads from.*Client and API.*23 px.*74 px/ })
    fireEvent.click(row)
    expect(onRevealEdge).toHaveBeenCalledWith(entry)
  })
})
