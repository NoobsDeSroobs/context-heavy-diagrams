import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InstalledIconResult } from '@shared/icons/installedPacks'
import IconSlotView from './IconSlotView'

const SHAPE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0h24"/></svg>'
const VENDOR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g"><stop stop-color="#f90"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><script>alert(1)</script></svg>'

let changed: () => void = () => {}
const readInstalledIcon = vi.fn<(pack: string, path: string) => Promise<InstalledIconResult>>()

beforeEach(() => {
  readInstalledIcon.mockReset()
  ;(window as unknown as { api: object }).api = {
    readInstalledIcon,
    onIconPacksChanged: (callback: () => void) => {
      changed = callback
      return () => {}
    }
  }
})
afterEach(cleanup)

const installed = (pack: string, path: string): React.JSX.Element => (
  <IconSlotView icon={{ source: 'installed', pack, path }} diagramPath={null} className="slot" />
)

describe('an installed icon', () => {
  it('is drawn inline from the pack, keeping currentColor so it follows the text colour', async () => {
    readInstalledIcon.mockResolvedValue({ ok: true, svg: SHAPE })
    const { container } = render(installed('Tabler', 'Outline/server.svg'))
    await waitFor(() => expect(container.querySelector('span.slot svg')).not.toBeNull())
    expect(container.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor')
    expect(container.querySelector('img')).toBeNull()
    expect(readInstalledIcon).toHaveBeenCalledWith('Tabler', 'Outline/server.svg')
  })

  it('is cleaned, and its ids are its own in every drawing', async () => {
    readInstalledIcon.mockResolvedValue({ ok: true, svg: VENDOR })
    const { container } = render(
      <>
        {installed('AWS', 'Compute/EC2.svg')}
        {installed('AWS', 'Compute/EC2.svg')}
      </>
    )
    await waitFor(() => expect(container.querySelectorAll('svg').length).toBe(2))
    expect(container.querySelector('script')).toBeNull()
    const [a, b] = [...container.querySelectorAll('linearGradient')].map((g) => g.id)
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
    for (const svg of container.querySelectorAll('svg')) {
      const id = svg.querySelector('linearGradient')?.id
      expect(svg.querySelector('rect')?.getAttribute('fill')).toBe(`url(#${id})`)
    }
    expect(readInstalledIcon).toHaveBeenCalledTimes(1)
  })

  it('leaves an empty slot that says which pack is missing', async () => {
    readInstalledIcon.mockResolvedValue({ ok: false, reason: 'no-pack' })
    const { container } = render(installed('Gone', 'Compute/EC2.svg'))
    await waitFor(() =>
      expect(container.querySelector('span.slot')?.getAttribute('title')).toContain('"Gone"')
    )
    expect(container.querySelector('svg')).toBeNull()
  })

  it('says which icon is missing from an installed pack, and does not draw an unusable file', async () => {
    readInstalledIcon.mockResolvedValue({ ok: false, reason: 'no-icon' })
    const first = render(installed('AWS', 'Compute/Gone.svg'))
    await waitFor(() =>
      expect(first.container.querySelector('span.slot')?.getAttribute('title')).toContain(
        'Compute/Gone.svg'
      )
    )
    cleanup()
    readInstalledIcon.mockResolvedValue({ ok: true, svg: 'not an svg' })
    const second = render(installed('AWS', 'Compute/Bad.svg'))
    await waitFor(() => expect(readInstalledIcon).toHaveBeenCalledTimes(2))
    expect(second.container.querySelector('svg')).toBeNull()
  })

  it('draws a built-in icon from the installed Tabler pack, and says when that is not installed', async () => {
    readInstalledIcon.mockResolvedValue({ ok: true, svg: SHAPE })
    const first = render(
      <IconSlotView
        icon={{ source: 'builtin', id: 'server-rack' }}
        diagramPath={null}
        className="slot"
      />
    )
    await waitFor(() => expect(first.container.querySelector('span.slot svg')).not.toBeNull())
    expect(readInstalledIcon).toHaveBeenCalledWith('Tabler', 'Outline/server-rack.svg')
    cleanup()
    readInstalledIcon.mockResolvedValue({ ok: false, reason: 'no-pack' })
    const second = render(
      <IconSlotView
        icon={{ source: 'builtin', id: 'database' }}
        diagramPath={null}
        className="slot"
      />
    )
    await waitFor(() =>
      expect(second.container.querySelector('span.slot')?.getAttribute('title')).toContain(
        '"Tabler"'
      )
    )
  })

  it('is read again when the packs change', async () => {
    readInstalledIcon.mockResolvedValueOnce({ ok: false, reason: 'no-pack' })
    const { container } = render(installed('New', 'Set/a.svg'))
    await waitFor(() =>
      expect(container.querySelector('span.slot')?.getAttribute('title')).toBeTruthy()
    )
    readInstalledIcon.mockResolvedValue({ ok: true, svg: SHAPE })
    act(() => changed())
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull())
    expect(readInstalledIcon).toHaveBeenCalledTimes(2)
  })
})
