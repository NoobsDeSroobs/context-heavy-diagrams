import { PROFILE_FILE_SUFFIX } from './profile.ts'

// Making a new profile from the shipped template (ADR 0131). The pure parts, so they can be tested
// without a dialog: the file name the user typed becomes a suffixed path and the profile's name.

// A path that ends in .chdprofile.json whatever the user typed: "mine", "mine.json" and
// "mine.chdprofile.json" all give the same file.
export function withProfileSuffix(path: string): string {
  if (path.toLowerCase().endsWith(PROFILE_FILE_SUFFIX)) return path
  return path.replace(/\.json$/i, '') + PROFILE_FILE_SUFFIX
}

// "my-style.chdprofile.json" is named "my style" inside the profile; the author can change it.
export function profileNameFromPath(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? ''
  const base = withProfileSuffix(file).slice(0, -PROFILE_FILE_SUFFIX.length)
  const name = base.replace(/[-_]+/g, ' ').trim()
  return name === '' ? 'My architecture style' : name
}

// The template with its name replaced and nothing else touched, in the same layout.
export function newProfileText(templateText: string, name: string): string {
  const template = JSON.parse(templateText) as Record<string, unknown>
  return JSON.stringify({ ...template, name }, null, 2) + '\n'
}
