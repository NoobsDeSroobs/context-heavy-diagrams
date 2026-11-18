import { randomUUID } from 'crypto'
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile
} from 'fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path'
import {
  MAX_ICON_SOURCE_LENGTH,
  PACK_FILE,
  SUBSET_FILE,
  defaultPackFile,
  defaultSubsetFile,
  isIconFileName,
  isPlainName,
  readPackMeta,
  readSubsetMeta,
  splitIconPath
} from '@shared/icons/pack'
import type {
  InstalledIconResult,
  InstallProgress,
  InstallResult,
  PackSummary,
  RemoveResult,
  SubsetSummary
} from '@shared/icons/installedPacks'

// The packs folder on disk and what the install manager does to it (ADR 0188). It takes the folder
// as an argument and does no Electron call, so it is tested on a temporary folder; the window and
// the dialogs are in packManager.ts.

// Hidden folders of the packs folder: never packs, never listed.
const STAGING_FOLDER = '.staging'
const REMOVED_FOLDER = '.removed'

const isHidden = (name: string): boolean => name.startsWith('.')

async function readText(path: string, problems: string[]): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      problems.push(`${basename(path)} could not be read`)
    }
    return undefined
  }
}

// Folders only: a link is not followed, so a pack cannot point out of its folder.
async function folderNames(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((e) => e.isDirectory() && !isHidden(e.name))
    .map((e) => e.name)
    .sort(compareNames)
}

async function iconNames(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((e) => e.isFile() && isIconFileName(e.name))
    .map((e) => e.name)
    .sort(compareNames)
}

const compareNames = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

export async function listPacks(root: string): Promise<PackSummary[]> {
  const packs: PackSummary[] = []
  const firstWithName = new Map<string, string>()
  for (const folder of await folderNames(root)) {
    const path = join(root, folder)
    const problems: string[] = []
    const { meta, problems: metaProblems } = readPackMeta(
      await readText(join(path, PACK_FILE), problems),
      folder
    )
    problems.push(...metaProblems)
    const subsets: SubsetSummary[] = []
    for (const subset of await folderNames(path)) {
      const subsetPath = join(path, subset)
      const parsed = readSubsetMeta(await readText(join(subsetPath, SUBSET_FILE), problems), subset)
      problems.push(...parsed.problems.map((p) => `${subset}/${p}`))
      subsets.push({
        folder: subset,
        meta: parsed.meta,
        iconCount: (await iconNames(subsetPath)).length
      })
    }
    const duplicateOf = firstWithName.get(meta.name) ?? null
    if (duplicateOf === null) firstWithName.set(meta.name, folder)
    packs.push({
      folder,
      meta,
      subsets,
      iconCount: subsets.reduce((sum, s) => sum + s.iconCount, 0),
      duplicateOf,
      problems
    })
  }
  return packs
}

interface Staged {
  from: string
  // Relative to the pack folder, with `/`.
  to: string
}

interface Scan {
  staged: Staged[]
  // Texts to write where the source has no metadata file.
  generated: { to: string; text: string }[]
  icons: number
  skipped: string[]
  packFile: string | undefined
}

// What of the chosen folder is a pack: subset folders of icons, and the metadata files. Anything
// else is counted and reported, never silently dropped.
async function scanSource(
  source: string,
  folder: string,
  isCancelled: () => boolean
): Promise<Scan> {
  const scan: Scan = {
    staged: [],
    generated: [],
    icons: 0,
    skipped: [],
    packFile: await readFile(join(source, PACK_FILE), 'utf-8').catch(() => undefined)
  }
  if (scan.packFile === undefined)
    scan.generated.push({ to: PACK_FILE, text: defaultPackFile(folder) })
  else scan.staged.push({ from: join(source, PACK_FILE), to: PACK_FILE })

  let tooDeep = 0
  let badName = 0
  let tooLarge = 0
  let clashes = 0
  const entries = await readdir(source, { withFileTypes: true })
  const loose = entries.filter((e) => e.isFile() && isIconFileName(e.name)).length
  const seenSubsets = new Set<string>()
  for (const subset of entries.filter((e) => e.isDirectory() && !isHidden(e.name))) {
    if (isCancelled()) break
    if (!isPlainName(subset.name) || seenSubsets.has(subset.name.toLowerCase())) {
      if (isPlainName(subset.name)) clashes += 1
      else badName += 1
      continue
    }
    seenSubsets.add(subset.name.toLowerCase())
    const subsetPath = join(source, subset.name)
    const inside = await readdir(subsetPath, { withFileTypes: true })
    tooDeep += inside.filter((e) => e.isDirectory() && !isHidden(e.name)).length
    const seen = new Set<string>()
    let count = 0
    for (const file of inside.filter((e) => e.isFile() && isIconFileName(e.name))) {
      if (!isPlainName(file.name)) {
        badName += 1
        continue
      }
      if (seen.has(file.name.toLowerCase())) {
        clashes += 1
        continue
      }
      const { size } = await stat(join(subsetPath, file.name))
      // Characters, not bytes, in the cleaner; bytes are never fewer, so this never lets one through.
      if (size > MAX_ICON_SOURCE_LENGTH) {
        tooLarge += 1
        continue
      }
      seen.add(file.name.toLowerCase())
      scan.staged.push({
        from: join(subsetPath, file.name),
        to: `${subset.name}/${file.name}`
      })
      count += 1
    }
    if (count === 0) continue
    scan.icons += count
    if (inside.some((e) => e.isFile() && e.name === SUBSET_FILE)) {
      scan.staged.push({ from: join(subsetPath, SUBSET_FILE), to: `${subset.name}/${SUBSET_FILE}` })
    } else {
      scan.generated.push({
        to: `${subset.name}/${SUBSET_FILE}`,
        text: defaultSubsetFile(subset.name)
      })
    }
  }
  const say = (n: number, what: string): void => {
    if (n > 0) scan.skipped.push(`${n} ${what}`)
  }
  say(loose, 'icons directly in the pack folder were left out: put them in a subfolder')
  say(tooDeep, 'folders inside a subfolder were left out: a pack is only two folders deep')
  say(badName, 'files or folders with a name that does not work on every system were left out')
  say(clashes, 'names that differ only by capitals were left out')
  say(tooLarge, 'icons of more than 1 MB were left out')
  return scan
}

export interface InstallOptions {
  onProgress: (progress: InstallProgress) => void
  isCancelled: () => boolean
}

// Installs the pack in `source` into `root`. It is copied into a staging folder first, so a cancel
// or a failure leaves the packs as they were. A pack whose name is already installed is added to:
// its icons are replaced by the new files of the same name and its metadata is kept.
export async function installPack(
  root: string,
  source: string,
  { onProgress, isCancelled }: InstallOptions
): Promise<InstallResult> {
  const staging = join(root, STAGING_FOLDER, randomUUID())
  try {
    const here = relative(resolve(root), resolve(source))
    if (here === '' || (!here.startsWith('..') && !isAbsolute(here))) {
      return { status: 'failed', message: 'That folder is already in the icon packs folder.' }
    }
    if (!(await stat(source)).isDirectory()) {
      return { status: 'failed', message: 'That is not a folder.' }
    }
    const folderName = basename(resolve(source))
    onProgress({ phase: 'reading', done: 0, total: 0 })
    const scan = await scanSource(source, folderName, isCancelled)
    if (isCancelled()) return { status: 'cancelled' }
    if (scan.icons === 0) {
      return {
        status: 'failed',
        message:
          'No icons found. A pack is a folder of subfolders, each holding .svg files.' +
          (scan.skipped.length > 0 ? ` (${scan.skipped.join('; ')}.)` : '')
      }
    }
    const { meta } = readPackMeta(scan.packFile, folderName)

    // Which folder it goes into: that of an installed pack of this name, else one named like the
    // source. A folder of that name holding another pack is not overwritten.
    const installed = await listPacks(root)
    const same = installed.find((p) => p.meta.name === meta.name && p.duplicateOf === null)
    const target = same?.folder ?? folderName
    if (!same) {
      if (!isPlainName(folderName)) {
        return {
          status: 'failed',
          message: `The folder name "${folderName}" does not work on every system. Rename the folder and install it again.`
        }
      }
      const clash = installed.find((p) => p.folder.toLowerCase() === folderName.toLowerCase())
      if (clash) {
        return {
          status: 'failed',
          message: `The folder "${clash.folder}" is already in the icon packs folder with another pack name ("${clash.meta.name}"). Give this pack a name in its pack.json, or rename its folder.`
        }
      }
    }

    const total = scan.staged.length + scan.generated.length
    let done = 0
    onProgress({ phase: 'copying', done, total })
    for (const item of scan.staged) {
      if (isCancelled()) return { status: 'cancelled' }
      const to = join(staging, ...item.to.split('/'))
      await mkdir(dirname(to), { recursive: true })
      await copyFile(item.from, to)
      onProgress({ phase: 'copying', done: ++done, total })
    }
    for (const item of scan.generated) {
      const to = join(staging, ...item.to.split('/'))
      await mkdir(dirname(to), { recursive: true })
      await writeFile(to, item.text, 'utf-8')
      onProgress({ phase: 'copying', done: ++done, total })
    }
    if (isCancelled()) return { status: 'cancelled' }

    onProgress({ phase: 'finishing', done: total, total })
    const targetPath = join(root, target)
    if (!same) {
      await rename(staging, targetPath)
    } else {
      for (const item of [...scan.staged.map((s) => s.to), ...scan.generated.map((g) => g.to)]) {
        const destination = join(targetPath, ...item.split('/'))
        const isMeta = item === PACK_FILE || item.endsWith(`/${SUBSET_FILE}`)
        if (
          isMeta &&
          (await stat(destination).then(
            () => true,
            () => false
          ))
        )
          continue
        await mkdir(dirname(destination), { recursive: true })
        await rename(join(staging, ...item.split('/')), destination)
      }
    }
    return {
      status: 'installed',
      folder: target,
      name: same?.meta.name ?? meta.name,
      updated: same !== undefined,
      added: scan.icons,
      skipped: scan.skipped
    }
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) }
  } finally {
    await rm(join(root, STAGING_FOLDER), { recursive: true, force: true }).catch(() => undefined)
  }
}

// Takes a pack out of use. The system's trash first; where there is none (a bare Linux session),
// a hidden folder in the packs folder, so nothing is deleted outright.
export async function removePack(
  root: string,
  folder: string,
  trash: (path: string) => Promise<void>
): Promise<RemoveResult> {
  if (!isPlainName(folder) || isHidden(folder)) return { ok: false, message: 'Not a pack.' }
  const path = join(root, folder)
  if (
    !(await stat(path).then(
      (s) => s.isDirectory(),
      () => false
    ))
  ) {
    return { ok: false, message: 'That pack is no longer there.' }
  }
  try {
    await trash(path)
    return { ok: true, where: 'trash' }
  } catch {
    try {
      const kept = join(root, REMOVED_FOLDER)
      await mkdir(kept, { recursive: true })
      await rename(path, join(kept, `${folder}-${Date.now()}`))
      return { ok: true, where: 'kept' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }
}

// Which folder a pack name means: the first folder, by name, that gives it (a second folder with the
// same name is not used, as in the list). Reads only the small pack.json files.
export async function packFoldersByName(root: string): Promise<Map<string, string>> {
  const byName = new Map<string, string>()
  for (const folder of await folderNames(root)) {
    const { meta } = readPackMeta(await readText(join(root, folder, PACK_FILE), []), folder)
    if (!byName.has(meta.name)) byName.set(meta.name, folder)
  }
  return byName
}

// The text of one icon of a pack. The path comes from a diagram, so it is untrusted (ADR 0115): two
// plain names, and the file that is read must really lie inside the pack's folder, so a link placed
// in a pack cannot point out of it.
export async function readPackIcon(
  root: string,
  folder: string,
  path: unknown
): Promise<InstalledIconResult> {
  const parts = splitIconPath(path)
  if (!parts || !isPlainName(folder)) return { ok: false, reason: 'refused' }
  try {
    const file = join(root, folder, parts.subset, parts.file)
    const real = await realpath(file)
    const inside = relative(await realpath(join(root, folder)), real)
    if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
      return { ok: false, reason: 'refused' }
    }
    const info = await stat(real)
    if (!info.isFile()) return { ok: false, reason: 'no-icon' }
    if (info.size > MAX_ICON_SOURCE_LENGTH) return { ok: false, reason: 'too-large' }
    return { ok: true, svg: await readFile(real, 'utf-8') }
  } catch {
    return { ok: false, reason: 'no-icon' }
  }
}
