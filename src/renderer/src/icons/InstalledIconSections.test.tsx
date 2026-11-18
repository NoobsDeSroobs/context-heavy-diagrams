import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PackList, PackSummary } from '@shared/icons/installedPacks'
import InstalledIconSections from './InstalledIconSections'
import { matchingIcons, usablePacks } from './installedIconSearch'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8z"/></svg>'

function pack(
  name: string,
  subsets: Record<string, string[]>,
  extra: Partial<PackSummary> = {}
): PackSummary {
  return {
    folder: name,
    meta: { name, description: '', ifMissing: '', version: '' },
    subsets: Object.entries(subsets).map(([folder, icons]) => ({
      folder,
      meta: { name: folder, description: '' },
      iconCount: icons.length,
      icons
    })),
    iconCount: Object.values(subsets).flat().length,
    duplicateOf: null,
    problems: [],
    ...extra
  }
}

const many = Array.from({ length: 70 }, (_, i) => `Icon${String(i).padStart(2, '0')}.svg`)
const AWS = pack('AWS', { Compute: ['EC2.svg', 'Lambda.svg'], Storage: ['S3.svg'], Many: many })

describe('which icons the search shows', () => {
  const storage = AWS.subsets[1]
  it('shows everything without a query, and the icons whose name has it with one', () => {
    expect(matchingIcons(AWS, AWS.subsets[0], '')).toEqual(['EC2.svg', 'Lambda.svg'])
    expect(matchingIcons(AWS, AWS.subsets[0], ' LAM ')).toEqual(['Lambda.svg'])
    expect(matchingIcons(AWS, AWS.subsets[0], 'zzz')).toEqual([])
  })
  it('shows the whole subset or pack that is named', () => {
    expect(matchingIcons(AWS, storage, 'stor')).toEqual(['S3.svg'])
    expect(matchingIcons(AWS, AWS.subsets[0], 'aws')).toEqual(['EC2.svg', 'Lambda.svg'])
  })
  it('leaves out a second folder that gives a pack the same name', () => {
    const copy = pack('AWS', {}, { duplicateOf: 'AWS' })
    expect(usablePacks([AWS, copy])).toEqual([AWS])
  })
})

let list: PackList
const open = vi.fn()

beforeEach(() => {
  list = { folder: '/packs', packs: [AWS] }
  open.mockReset()
  ;(window as unknown as { api: object }).api = {
    listIconPacks: () => Promise.resolve(list),
    onIconPacksChanged: () => () => {},
    openIconPackManager: open,
    readInstalledIcon: () => Promise.resolve({ ok: true, svg: SVG })
  }
})
afterEach(cleanup)

const headers = (): string[] =>
  screen.queryAllByRole('button', { expanded: false }).map((b) => b.textContent ?? '')

describe('the installed packs in the icon browser', () => {
  it('shows a closed section per pack, and opens a pack and then a subset', async () => {
    render(<InstalledIconSections query="" onPick={() => {}} />)
    const pack = await screen.findByRole('button', { name: /AWS/ })
    expect(pack.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(pack)
    const compute = screen.getByRole('button', { name: /Compute/ })
    expect(headers().some((h) => h.includes('Compute'))).toBe(true)
    expect(document.querySelector('.icon-browser-grid')).toBeNull()
    fireEvent.click(compute)
    expect(document.querySelectorAll('.icon-browser-grid button')).toHaveLength(2)
  })

  it('picks the icon with the pack name and the path a diagram stores', async () => {
    const onPick = vi.fn()
    render(<InstalledIconSections query="" onPick={onPick} />)
    fireEvent.click(await screen.findByRole('button', { name: /AWS/ }))
    fireEvent.click(screen.getByRole('button', { name: /Compute/ }))
    fireEvent.click(screen.getByTitle('Lambda'))
    expect(onPick).toHaveBeenCalledWith({
      source: 'installed',
      pack: 'AWS',
      path: 'Compute/Lambda.svg'
    })
  })

  it('opens what matches a search and hides what does not', async () => {
    render(<InstalledIconSections query="s3" onPick={() => {}} />)
    await screen.findByRole('button', { name: /AWS/ })
    expect(screen.getByRole('button', { name: /Storage/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Compute/ })).toBeNull()
    expect(screen.getByTitle('S3')).toBeTruthy()
  })

  it('draws a window onto a long subset and the rest on request', async () => {
    render(<InstalledIconSections query="" onPick={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: /AWS/ }))
    fireEvent.click(screen.getByRole('button', { name: /Many/ }))
    expect(document.querySelectorAll('.icon-browser-grid button')).toHaveLength(60)
    fireEvent.click(screen.getByRole('button', { name: 'Show all 70' }))
    expect(document.querySelectorAll('.icon-browser-grid button')).toHaveLength(70)
  })

  it('draws the icons it shows from the pack', async () => {
    render(<InstalledIconSections query="ec2" onPick={() => {}} />)
    await waitFor(() => expect(document.querySelector('.icon-browser-grid svg')).not.toBeNull())
  })

  it('offers the manager, and says when there is nothing installed', async () => {
    list = { folder: '/packs', packs: [] }
    render(<InstalledIconSections query="" onPick={() => {}} />)
    const button = await screen.findByRole('button', { name: 'Install an icon pack…' })
    fireEvent.click(button)
    expect(open).toHaveBeenCalledOnce()
  })
})
