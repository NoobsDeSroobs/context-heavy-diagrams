import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import IconPacksSection from './IconPacksSection'
import type { IconPackProblems, InstalledIconUse } from './iconPackProblems'

afterEach(cleanup)

const use = (ownerId: string, path = 'Core/queue.svg'): InstalledIconUse => ({
  pack: 'Acme',
  path,
  ownerKind: 'node',
  ownerId,
  ownerLabel: `Element ${ownerId}`,
  ownerType: 'entity'
})

const show = (problems: IconPackProblems): { reveal: () => void; open: () => void } => {
  const reveal = vi.fn()
  const open = vi.fn()
  render(<IconPacksSection problems={problems} onRevealNode={reveal} onOpenManager={open} />)
  return { reveal, open }
}

describe('the icon packs part of the diagnostics', () => {
  it('shows nothing when every pack and icon is there', () => {
    const { container } = render(
      <IconPacksSection
        problems={{ missingPacks: [], missingIcons: [] }}
        onRevealNode={() => {}}
        onOpenManager={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("says which pack is missing, with the file's own text, and opens the manager", () => {
    const { open, reveal } = show({
      missingPacks: [
        {
          name: 'Acme',
          note: { name: 'Acme', version: '3', ifMissing: 'Ask the platform team.' },
          uses: [use('a'), use('b')]
        }
      ],
      missingIcons: []
    })
    expect(screen.getByText(/“Acme”.*version 3.*is not installed/)).toBeTruthy()
    expect(screen.getByText(/Ask the platform team\./)).toBeTruthy()
    expect(screen.getByText(/Used by 2 icons/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Icon packs…' }))
    expect(open).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Find one' }))
    expect(reveal).toHaveBeenCalledWith('a')
  })

  it('has a sentence of its own when the file has no text for the pack', () => {
    show({ missingPacks: [{ name: 'Acme', note: undefined, uses: [use('a')] }], missingIcons: [] })
    expect(screen.getByText(/Install the pack from its files/)).toBeTruthy()
    expect(screen.getByText(/Used by 1 icon\./)).toBeTruthy()
  })

  it('lists an icon missing from an installed pack against its element', () => {
    const { reveal } = show({ missingPacks: [], missingIcons: [use('c', 'Core/cache.svg')] })
    expect(screen.getByText(/not in pack “Acme”: Core\/cache\.svg/)).toBeTruthy()
    fireEvent.click(screen.getByTitle('Find this element on the canvas'))
    expect(reveal).toHaveBeenCalledWith('c')
  })
})
