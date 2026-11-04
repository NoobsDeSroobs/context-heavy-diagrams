// Where check_diagram gets the built-in profiles (ADR 0131). Run from the source tree (tests, dev)
// this reads resources/profiles; the extension build (scripts/build-extension.mjs) replaces this
// module with one that has the text inlined, like specText.mjs, so the bundle is self-contained and
// has the profiles of the app version that shipped it. The template is not a profile: it is invalid
// until its author fills it in.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SUFFIX = '.chdprofile.json'
const profilesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'resources',
  'profiles'
)

// { name: json text } of every built-in profile, by name (the file name without its suffix).
export function loadBuiltinProfiles() {
  return Object.fromEntries(
    readdirSync(profilesDir)
      .filter((file) => file.endsWith(SUFFIX) && file !== `template${SUFFIX}`)
      .sort()
      .map((file) => [
        file.slice(0, -SUFFIX.length),
        readFileSync(join(profilesDir, file), 'utf-8')
      ])
  )
}
