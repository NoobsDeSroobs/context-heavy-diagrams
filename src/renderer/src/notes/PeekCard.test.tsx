import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { MetadataEntry } from '@shared/diagram'
import type { IconRef, IconSlot } from '@shared/icons/schema'
import PeekCard from './PeekCard'

afterEach(cleanup)

const target = { nodeId: 'n', rect: { left: 10, top: 10, right: 100, bottom: 60 } }

function card(
  icons: Partial<Record<IconSlot, IconRef>> | undefined,
  metadata?: Record<string, MetadataEntry>,
  required: string[] = []
): void {
  render(
    <PeekCard
      target={target}
      label="Payments"
      notesPath={undefined}
      linkedPath={undefined}
      metadata={metadata}
      requiredTagKeys={new Set(required)}
      icons={icons}
      diagramPath={null}
      shadowContent={undefined}
    />
  )
}

// Each group as its name and its items.
function groups(): [string | null, (string | null)[]][] {
  return [...document.querySelectorAll('.peek-card-tags')].map((g) => [
    g.querySelector('.peek-card-group-label')?.textContent ?? null,
    [...g.querySelectorAll('.peek-card-tag')].map((c) => c.textContent)
  ])
}

describe('the Ctrl-hover card', () => {
  it('names the icons of an element that has nothing else to show', () => {
    card({
      topRight: { source: 'custom', path: 'assets/icons/lock.svg' },
      topLeft: { source: 'builtin', id: 'server' }
    })
    expect(groups()).toEqual([['Icons', ['top left: server', 'top right: lock.svg']]])
  })

  it('keeps required tags, free tags and icons in groups of their own', () => {
    card(
      { topLeft: { source: 'builtin', id: 'user' } },
      { GDPR: { value: 'PII' }, env: { value: 'prod' } },
      ['GDPR']
    )
    expect(groups()).toEqual([
      ['Required tags', ['GDPR: PII']],
      ['Tags', ['env: prod']],
      ['Icons', ['top left: user']]
    ])
    expect(document.querySelector('.peek-card-tag-required')?.textContent).toBe('GDPR: PII')
    expect(document.querySelector('.peek-card-tag-tag')?.textContent).toBe('env: prod')
    expect(document.querySelector('.peek-card-tag-icon')?.textContent).toBe('top left: user')
  })

  it('shows no card for an element with no icons, tags, note or link', () => {
    card(undefined)
    expect(document.querySelector('.peek-card')).toBeNull()
    expect(screen.queryByText('Payments')).toBeNull()
  })
})
