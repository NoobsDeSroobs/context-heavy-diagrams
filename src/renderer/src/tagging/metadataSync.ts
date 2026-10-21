import type { JsonValue, MetadataEntry, RequiredTagDefinition } from '@shared/diagram'

// Fresh metadata for a brand-new Entity/Container/Edge — every requiredTags
// entry, seeded at its own defaultValue/lock. No diagnostics involved (a
// new element has nothing to "reset"); that only applies to syncElementMetadata
// below, which reconciles *existing* elements against a changed template.
// A not-yet-named tag (addTag() seeds a blank key, not a placeholder — see
// its own comment) is skipped: nothing to seed under an empty key.
export function seedMetadata(
  requiredTags: RequiredTagDefinition[]
): Record<string, MetadataEntry> | undefined {
  const result: Record<string, MetadataEntry> = {}
  for (const def of requiredTags) {
    if (!def.key) continue
    result[def.key] = { value: def.defaultValue ?? null, lock: def.lock }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function isValidForTag(value: JsonValue, def: RequiredTagDefinition): boolean {
  // null is always valid, regardless of allowedValues — the implicit
  // "None" value every required tag carries (see ADR 0046), without
  // needing to be added to allowedValues itself. Without this, a
  // deliberately-None element would get silently reset back to a real
  // defaultValue on the very next sync pass — exactly backwards from the
  // point of a "not applicable" value.
  if (value === null) return true
  // No allowedValues means nothing else to be invalid against — see ADR 0022.
  if (!def.allowedValues) return true
  return typeof value === 'string' && def.allowedValues.includes(value)
}

// Reconciles one element's metadata against the diagram's requiredTags template. ADR 0022
// ("Retroactive backfill") has the exact rules: lockedEditable keeps a still-valid value or resets
// an invalid one, lockedStatic always takes the template value, a removed key demotes rather than
// deletes. Pushes one message per correction onto `diagnostics`, mutated in place: it runs once per
// node/edge per sync pass, so a shared array avoids threading an accumulator through every call.
//
// The ADR's collision-affixing case (a key leaves requiredTags, becomes a free entry, then is
// re-added) is handled on the reinstating side: when a required key's slot is held by an old free
// entry, that free entry is bumped aside (" (demoted)", numbered if also taken), so the template's
// key stays clean.
//
// A not-yet-named tag (blank key, see addTag()) is skipped, both as a def and as a member of
// requiredKeys: nothing was ever stamped under an empty key.
export function syncElementMetadata(
  metadata: Record<string, MetadataEntry> | undefined,
  requiredTags: RequiredTagDefinition[],
  elementLabel: string,
  diagnostics: string[]
): Record<string, MetadataEntry> | undefined {
  const next: Record<string, MetadataEntry> = { ...metadata }
  const namedTags = requiredTags.filter((def) => def.key)
  const requiredKeys = new Set(namedTags.map((def) => def.key))

  for (const def of namedTags) {
    const existing = next[def.key]
    const templateEntry: MetadataEntry = { value: def.defaultValue ?? null, lock: def.lock }

    if (existing?.lock === def.lock) {
      if (def.lock === 'lockedStatic') {
        if (existing.value !== templateEntry.value) {
          next[def.key] = templateEntry
          diagnostics.push(`Invalid value in ${elementLabel}.${def.key}, reset to default value.`)
        }
      } else if (!isValidForTag(existing.value, def)) {
        next[def.key] = templateEntry
        diagnostics.push(`Invalid value in ${elementLabel}.${def.key}, reset to default value.`)
      }
      continue
    }

    if (existing && !existing.lock) {
      // A pre-existing free entry sitting on a key that's just become
      // required (or reinstated after an earlier demotion) — preserve it
      // under a bumped key rather than silently discarding it.
      let affixed = `${def.key} (demoted)`
      let n = 2
      while (affixed in next) affixed = `${def.key} (demoted ${n++})`
      next[affixed] = existing
      diagnostics.push(
        `${elementLabel}.${def.key} is now required; previous free value moved to "${affixed}".`
      )
    }
    next[def.key] = templateEntry
  }

  for (const key of Object.keys(next)) {
    const entry = next[key]
    if (entry.lock && !requiredKeys.has(key)) {
      next[key] = { value: entry.value }
      diagnostics.push(`${elementLabel}.${key} is no longer required, kept as a free tag.`)
    }
  }

  return Object.keys(next).length > 0 ? next : undefined
}
