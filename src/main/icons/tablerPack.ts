import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { isIconFileName } from '@shared/icons/pack'
import { TABLER_PACK, TABLER_SUBSET } from '@shared/icons/iconRefs'

// The Tabler pack (ADR 0188): the outline icons of the `@tabler/icons` package that comes with the
// app, written out as a pack folder so the manager installs it like any other. The files are read
// where the package sits (a source checkout, or inside app.asar), so there is no second copy of the
// icons in the installer, and the command line reads the same ones.

// Where the package is, from the folder of the app.
export const tablerPackageFolder = (appPath: string): string =>
  join(appPath, 'node_modules', '@tabler', 'icons')

export interface StagedTabler {
  // The folder to give the manager, named like the pack.
  folder: string
  version: string
  icons: number
}

// Writes the pack into `parent` and says where. Only reads and writes files, so it works from
// app.asar; the files are not copied with copyFile for the same reason.
export async function stageTablerPack(
  packageFolder: string,
  parent: string
): Promise<StagedTabler> {
  const info = JSON.parse(await readFile(join(packageFolder, 'package.json'), 'utf-8')) as {
    version?: unknown
  }
  const version = typeof info.version === 'string' ? info.version : ''
  const from = join(packageFolder, 'icons', 'outline')
  const files = (await readdir(from)).filter(isIconFileName)

  const folder = join(parent, TABLER_PACK)
  const subset = join(folder, TABLER_SUBSET)
  await mkdir(subset, { recursive: true })
  const meta = {
    name: TABLER_PACK,
    description: 'Tabler Icons, the outline set (MIT licence).',
    ifMissing: 'Install the Tabler pack from View > Icon packs.',
    version
  }
  await writeFile(join(folder, 'pack.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf-8')
  const subsetMeta = { name: TABLER_SUBSET, description: 'One-colour line icons.' }
  await writeFile(join(subset, 'subset.json'), `${JSON.stringify(subsetMeta, null, 2)}\n`, 'utf-8')
  for (const file of files) {
    await writeFile(join(subset, file), await readFile(join(from, file)))
  }
  return { folder, version, icons: files.length }
}
