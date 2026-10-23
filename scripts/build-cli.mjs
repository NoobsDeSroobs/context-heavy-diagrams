// Bundles the `chd` commands that need the app's TypeScript: `chd export` (ADR 0124) into
// resources/cli/export.mjs and `chd check` (ADR 0131) into resources/cli/check.mjs. Each is one
// self-contained file (the shared code, the diagram parser and the command's own code), so the
// plain-Node CLI (resources/cli/chd.mjs, ADR 0106) needs no TypeScript and no node_modules. The
// output is git-ignored; `npm run build` runs this before packaging, and `npm run build:cli` runs it
// alone. Exports the bundlers so the tests can build the real bundles.
import { build } from 'esbuild'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const EXPORT_BUNDLE = join(root, 'resources', 'cli', 'export.mjs')
export const CHECK_BUNDLE = join(root, 'resources', 'cli', 'check.mjs')

async function bundle(entry, outfile) {
  await build({
    entryPoints: [join(root, 'src', 'cli', entry)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile,
    logLevel: 'warning'
  })
}

export const bundleExport = (outfile = EXPORT_BUNDLE) => bundle('exportCommand.ts', outfile)
export const bundleCheck = (outfile = CHECK_BUNDLE) => bundle('checkCommand.ts', outfile)

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await bundleExport()
  await bundleCheck()
  console.log(`built ${EXPORT_BUNDLE}\nbuilt ${CHECK_BUNDLE}`)
}
