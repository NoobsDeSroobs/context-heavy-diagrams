import { cleanup, fireEvent, render } from '@testing-library/react'
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

describe('the beta features group', () => {
  const beta = [
    {
      id: 'loops',
      label: 'Loop kinds',
      description: 'Steps that say how they repeat.',
      reviewBy: '2027-03-01'
    }
  ]

  it('is left out when the release has no beta', () => {
    const { container } = render(
      <PreferencesPanel preferences={DEFAULT_PREFERENCES} onChange={vi.fn()} onClose={vi.fn()} />
    )
    expect(container.querySelector('#beta-features')).toBeNull()
  })

  it('lists each beta, marked beta and off until switched on', () => {
    const { container } = render(
      <PreferencesPanel
        preferences={normalizePreferences({})}
        betaFeatures={beta}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const group = container.querySelector('#beta-features')
    expect(group?.textContent).toContain('Loop kinds (beta)')
    expect(group?.textContent).toContain('Reviewed by 2027-03-01')
    expect(group?.querySelector('input')?.checked).toBe(false)
  })

  it('switches a beta on by writing its flag, keeping the others', () => {
    const onChange = vi.fn()
    const { container } = render(
      <PreferencesPanel
        preferences={{ ...DEFAULT_PREFERENCES, features: { other: true } }}
        betaFeatures={beta}
        onChange={onChange}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(container.querySelector('#beta-features input') as HTMLInputElement)
    expect(onChange).toHaveBeenCalledWith({ features: { other: true, loops: true } })
  })
})
