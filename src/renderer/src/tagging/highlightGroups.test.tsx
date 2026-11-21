import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Node } from '@xyflow/react'
import type { RequiredTagDefinition } from '@shared/diagram'
import { highlightId } from '@shared/tagging/highlights'
import type { CanvasApi } from '../canvas/canvasApi'
import HighlightsPanel from './HighlightsPanel'
import { useHighlights } from './useHighlights'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// Two elements carrying two values of one free tag, so the key can be a group.
const tagged = (id: string, value: string): Node => ({
  id,
  type: 'entity',
  position: { x: 0, y: 0 },
  data: { label: id, metadata: { Team: { value } } }
})
// the first one also carries an Env tag, so a highlight for it is not dropped by the resync
const withEnv = tagged('a', 'Red')
;(withEnv.data.metadata as Record<string, unknown>).Env = { value: 'prod' }
const nodes = [withEnv, tagged('b', 'Blue')]
const requiredTags: RequiredTagDefinition[] = []

function setup(): ReturnType<typeof renderHook<ReturnType<typeof useHighlights>, unknown>> {
  const markDirty = vi.fn()
  return renderHook(() =>
    useHighlights({ markDirty } as unknown as CanvasApi, nodes, [], requiredTags)
  )
}

describe('removing a highlight group', () => {
  it('takes every highlight of the key and its enabled ids, and leaves other keys alone', () => {
    const { result } = setup()
    act(() => result.current.addOrResyncHighlightGroup('Team'))
    act(() => result.current.addHighlight('Env', 'prod', '#ff0000'))
    expect(result.current.highlights.map((h) => h.key)).toEqual(['Team', 'Team', 'Env'])
    const team = result.current.highlights.filter((h) => h.key === 'Team').map(highlightId)
    act(() => result.current.toggleHighlightGroup([...team, 'Env::"prod"'], true))

    act(() => result.current.removeHighlightGroup('Team'))
    expect(result.current.highlights.map((h) => h.key)).toEqual(['Env'])
    for (const id of team) expect(result.current.enabledHighlightIds.has(id)).toBe(false)
    expect(result.current.enabledHighlightIds.has('Env::"prod"')).toBe(true)
  })

  it('ends the group: the automatic resync never makes it again, "Add group" does', () => {
    const { result, rerender } = setup()
    act(() => result.current.addOrResyncHighlightGroup('Team'))
    expect(result.current.highlights).toHaveLength(2)
    act(() => result.current.removeHighlightGroup('Team'))
    // the values are still in use, but a key with no group is not created by the resync
    rerender()
    rerender()
    expect(result.current.highlights).toEqual([])
    act(() => result.current.addOrResyncHighlightGroup('Team'))
    expect(result.current.highlights.map((h) => h.value).sort()).toEqual(['Blue', 'Red'])
  })

  it('does nothing for a key that has no highlights', () => {
    const { result } = setup()
    const before = result.current.highlights
    act(() => result.current.removeHighlightGroup('Nope'))
    expect(result.current.highlights).toBe(before)
  })
})

describe('the group header', () => {
  const panel = (onRemoveGroup: (key: string) => void): void => {
    render(
      <HighlightsPanel
        highlights={[
          { key: 'Team', value: 'Red', color: '#f00' },
          { key: 'Team', value: 'Blue', color: '#00f' }
        ]}
        enabledIds={new Set()}
        usedTags={[]}
        anchorRect={null}
        onAdd={vi.fn()}
        onUpdateColor={vi.fn()}
        onRemove={vi.fn()}
        onRemoveGroup={onRemoveGroup}
        onToggle={vi.fn()}
        onToggleGroup={vi.fn()}
        onAddOrResyncGroup={vi.fn()}
        onClose={vi.fn()}
      />
    )
  }

  it('has a cross that removes the group once the person confirms', () => {
    const onRemoveGroup = vi.fn()
    const confirmSpy = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmSpy)
    panel(onRemoveGroup)
    fireEvent.click(screen.getByRole('button', { name: 'Remove group Team' }))
    expect(confirmSpy).toHaveBeenCalledWith('Remove the group "Team" and its 2 highlights?')
    expect(onRemoveGroup).toHaveBeenCalledWith('Team')
  })

  it('keeps the group when the person says no', () => {
    const onRemoveGroup = vi.fn()
    vi.stubGlobal('confirm', () => false)
    panel(onRemoveGroup)
    fireEvent.click(screen.getByRole('button', { name: 'Remove group Team' }))
    expect(onRemoveGroup).not.toHaveBeenCalled()
  })
})
