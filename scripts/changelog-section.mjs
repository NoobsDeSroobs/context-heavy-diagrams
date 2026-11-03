// Prints the CHANGELOG.md section of one version, for the release notes (ADR 0139).
// Usage: node scripts/changelog-section.mjs <version>. Exit 1 when there is no section.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export function changelogSection(text, version) {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => l === `## ${version}` || l.startsWith(`## ${version} `))
  if (start === -1) return null
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '))
  if (end === -1) end = lines.length
  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim()
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.argv[2]
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const section =
    version && changelogSection(readFileSync(join(root, 'CHANGELOG.md'), 'utf-8'), version)
  if (!section) {
    console.error(`No CHANGELOG.md section for ${version}`)
    process.exit(1)
  }
  console.log(section)
}
