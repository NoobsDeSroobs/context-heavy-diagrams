import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { IconRef, IconSlot } from '@shared/icons/schema'
import PeekCard from './PeekCard'

afterEach(cleanup)

const target = { nodeId: 'n', rect: { left: 10, top: 10, right: 100, bottom: 60 } }

function card(icons: Partial<Record<IconSlot, IconRef>> | undefined): void {
  render(
    <PeekCard
      target={target}
      label="Payments"
      notesPath={undefined}
      linkedPath={undefined}
      metadata={undefined}
      icons={icons}
      diagramPath={null}
      shadowContent={undefined}
    />
  )
}

describe('the Ctrl-hover card', () => {
  it('names the icons of an element that has nothing else to show', () => {
    card({
      topRight: { source: 'custom', path: 'assets/icons/lock.svg' },
      topLeft: { source: 'builtin', id: 'server' }
    })
    const tags = [...document.querySelectorAll('.peek-card-tag')].map((t) => t.textContent)
    expect(tags).toEqual(['top left: server', 'top right: lock.svg'])
  })

  it('shows no card for an element with no icons, tags, note or link', () => {
    card(undefined)
    expect(document.querySelector('.peek-card')).toBeNull()
    expect(screen.queryByText('Payments')).toBeNull()
  })
})
