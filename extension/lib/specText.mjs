// Where get_format_spec gets its text. Run from the source tree (tests, dev)
// this reads the skill files; the extension build (scripts/build-extension.mjs)
// replaces this module with one that has the same text inlined, so the bundle
// is self-contained and always matches the app version that shipped it.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SPEC_FILES = {
  skill: 'SKILL.md',
  fields: 'references/field-reference.md',
  authoring: 'references/authoring-guide.md',
  layout: 'references/layout-guide.md'
}

const skillDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'resources',
  'ai',
  'skills',
  'chd-diagrams'
)

export function loadSpecSources() {
  return Object.fromEntries(
    Object.entries(SPEC_FILES).map(([key, file]) => [
      key,
      readFileSync(join(skillDir, ...file.split('/')), 'utf-8')
    ])
  )
}
