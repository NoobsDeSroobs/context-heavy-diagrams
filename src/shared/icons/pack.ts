// The format of an installed icon pack: a folder of subset folders of SVG files, with an optional
// metadata file at each of the two levels (ADR 0188; docs/icon-packs.md is the public description,
// keep it in step). This module only reads and writes the text of those files and checks the paths
// in a diagram's references; the main process does the file work.

export const PACK_FILE = 'pack.json'
export const SUBSET_FILE = 'subset.json'
export const ICON_EXTENSION = '.svg'

// A real vendor icon is a few tens of kilobytes; a file of more than this is not an icon and is
// neither installed nor drawn.
export const MAX_ICON_SOURCE_LENGTH = 1_000_000

// A name is shown in the manager and the picker, and a pack's name is what a diagram refers to.
const MAX_NAME_LENGTH = 100
const MAX_TEXT_LENGTH = 1000
const MAX_VERSION_LENGTH = 50

export interface PackMeta {
  name: string
  description: string
  // What a person should do when a diagram needs this pack and it is not installed.
  ifMissing: string
  version: string
}

export interface SubsetMeta {
  name: string
  description: string
}

export interface Parsed<T> {
  meta: T
  // What in the file was not used, for the manager to show. Never a reason to refuse the pack.
  problems: string[]
}

// Control characters would end up in a menu, a message or an id.
function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  return text === '' ? undefined : text.slice(0, max)
}

function readObject(
  text: string | undefined,
  file: string,
  problems: string[]
): Record<string, unknown> {
  if (text === undefined) return {}
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
    problems.push(`${file} is not an object`)
  } catch {
    problems.push(`${file} is not valid JSON`)
  }
  return {}
}

function field(
  source: Record<string, unknown>,
  key: string,
  max: number,
  file: string,
  problems: string[]
): string | undefined {
  if (source[key] === undefined) return undefined
  const text = cleanText(source[key], max)
  if (text === undefined && source[key] !== '') problems.push(`${file}: "${key}" is not text`)
  return text
}

// The metadata of a pack from the text of its pack.json (undefined if it has none). A missing or
// unusable file is not an error: the pack is named after its folder.
export function readPackMeta(text: string | undefined, folder: string): Parsed<PackMeta> {
  const problems: string[] = []
  const source = readObject(text, PACK_FILE, problems)
  return {
    meta: {
      name: field(source, 'name', MAX_NAME_LENGTH, PACK_FILE, problems) ?? folder,
      description: field(source, 'description', MAX_TEXT_LENGTH, PACK_FILE, problems) ?? '',
      ifMissing: field(source, 'ifMissing', MAX_TEXT_LENGTH, PACK_FILE, problems) ?? '',
      version: field(source, 'version', MAX_VERSION_LENGTH, PACK_FILE, problems) ?? ''
    },
    problems
  }
}

export function readSubsetMeta(text: string | undefined, folder: string): Parsed<SubsetMeta> {
  const problems: string[] = []
  const source = readObject(text, SUBSET_FILE, problems)
  return {
    meta: {
      name: field(source, 'name', MAX_NAME_LENGTH, SUBSET_FILE, problems) ?? folder,
      description: field(source, 'description', MAX_TEXT_LENGTH, SUBSET_FILE, problems) ?? ''
    },
    problems
  }
}

// The files the install writes for a pack or subset that came without them: every field there, so
// the person sees what can be filled in. An empty text means the same as no field.
export function defaultPackFile(folder: string): string {
  const meta = { name: folder, description: '', ifMissing: '', version: '' }
  return `${JSON.stringify(meta, null, 2)}\n`
}

export function defaultSubsetFile(folder: string): string {
  return `${JSON.stringify({ name: folder, description: '' }, null, 2)}\n`
}

export function isIconFileName(name: string): boolean {
  return name.toLowerCase().endsWith(ICON_EXTENSION) && name.length > ICON_EXTENSION.length
}

// The path of an icon in a diagram's reference: `<Subset>/<icon>.svg`, the two folder and file
// names with `/` between. It is untrusted (ADR 0115), so this is the first gate: exactly two plain
// names, no `.` or `..`, no other separator, drive or control character. The file read from it is
// still checked to lie inside the pack's folder.
export function splitIconPath(path: unknown): { subset: string; file: string } | null {
  if (typeof path !== 'string') return null
  const parts = path.split('/')
  if (parts.length !== 2) return null
  const [subset, file] = parts
  if (!isPlainName(subset) || !isPlainName(file)) return null
  return isIconFileName(file) ? { subset, file } : null
}

// A folder or file name that means the same on Linux and Windows and cannot leave its folder: not
// empty, `.` or `..`, no separator, drive or control character, no trailing dot or space, and no
// Windows device name (`CON.svg` opens the device there).
export function isPlainName(name: string): boolean {
  if (name === '' || name === '.' || name === '..') return false
  // eslint-disable-next-line no-control-regex
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(name)) return false
  return !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(name) && !/[. ]$/.test(name)
}

// What a diagram knows an icon by, for the id prefix and for a message: pack, subset and file.
export function iconPlace(pack: string, path: string): string {
  return `${pack}/${path}`
}
