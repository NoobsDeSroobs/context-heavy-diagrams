import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installPack, listPacks, readPackIcon } from './packStore'
import { stageTablerPack, tablerPackageFolder } from './tablerPack'

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" fill="none"><path d="M0 0h24"/></svg>'

let base = ''
const quiet = { onProgress: (): void => {}, isCancelled: (): boolean => false }

function fakePackage(): string {
  const folder = join(base, 'package')
  mkdirSync(join(folder, 'icons', 'outline'), { recursive: true })
  writeFileSync(
    join(folder, 'package.json'),
    JSON.stringify({ name: '@tabler/icons', version: '9.9.9' })
  )
  writeFileSync(join(folder, 'icons', 'outline', 'server.svg'), SVG)
  writeFileSync(join(folder, 'icons', 'outline', 'user.svg'), SVG)
  writeFileSync(join(folder, 'icons', 'outline', 'notes.txt'), 'not an icon')
  return folder
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'chd-tabler-'))
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('the Tabler pack', () => {
  it('is written as a pack named Tabler with an Outline subset and the package version', async () => {
    const staged = await stageTablerPack(fakePackage(), join(base, 'stage'))
    expect(staged).toEqual({ folder: join(base, 'stage', 'Tabler'), version: '9.9.9', icons: 2 })
    const pack = JSON.parse(readFileSync(join(staged.folder, 'pack.json'), 'utf-8'))
    expect(pack).toMatchObject({ name: 'Tabler', version: '9.9.9' })
    expect(pack.ifMissing).not.toBe('')
    expect(
      JSON.parse(readFileSync(join(staged.folder, 'Outline', 'subset.json'), 'utf-8')).name
    ).toBe('Outline')
    expect(existsSync(join(staged.folder, 'Outline', 'server.svg'))).toBe(true)
    expect(existsSync(join(staged.folder, 'Outline', 'notes.txt'))).toBe(false)
  })

  it('installs like any pack, and a built-in icon is then read from it', async () => {
    const staged = await stageTablerPack(fakePackage(), join(base, 'stage'))
    const root = join(base, 'icon-packs')
    const result = await installPack(root, staged.folder, quiet)
    expect(result).toMatchObject({ status: 'installed', name: 'Tabler', added: 2, updated: false })
    const [pack] = await listPacks(root)
    expect(pack.meta).toMatchObject({ name: 'Tabler', version: '9.9.9' })
    expect(pack.subsets.map((s) => [s.folder, s.icons])).toEqual([
      ['Outline', ['server.svg', 'user.svg']]
    ])
    expect(await readPackIcon(root, 'Tabler', 'Outline/server.svg')).toEqual({ ok: true, svg: SVG })
  })

  it('is the package that comes with the app, in the source checkout', async () => {
    const staged = await stageTablerPack(tablerPackageFolder(process.cwd()), join(base, 'stage'))
    expect(staged.icons).toBeGreaterThan(4000)
    expect(staged.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(existsSync(join(staged.folder, 'Outline', 'server.svg'))).toBe(true)
  }, 60_000)
})
