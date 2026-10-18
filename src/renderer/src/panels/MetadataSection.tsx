import { useState } from 'react'
import type { JsonValue, MetadataEntry, RequiredTagDefinition } from '@shared/diagram'
import { CollapsibleSection } from './fields'
import EditableLabel from '../components/EditableLabel'

interface MetadataSectionProps {
  metadata: Record<string, MetadataEntry> | undefined
  onChange: (metadata: Record<string, MetadataEntry> | undefined) => void
  requiredTags: RequiredTagDefinition[]
  pushSnapshot: () => void
}

function stringifyValue(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

// Display only — the actual stored/edited value stays real JSON null
// either way (stringifyValue(null) === "null", still what the <select>
// below binds/parses through). See ADR 0046.
function displayValue(value: JsonValue): string {
  return value === null ? 'None' : stringifyValue(value)
}

// Best-effort: valid JSON (number/boolean/null/array/object) is stored as
// that; anything else falls back to a plain string, so typing e.g. "prod"
// doesn't need to be quoted to stay a string. Matches ADR 0022's "nested
// values render/edit via their stringified JSON form in that one cell."
function parseValue(raw: string): JsonValue {
  try {
    return JSON.parse(raw) as JsonValue
  } catch {
    return raw
  }
}

type MetadataEntryTuple = [string, MetadataEntry]

// Three groups, in this fixed order (not user-arrangeable — YAGNI until
// someone actually asks for custom grouping): Required fields
// (lockedEditable — still needs a human to fill in, so it's the one worth
// seeing first), User fields (free/unlocked — whatever a human added),
// External fields (lockedStatic — fixed by the template, never edited here
// at all, least actionable so it sinks to the bottom). Alphabetical within
// each group. A `CollapsibleSection` per group, reusing the same component
// the rest of this panel already groups Fill/Border/Font/Transform with —
// gives both a visible label and a collapse toggle for free, no new
// component needed.
function groupEntries(entries: MetadataEntryTuple[]): {
  required: MetadataEntryTuple[]
  user: MetadataEntryTuple[]
  external: MetadataEntryTuple[]
} {
  return {
    required: entries.filter(([, entry]) => entry.lock === 'lockedEditable'),
    user: entries.filter(([, entry]) => !entry.lock),
    external: entries.filter(([, entry]) => entry.lock === 'lockedStatic')
  }
}

// Single-selection only — every other PropertyPanel field supports a
// mixed-across-selection
// display, but metadata is a variable-length, per-element key set with no
// obvious "union of keys, mixed per key" UI yet. Only rendered when
// PropertyPanel has resolved exactly one selected Entity/Container/Edge.
export default function MetadataSection({
  metadata,
  onChange,
  requiredTags,
  pushSnapshot
}: MetadataSectionProps): React.JSX.Element {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const entries = Object.entries(metadata ?? {}).sort(([a], [b]) => a.localeCompare(b))
  const { required, user, external } = groupEntries(entries)
  const allowedValuesByKey = new Map<string, string[]>()
  for (const tag of requiredTags) {
    if (tag.allowedValues && tag.allowedValues.length > 0)
      allowedValuesByKey.set(tag.key, tag.allowedValues)
  }

  const commitValue = (key: string, raw: string): void => {
    const current = metadata?.[key]
    if (!current) return
    pushSnapshot()
    onChange({ ...metadata, [key]: { ...current, value: parseValue(raw) } })
  }

  const removeKey = (key: string): void => {
    pushSnapshot()
    const next = { ...metadata }
    delete next[key]
    onChange(Object.keys(next).length > 0 ? next : undefined)
  }

  // Key AND value up front — a two-step "add the key, then separately
  // double-click the new (blank, easy-to-miss) row to set its value" flow
  // read as "there's no way to set a value at all" in practice.
  const addEntry = (): void => {
    const key = newKey.trim()
    if (!key || metadata?.[key]) return
    pushSnapshot()
    onChange({ ...metadata, [key]: { value: parseValue(newValue) } })
    setNewKey('')
    setNewValue('')
  }

  const renderRows = (group: MetadataEntryTuple[]): React.JSX.Element => (
    <div className="metadata-rows">
      {group.map(([key, entry]) => {
        const allowedValues = allowedValuesByKey.get(key)
        return (
          <div key={key} className="metadata-row">
            <span
              className={entry.lock ? 'metadata-key locked' : 'metadata-key'}
              title={
                entry.lock === 'lockedStatic'
                  ? 'Locked, fixed'
                  : entry.lock === 'lockedEditable'
                    ? 'Locked, editable'
                    : 'Free'
              }
            >
              {entry.lock && <span className="metadata-lock-icon">🔒</span>}
              {key}
            </span>
            {entry.lock === 'lockedStatic' ? (
              <span className="metadata-value metadata-value-static">
                {displayValue(entry.value)}
              </span>
            ) : allowedValues ? (
              <select
                className="metadata-value-select"
                value={stringifyValue(entry.value)}
                onChange={(event) => commitValue(key, event.target.value)}
              >
                {/* Always available without being added to allowedValues
                    itself — see ADR 0046. value="null" round-trips
                    through commitValue's existing parseValue (JSON.parse)
                    straight back to real null, no special-casing needed
                    there. */}
                <option value="null">None</option>
                {allowedValues.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <EditableLabel
                className="metadata-value"
                inputClassName="metadata-value-input"
                value={displayValue(entry.value)}
                onCommit={(v) => commitValue(key, v)}
              />
            )}
            {!entry.lock && (
              <button
                type="button"
                className="metadata-remove"
                title="Remove"
                aria-label="Remove"
                onClick={() => removeKey(key)}
              >
                ×
              </button>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <CollapsibleSection title="Metadata">
      {required.length > 0 && (
        <CollapsibleSection title="Required fields">{renderRows(required)}</CollapsibleSection>
      )}
      {user.length > 0 && (
        <CollapsibleSection title="User fields">{renderRows(user)}</CollapsibleSection>
      )}
      {external.length > 0 && (
        <CollapsibleSection title="External fields">{renderRows(external)}</CollapsibleSection>
      )}
      <div className="metadata-add-row">
        <input
          className="metadata-add-key"
          placeholder="New key…"
          value={newKey}
          onChange={(event) => setNewKey(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') addEntry()
          }}
        />
        <input
          className="metadata-add-value"
          placeholder="Value…"
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') addEntry()
          }}
        />
        <button
          type="button"
          onClick={addEntry}
          disabled={!newKey.trim() || Boolean(metadata?.[newKey.trim()])}
        >
          Add
        </button>
      </div>
    </CollapsibleSection>
  )
}
