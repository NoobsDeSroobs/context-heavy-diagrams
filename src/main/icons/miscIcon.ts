import { mkdir, readdir, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import {
  MAX_ICON_SOURCE_LENGTH,
  PACK_FILE,
  SUBSET_FILE,
  defaultSubsetFile,
  isPlainName
} from '@shared/icons/pack'
import type { AddIconResult } from '@shared/icons/installedPacks'
import { packFoldersByName } from './packStore'

// Adding one icon at a time (ADR 0188): the file the person chooses goes into the pack named
// `Misc icons`, in its subset `Icons`, both made the first time. The pack is the home of icons that
// belong to no vendor's set.

export const MISC_PACK = 'Misc icons'
export const MISC_SUBSET = 'Icons'

const MISC_PACK_FILE = {
  name: MISC_PACK,
  description: 'Icons added one at a time, outside any set.',
  ifMissing:
    'Add the icons this diagram uses to a pack named "Misc icons" (the icon pack manager shows where packs live), or pick other icons.',
  version: ''
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// The SVG text of a chosen file. A pack holds SVG only, so a PNG is written into one as a picture
// of its own size; the cleaner keeps a raster picture written into a file.
export function iconSvgFromFile(
  fileName: string,
  bytes: Buffer
): { ok: true; svg: string } | { ok: false; message: string } {
  const kind = extname(fileName).toLowerCase()
  let svg: string
  if (kind === '.png') {
    // The size is in the first chunk: width and height as 32-bit numbers after the signature.
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
      return { ok: false, message: `${fileName} is not a PNG picture.` }
    }
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    if (width === 0 || height === 0) return { ok: false, message: `${fileName} has no size.` }
    svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">` +
      `<image width="${width}" height="${height}" href="data:image/png;base64,${bytes.toString('base64')}"/></svg>\n`
  } else if (kind === '.svg') {
    svg = bytes.toString('utf-8')
    if (!/<svg[\s>]/i.test(svg)) return { ok: false, message: `${fileName} holds no SVG.` }
  } else {
    return { ok: false, message: `${fileName} is not an SVG or PNG file.` }
  }
  if (svg.length > MAX_ICON_SOURCE_LENGTH) {
    return { ok: false, message: `${fileName} is larger than an icon may be (1 MB).` }
  }
  return { ok: true, svg }
}

// A file name every system accepts, from the name of the chosen file.
function iconFileStem(fileName: string): string {
  const stem = basename(fileName, extname(fileName))
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/, '')
    .trim()
  return isPlainName(`${stem}.svg`) ? stem : `icon${stem ? `-${stem}` : ''}`
}

// Writes the icon into the Misc icons pack, making the pack and its subset when they are not there,
// and says what a diagram stores to refer to it. An existing file is never replaced: a taken name
// (also one that differs only in capitals, which is one file on Windows) gets a number.
export async function addMiscIcon(
  root: string,
  fileName: string,
  svg: string
): Promise<AddIconResult> {
  try {
    await mkdir(root, { recursive: true })
    let folder = (await packFoldersByName(root)).get(MISC_PACK)
    if (folder === undefined) {
      const taken = new Set((await readdir(root)).map((name) => name.toLowerCase()))
      folder = MISC_PACK
      for (let n = 2; taken.has(folder.toLowerCase()); n += 1) folder = `${MISC_PACK} ${n}`
      await mkdir(join(root, folder))
      await writeFile(
        join(root, folder, PACK_FILE),
        `${JSON.stringify(MISC_PACK_FILE, null, 2)}\n`,
        'utf-8'
      )
    }
    const subset = join(root, folder, MISC_SUBSET)
    const subsetIsNew = !(await readdir(subset).then(
      () => true,
      () => false
    ))
    await mkdir(subset, { recursive: true })
    if (subsetIsNew) {
      await writeFile(join(subset, SUBSET_FILE), defaultSubsetFile(MISC_SUBSET), 'utf-8')
    }
    const existing = new Set((await readdir(subset)).map((name) => name.toLowerCase()))
    const stem = iconFileStem(fileName)
    let name = `${stem}.svg`
    for (let n = 1; existing.has(name.toLowerCase()); n += 1) name = `${stem}-${n}.svg`
    await writeFile(join(subset, name), svg, { encoding: 'utf-8', flag: 'wx' })
    return { status: 'added', pack: MISC_PACK, path: `${MISC_SUBSET}/${name}` }
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
}
