import type { JsonValue, MetadataEntry, RequiredTagDefinition } from '../tagging/schema.ts'
import { seedMetadata } from '../tagging/metadataSync.ts'
import type { BulkElement } from './elements.ts'

// The elements of a paste, ready to become nodes (ADR 0168): each with the metadata it starts
// with, the required tags' defaults with the pasted tags laid over them.
export interface PreparedElement {
  label: string
  note?: string
  metadata: Record<string, MetadataEntry> | undefined
}

export interface Prepared {
  elements: PreparedElement[]
  noteCount: number
  // Cells that could not be used as they were, said as sentences.
  warnings: string[]
}

// A header names a required tag when it matches its key, exactly or without regard to case.
function requiredFor(
  key: string,
  required: RequiredTagDefinition[]
): RequiredTagDefinition | undefined {
  return (
    required.find((def) => def.key === key) ??
    required.find((def) => def.key !== '' && def.key.toLowerCase() === key.toLowerCase())
  )
}

// A required tag is checked against its template the next time the diagram syncs (ADR 0022): a
// value outside `allowedValues` would be reset to the default with a diagnostic, and a static tag
// always holds the template's value. So those cells are left out here, and counted, instead of
// being written and then reset.
export function prepareElements(
  elements: BulkElement[],
  requiredTags: RequiredTagDefinition[],
  containerKey?: string
): Prepared {
  const notAllowed = new Map<string, number>()
  const isStatic = new Map<string, number>()
  let noteCount = 0

  const out = elements.map((element): PreparedElement => {
    const metadata: Record<string, MetadataEntry> = { ...seedMetadata(requiredTags) }
    const tags: Record<string, string> = { ...element.tags }
    if (element.container !== undefined && containerKey !== undefined && !(containerKey in tags)) {
      tags[containerKey] = element.container
    }
    for (const [key, text] of Object.entries(tags)) {
      const def = requiredFor(key, requiredTags)
      if (!def) {
        metadata[key] = { value: text as JsonValue }
      } else if (def.lock === 'lockedStatic') {
        isStatic.set(def.key, (isStatic.get(def.key) ?? 0) + 1)
      } else if (def.allowedValues && !def.allowedValues.includes(text)) {
        notAllowed.set(def.key, (notAllowed.get(def.key) ?? 0) + 1)
      } else {
        metadata[def.key] = { value: text, lock: def.lock }
      }
    }
    if (element.note) noteCount += 1
    return {
      label: element.label,
      ...(element.note ? { note: element.note } : {}),
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined
    }
  })

  const warnings = [
    ...[...notAllowed].map(
      ([key, n]) =>
        `${n} value${n === 1 ? '' : 's'} for "${key}" not allowed there: left at the default`
    ),
    ...[...isStatic].map(
      ([key, n]) => `${n} value${n === 1 ? '' : 's'} for "${key}" ignored: it is a static tag`
    )
  ]
  return { elements: out, noteCount, warnings }
}
