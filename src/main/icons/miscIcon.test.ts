import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addMiscIcon, iconSvgFromFile, MISC_PACK } from './miscIcon'
import { listPacks, readPackIcon } from './packStore'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24"/></svg>'

function png(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(32)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes)
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}

let root = ''
beforeEach(() => {
  root = join(mkdtempSync(join(tmpdir(), 'chd-misc-')), 'icon-packs')
})
afterEach(() => rmSync(join(root, '..'), { recursive: true, force: true }))

describe('the SVG of a chosen file', () => {
  it('takes an SVG as it is', () => {
    expect(iconSvgFromFile('a.svg', Buffer.from(SVG))).toEqual({ ok: true, svg: SVG })
  })

  it('writes a PNG into an SVG of its own size', () => {
    const result = iconSvgFromFile('logo.PNG', png(40, 20))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.svg).toContain('viewBox="0 0 40 20"')
      expect(result.svg).toContain('href="data:image/png;base64,')
    }
  })

  it('refuses what is not an icon', () => {
    expect(iconSvgFromFile('a.svg', Buffer.from('hello')).ok).toBe(false)
    expect(iconSvgFromFile('a.png', Buffer.from('hello, not a picture at all.')).ok).toBe(false)
    expect(iconSvgFromFile('a.png', png(0, 5)).ok).toBe(false)
    expect(iconSvgFromFile('a.gif', Buffer.from(SVG)).ok).toBe(false)
    expect(iconSvgFromFile('big.svg', Buffer.from(SVG + ' '.repeat(1_000_000))).ok).toBe(false)
  })
})

describe('adding to the Misc icons pack', () => {
  it('makes the pack and the subset the first time, and the icon can be read back', async () => {
    const result = await addMiscIcon(root, 'Cloud.svg', SVG)
    expect(result).toEqual({ status: 'added', pack: MISC_PACK, path: 'Icons/Cloud.svg' })
    const [pack] = await listPacks(root)
    expect(pack.meta.name).toBe(MISC_PACK)
    expect(pack.meta.ifMissing).not.toBe('')
    expect(pack.subsets.map((s) => [s.folder, s.icons])).toEqual([['Icons', ['Cloud.svg']]])
    expect(await readPackIcon(root, pack.folder, 'Icons/Cloud.svg')).toEqual({ ok: true, svg: SVG })
  })

  it('never replaces a file: a taken name, in any capitals, gets a number', async () => {
    await addMiscIcon(root, 'Cloud.svg', SVG)
    const second = await addMiscIcon(root, 'cloud.png', '<svg>2</svg>')
    const third = await addMiscIcon(root, 'CLOUD.svg', '<svg>3</svg>')
    expect(second).toMatchObject({ path: 'Icons/cloud-1.svg' })
    expect(third).toMatchObject({ path: 'Icons/CLOUD-2.svg' })
    expect(readFileSync(join(root, MISC_PACK, 'Icons', 'Cloud.svg'), 'utf-8')).toBe(SVG)
  })

  it('uses the pack that gives the name, whatever its folder is called', async () => {
    mkdirSync(join(root, 'mine'), { recursive: true })
    writeFileSync(join(root, 'mine', 'pack.json'), JSON.stringify({ name: MISC_PACK }))
    const result = await addMiscIcon(root, 'a.svg', SVG)
    expect(result).toMatchObject({ status: 'added' })
    expect(existsSync(join(root, 'mine', 'Icons', 'a.svg'))).toBe(true)
    expect(existsSync(join(root, MISC_PACK))).toBe(false)
  })

  it('does not take over a folder that holds another pack of that name', async () => {
    mkdirSync(join(root, MISC_PACK), { recursive: true })
    writeFileSync(join(root, MISC_PACK, 'pack.json'), JSON.stringify({ name: 'Other' }))
    const result = await addMiscIcon(root, 'a.svg', SVG)
    expect(result).toMatchObject({ status: 'added', pack: MISC_PACK })
    expect(existsSync(join(root, `${MISC_PACK} 2`, 'Icons', 'a.svg'))).toBe(true)
  })

  it('makes a usable name from one that a system would not accept', async () => {
    expect(await addMiscIcon(root, 'CON.svg', SVG)).toMatchObject({ path: 'Icons/icon-CON.svg' })
    expect(await addMiscIcon(root, 'a*b?.svg', SVG)).toMatchObject({ path: 'Icons/a-b-.svg' })
    expect(await addMiscIcon(root, '.svg', SVG)).toMatchObject({ status: 'added' })
  })
})
