import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFERENCES, normalizePreferences } from '@shared/preferences/preferences'
import PreferencesPanel from './PreferencesPanel'

// The panel's font list and metamodels folder read from the diagram context and the bridge, which
// are not what is tested here.
vi.mock('../styling/useFontOptions', () => ({ useFontOptions: () => [] }))
vi.mock('../conformance/MetamodelsFolderSection', () => ({ default: () => null }))

afterEach(cleanup)

function hoverCardBoxes(prefs: Parameters<typeof PreferencesPanel>[0]['preferences']): string[] {
  const { container } = render(
    <PreferencesPanel preferences={prefs} onChange={vi.fn()} onClose={vi.fn()} />
  )
  const row = [...container.querySelectorAll('.property-field')].find((r) =>
    r.textContent?.startsWith('Hover card')
  )
  return [...(row?.querySelectorAll('input') ?? [])].map((input) => input.value)
}

describe('the hover card size row', () => {
  it('shows the defaults, also for stored preferences written before the fields existed', () => {
    expect(hoverCardBoxes(DEFAULT_PREFERENCES)).toEqual(['340', '260'])
    cleanup()
    expect(hoverCardBoxes(normalizePreferences({ minZoom: 0.2 }))).toEqual(['340', '260'])
  })

  it('has the width and the height on one row', () => {
    const { container } = render(
      <PreferencesPanel preferences={DEFAULT_PREFERENCES} onChange={vi.fn()} onClose={vi.fn()} />
    )
    const rows = [...container.querySelectorAll('.property-field')].filter((r) =>
      r.textContent?.includes('Hover card')
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Width')
    expect(rows[0].textContent).toContain('Height')
  })
})
