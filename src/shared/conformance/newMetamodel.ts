import { METAMODEL_FILE_SUFFIX } from './metamodel.ts'

// Making a new metamodel from the shipped template (ADR 0131). The pure parts, so they can be tested
// without a dialog: the file name the user typed becomes a suffixed path and the metamodel's name.

// A path that ends in .chdmeta whatever the user typed: "mine", "mine.json", "mine.chdprofile.json"
// (the old suffix) and "mine.chdmeta" all give the same file.
export function withMetamodelSuffix(path: string): string {
  if (path.toLowerCase().endsWith(METAMODEL_FILE_SUFFIX)) return path
  return path.replace(/(\.chdprofile)?\.json$/i, '') + METAMODEL_FILE_SUFFIX
}

// "my-style.chdmeta" is named "my style" inside the metamodel; the author can change it.
export function metamodelNameFromPath(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? ''
  const base = withMetamodelSuffix(file).slice(0, -METAMODEL_FILE_SUFFIX.length)
  const name = base.replace(/[-_]+/g, ' ').trim()
  return name === '' ? 'My metamodel' : name
}

// The template with its name replaced and nothing else touched, in the same layout.
export function newMetamodelText(templateText: string, name: string): string {
  const template = JSON.parse(templateText) as Record<string, unknown>
  return JSON.stringify({ ...template, name }, null, 2) + '\n'
}
