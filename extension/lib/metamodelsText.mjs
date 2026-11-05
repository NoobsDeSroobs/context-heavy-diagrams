// Where check_diagram gets the built-in metamodels (ADR 0131). Run from the source tree (tests, dev)
// this reads resources/metamodels; the extension build (scripts/build-extension.mjs) replaces this
// module with one that has the text inlined, like specText.mjs, so the bundle is self-contained and
// has the metamodels of the app version that shipped it. The template is not a metamodel: it is invalid
// until its author fills it in.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SUFFIX = '.chdmeta'
const metamodelsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'resources',
  'metamodels'
)

// { name: json text } of every built-in metamodel, by name (the file name without its suffix).
export function loadBuiltinMetamodels() {
  return Object.fromEntries(
    readdirSync(metamodelsDir)
      .filter((file) => file.endsWith(SUFFIX) && file !== `template${SUFFIX}`)
      .sort()
      .map((file) => [
        file.slice(0, -SUFFIX.length),
        readFileSync(join(metamodelsDir, file), 'utf-8')
      ])
  )
}
