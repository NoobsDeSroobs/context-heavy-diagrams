import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installPack, listPacks, packFoldersByName, readPackIcon, removePack } from './packStore'
import type { InstallProgress } from '@shared/icons/installedPacks'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8z"/></svg>'

let base = ''
let root = ''
let work = ''

function put(folder: string, files: Record<string, string>): string {
  const path = join(work, folder)
  for (const [name, text] of Object.entries(files)) {
    const file = join(path, ...name.split('/'))
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, text)
  }
  return path
}

const quiet = { onProgress: (): void => {}, isCancelled: (): boolean => false }
const tree = (folder: string): string[] => {
  const out: string[] = []
  const walk = (path: string, prefix: string): void => {
    for (const e of readdirSync(path, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(path, e.name), `${prefix}${e.name}/`)
      else out.push(`${prefix}${e.name}`)
    }
  }
  walk(folder, '')
  return out.sort()
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'chd-packs-'))
  root = join(base, 'icon-packs')
  work = join(base, 'source')
  mkdirSync(work)
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('listPacks', () => {
  it('finds nothing in a folder that is not there', async () => {
    expect(await listPacks(root)).toEqual([])
  })

  it('names a pack after its folder, counts its icons and skips hidden folders', async () => {
    mkdirSync(root)
    for (const [name, text] of [
      ['AWS/Compute/EC2.svg', SVG],
      ['AWS/Compute/Lambda.svg', SVG],
      ['AWS/Compute/notes.txt', 'x'],
      ['AWS/Storage/S3.svg', SVG],
      ['.removed/Old/A/a.svg', SVG]
    ]) {
      const file = join(root, ...name.split('/'))
      mkdirSync(join(file, '..'), { recursive: true })
      writeFileSync(file, text)
    }
    const [pack, ...rest] = await listPacks(root)
    expect(rest).toEqual([])
    expect(pack.meta.name).toBe('AWS')
    expect(pack.iconCount).toBe(3)
    expect(pack.subsets.map((s) => [s.folder, s.iconCount])).toEqual([
      ['Compute', 2],
      ['Storage', 1]
    ])
  })

  it('reports a second folder with the same name and a metadata file that cannot be used', async () => {
    mkdirSync(join(root, 'a'), { recursive: true })
    mkdirSync(join(root, 'b'))
    writeFileSync(join(root, 'a', 'pack.json'), '{"name":"Same"}')
    writeFileSync(join(root, 'b', 'pack.json'), '{"name":"Same"')
    const [a, b] = await listPacks(root)
    expect(a.duplicateOf).toBeNull()
    expect(b.meta.name).toBe('b')
    const c = join(root, 'c')
    mkdirSync(c)
    writeFileSync(join(c, 'pack.json'), '{"name":"Same"}')
    const third = (await listPacks(root))[2]
    expect(third.duplicateOf).toBe('a')
    expect(b.problems).toHaveLength(1)
  })
})

describe('installPack', () => {
  it('installs a pack and writes the metadata files it came without', async () => {
    const source = put('Vendor', {
      'Compute/EC2.svg': SVG,
      'Compute/Lambda.svg': SVG,
      'Storage/S3.svg': SVG,
      'Storage/subset.json': '{"name":"Storage services"}'
    })
    const steps: InstallProgress[] = []
    const result = await installPack(root, source, {
      ...quiet,
      onProgress: (p) => steps.push(p)
    })
    expect(result).toEqual({
      status: 'installed',
      folder: 'Vendor',
      name: 'Vendor',
      updated: false,
      added: 3,
      skipped: []
    })
    expect(tree(join(root, 'Vendor'))).toEqual([
      'Compute/EC2.svg',
      'Compute/Lambda.svg',
      'Compute/subset.json',
      'Storage/S3.svg',
      'Storage/subset.json',
      'pack.json'
    ])
    expect(JSON.parse(readFileSync(join(root, 'Vendor', 'pack.json'), 'utf-8'))).toEqual({
      name: 'Vendor',
      description: '',
      ifMissing: '',
      version: ''
    })
    expect(readFileSync(join(root, 'Vendor', 'Storage', 'subset.json'), 'utf-8')).toContain(
      'Storage services'
    )
    expect(steps[0].phase).toBe('reading')
    expect(steps.at(-1)).toEqual({ phase: 'finishing', done: 6, total: 6 })
    expect(readdirSync(root)).toEqual(['Vendor'])
    const [listed] = await listPacks(root)
    expect(listed.iconCount).toBe(3)
  })

  it('adds to an installed pack of the same name and keeps its edited metadata', async () => {
    await installPack(root, put('Vendor', { 'Compute/EC2.svg': SVG }), quiet)
    writeFileSync(
      join(root, 'Vendor', 'pack.json'),
      JSON.stringify({ name: 'Vendor', ifMissing: 'Ask the team.' })
    )
    const next = put('vendor-2025', {
      'pack.json': '{"name":"Vendor","version":"2025"}',
      'Compute/EC2.svg': `${SVG}<!-- new -->`,
      'Compute/Lambda.svg': SVG
    })
    const result = await installPack(root, next, quiet)
    expect(result).toMatchObject({ status: 'installed', folder: 'Vendor', updated: true, added: 2 })
    expect(readdirSync(root)).toEqual(['Vendor'])
    expect(readFileSync(join(root, 'Vendor', 'pack.json'), 'utf-8')).toContain('Ask the team.')
    expect(readFileSync(join(root, 'Vendor', 'Compute', 'EC2.svg'), 'utf-8')).toContain('new')
    expect(tree(join(root, 'Vendor'))).toContain('Compute/Lambda.svg')
  })

  it('says what it left out', async () => {
    const source = put('Mixed', {
      'loose.svg': SVG,
      'Compute/EC2.svg': SVG,
      'Compute/Deeper/Lambda.svg': SVG,
      'Compute/Huge.svg': `<svg>${' '.repeat(1_000_001)}</svg>`
    })
    const result = await installPack(root, source, quiet)
    expect(result).toMatchObject({ status: 'installed', added: 1 })
    if (result.status !== 'installed') return
    expect(result.skipped).toHaveLength(3)
    expect(tree(join(root, 'Mixed'))).toEqual([
      'Compute/EC2.svg',
      'Compute/subset.json',
      'pack.json'
    ])
  })

  it('refuses a folder with no icons in subfolders', async () => {
    const result = await installPack(root, put('Flat', { 'a.svg': SVG }), quiet)
    expect(result.status).toBe('failed')
    expect(await listPacks(root)).toEqual([])
  })

  it('refuses the packs folder and what is in it', async () => {
    await installPack(root, put('Vendor', { 'Compute/EC2.svg': SVG }), quiet)
    for (const source of [root, join(root, 'Vendor')]) {
      expect((await installPack(root, source, quiet)).status).toBe('failed')
    }
  })

  it('does not overwrite a folder that holds another pack', async () => {
    await installPack(root, put('Vendor', { 'Compute/EC2.svg': SVG }), quiet)
    writeFileSync(join(root, 'Vendor', 'pack.json'), '{"name":"Renamed"}')
    const result = await installPack(root, put('Vendor-copy', { 'A/a.svg': SVG }), quiet)
    expect(result.status).toBe('installed')
    const other = put('x/Vendor', { 'A/b.svg': SVG })
    const clash = await installPack(root, other, quiet)
    expect(clash.status).toBe('failed')
    expect(tree(join(root, 'Vendor'))).not.toContain('A/b.svg')
  })

  it('leaves nothing behind when cancelled', async () => {
    const source = put('Vendor', { 'Compute/EC2.svg': SVG, 'Compute/Lambda.svg': SVG })
    let copied = 0
    const result = await installPack(root, source, {
      onProgress: (p) => {
        if (p.phase === 'copying') copied += 1
      },
      isCancelled: () => copied > 1
    })
    expect(result).toEqual({ status: 'cancelled' })
    expect(readdirSync(root)).toEqual([])
  })
})

describe('removePack', () => {
  beforeEach(async () => {
    await installPack(root, put('Vendor', { 'Compute/EC2.svg': SVG }), quiet)
  })

  it('hands the pack to the trash', async () => {
    const trashed: string[] = []
    const result = await removePack(root, 'Vendor', async (path) => {
      trashed.push(path)
    })
    expect(result).toEqual({ ok: true, where: 'trash' })
    expect(trashed).toEqual([join(root, 'Vendor')])
  })

  it('keeps the pack in a hidden folder when there is no trash', async () => {
    const result = await removePack(root, 'Vendor', () => Promise.reject(new Error('no trash')))
    expect(result).toEqual({ ok: true, where: 'kept' })
    expect(await listPacks(root)).toEqual([])
    expect(readdirSync(join(root, '.removed'))[0]).toMatch(/^Vendor-\d+$/)
  })

  it('refuses a name that is not a pack folder', async () => {
    for (const folder of ['..', '.removed', 'a/b', 'Nope', '']) {
      const result = await removePack(root, folder, () => Promise.reject(new Error('x')))
      expect(result.ok, folder).toBe(false)
    }
    expect((await listPacks(root)).length).toBe(1)
  })
})

describe('reading an icon of a pack', () => {
  beforeEach(async () => {
    await installPack(
      root,
      put('Vendor', { 'Compute/EC2.svg': SVG, 'pack.json': '{"name":"The Vendor"}' }),
      quiet
    )
  })

  it('finds a pack by its name, the first folder winning', async () => {
    mkdirSync(join(root, 'A-copy'))
    writeFileSync(join(root, 'A-copy', 'pack.json'), '{"name":"The Vendor"}')
    const byName = await packFoldersByName(root)
    expect(byName.get('The Vendor')).toBe('A-copy')
    expect(byName.get('Vendor')).toBeUndefined()
  })

  it('reads the file of an icon', async () => {
    expect(await readPackIcon(root, 'Vendor', 'Compute/EC2.svg')).toEqual({ ok: true, svg: SVG })
  })

  it('says when the icon is not there', async () => {
    expect(await readPackIcon(root, 'Vendor', 'Compute/Nope.svg')).toEqual({
      ok: false,
      reason: 'no-icon'
    })
    expect(await readPackIcon(root, 'Missing', 'Compute/EC2.svg')).toEqual({
      ok: false,
      reason: 'no-icon'
    })
  })

  it('refuses a path that is not a subset folder and a file', async () => {
    writeFileSync(join(root, 'secret.svg'), SVG)
    for (const path of [
      '../secret.svg',
      'Compute/../../secret.svg',
      '/secret.svg',
      'EC2.svg',
      5,
      undefined
    ]) {
      expect(await readPackIcon(root, 'Vendor', path), String(path)).toEqual({
        ok: false,
        reason: 'refused'
      })
    }
    expect(await readPackIcon(root, '..', 'Compute/EC2.svg')).toEqual({
      ok: false,
      reason: 'refused'
    })
  })

  it('refuses a link that leads out of the pack', async (context) => {
    writeFileSync(join(base, 'outside.svg'), SVG)
    try {
      symlinkSync(join(base, 'outside.svg'), join(root, 'Vendor', 'Compute', 'Link.svg'))
    } catch {
      context.skip() // making a link needs a privilege on Windows
      return
    }
    expect(await readPackIcon(root, 'Vendor', 'Compute/Link.svg')).toEqual({
      ok: false,
      reason: 'refused'
    })
  })

  it('does not read a file over the size limit', async () => {
    writeFileSync(join(root, 'Vendor', 'Compute', 'Huge.svg'), ' '.repeat(1_000_001))
    expect(await readPackIcon(root, 'Vendor', 'Compute/Huge.svg')).toEqual({
      ok: false,
      reason: 'too-large'
    })
  })
})
