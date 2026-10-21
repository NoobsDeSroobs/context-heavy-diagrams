// Bundles `chd export` (ADR 0124) into resources/cli/export.mjs: the renderer shared with the app,
// the diagram parser and the command's own code in one self-contained file, so the plain-Node CLI
// (resources/cli/chd.mjs, ADR 0106) needs no TypeScript and no node_modules. The output is
// git-ignored; `npm run build` runs this before packaging, and `npm run build:cli` runs it alone.
// Exports bundleExport so the tests can build the real bundle.
import { build } from 'esbuild'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const EXPORT_BUNDLE = join(root, 'resources', 'cli', 'export.mjs')

export async function bundleExport(outfile = EXPORT_BUNDLE) {
  await build({
    entryPoints: [join(root, 'src', 'cli', 'exportCommand.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile,
    logLevel: 'warning'
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await bundleExport()
  console.log(`built ${EXPORT_BUNDLE}`)
}
