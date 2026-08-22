import { useEffect, useRef, useState } from 'react'
import type { JsonValue, MetadataLock, RequiredTagDefinition } from '@shared/diagram'

interface RequiredTagsPanelProps {
  requiredTags: RequiredTagDefinition[]
  onChange: (tags: RequiredTagDefinition[]) => void
  onClose: () => void
  onCopyToChildren: () => void
}

function stringifyDefault(value: JsonValue | undefined): string {
  if (value === undefined) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

// Empty means "no default" (undefined), not the empty string — mirrors
// MetadataSection's parseValue: try JSON first (numbers/booleans/null/
// arrays/objects survive a hand-typed default), fall back to a plain
// string so e.g. "prod" doesn't need to be quoted to be typed at all.
function parseDefaultValue(raw: string): JsonValue | undefined {
  if (raw.trim() === '') return undefined
  try {
    return JSON.parse(raw) as JsonValue
  } catch {
    return raw
  }
}

function parseAllowedValues(raw: string): string[] | undefined {
  const values = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return values.length > 0 ? values : undefined
}

// Local draft, resynced from `value` only while not focused, committed via
// `onCommit` on blur — NOT on every keystroke. Every commit here flows
// straight to Canvas's updateRequiredTags, which re-runs the full backfill
// sync (syncElementMetadata) against every node/edge immediately. That sync
// demotes-but-keeps a key that's no longer required rather than deleting
// it (ADR 0022's "don't destroy data" rule) — fine for a real edit, but
// catastrophic per-keystroke: typing a new key one letter at a time would
// demote (and leave behind) one stale entry per intermediate spelling.
// Reported live: typing "sensitivity" produced 11 leftover tags. Blur-only
// commit is what makes "one key rename = one sync pass" true again.
function useFieldDraft(
  value: string,
  onCommit: (value: string) => void
): {
  draft: string
  onChange: (value: string) => void
  onFocus: () => void
  onBlur: () => void
} {
  const [draft, setDraft] = useState(value)
  const focusedRef = useRef(false)
  useEffect(() => {
    if (!focusedRef.current) setDraft(value)
  }, [value])
  return {
    draft,
    onChange: setDraft,
    onFocus: () => {
      focusedRef.current = true
    },
    onBlur: () => {
      focusedRef.current = false
      if (draft !== value) onCommit(draft)
    }
  }
}

function RequiredTagRow({
  tag,
  onUpdate,
  onRemove
}: {
  tag: RequiredTagDefinition
  onUpdate: (patch: Partial<RequiredTagDefinition>) => void
  onRemove: () => void
}): React.JSX.Element {
  const keyField = useFieldDraft(tag.key, (v) => {
    const trimmed = v.trim()
    if (trimmed) onUpdate({ key: trimmed })
  })
  const defaultField = useFieldDraft(stringifyDefault(tag.defaultValue), (v) =>
    onUpdate({ defaultValue: parseDefaultValue(v) })
  )
  const allowedField = useFieldDraft(tag.allowedValues?.join(', ') ?? '', (v) =>
    onUpdate({ allowedValues: parseAllowedValues(v) })
  )

  // Enter commits immediately (blurs the field, which triggers the same
  // onBlur commit path) rather than requiring a separate click elsewhere.
  const commitOnEnter = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') event.currentTarget.blur()
  }

  return (
    <div className="required-tag-row">
      <input
        className="required-tag-key"
        value={keyField.draft}
        placeholder="key"
        onFocus={keyField.onFocus}
        onChange={(event) => keyField.onChange(event.target.value)}
        onBlur={keyField.onBlur}
        onKeyDown={commitOnEnter}
      />
      <select
        className="required-tag-lock"
        value={tag.lock}
        onChange={(event) => onUpdate({ lock: event.target.value as MetadataLock })}
      >
        <option value="lockedEditable">Locked, editable</option>
        <option value="lockedStatic">Locked, fixed</option>
      </select>
      <input
        className="required-tag-default"
        value={defaultField.draft}
        placeholder="default value"
        onFocus={defaultField.onFocus}
        onChange={(event) => defaultField.onChange(event.target.value)}
        onBlur={defaultField.onBlur}
        onKeyDown={commitOnEnter}
      />
      <input
        className="required-tag-allowed"
        value={allowedField.draft}
        placeholder="e.g. dev, staging, prod"
        onFocus={allowedField.onFocus}
        onChange={(event) => allowedField.onChange(event.target.value)}
        onBlur={allowedField.onBlur}
        onKeyDown={commitOnEnter}
      />
      <button type="button" className="required-tag-remove" title="Remove" aria-label="Remove" onClick={onRemove}>
        ×
      </button>
    </div>
  )
}

// Diagram-level settings surface, fixed right-side dock alongside
// DetailsPanel/DiagnosticsPanel — see epic 0034/ADR 0022. Text fields are
// draft-until-blur (see useFieldDraft above); the lock dropdown, remove,
// and add are discrete one-shot actions so they commit immediately, same
// as everywhere else in the app.
export default function RequiredTagsPanel({
  requiredTags,
  onChange,
  onClose,
  onCopyToChildren
}: RequiredTagsPanelProps): React.JSX.Element {
  const updateTag = (index: number, patch: Partial<RequiredTagDefinition>): void => {
    onChange(requiredTags.map((tag, i) => (i === index ? { ...tag, ...patch } : tag)))
  }

  const removeTag = (index: number): void => {
    onChange(requiredTags.filter((_, i) => i !== index))
  }

  const addTag = (): void => {
    let key = 'key'
    let n = 2
    while (requiredTags.some((tag) => tag.key === key)) key = `key ${n++}`
    onChange([...requiredTags, { key, lock: 'lockedEditable' }])
  }

  return (
    <div className="required-tags-panel">
      <div className="required-tags-panel-toolbar">
        <span className="required-tags-panel-title">Required tags</span>
        <div className="details-panel-spacer" />
        <button
          type="button"
          onClick={onCopyToChildren}
          disabled={requiredTags.length === 0}
          title="Merge this template into every linked diagram in this diagram's own folder, recursively"
        >
          Copy to children
        </button>
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="required-tags-panel-body">
        <p className="required-tags-panel-hint">
          Every Shape, Container, and Edge in this diagram always carries these keys. &ldquo;Locked, editable&rdquo;
          leaves the value for a human to fill in; &ldquo;locked, fixed&rdquo; always shows the template&rsquo;s own
          value.
        </p>
        <p className="required-tags-panel-hint">
          Allowed values (editable tags only) are comma-separated, e.g. <code>dev, staging, prod</code> — leave blank
          to allow any value. When set, that tag shows as a dropdown instead of free text wherever it&rsquo;s edited.
          Every editable tag also always has an implicit &ldquo;None&rdquo; value available, for elements this tag
          just doesn&rsquo;t apply to — no need to add it to the list above.
        </p>
        {requiredTags.length === 0 && <p className="required-tags-panel-hint">No required tags yet.</p>}
        {requiredTags.map((tag, index) => (
          <RequiredTagRow
            key={index}
            tag={tag}
            onUpdate={(patch) => updateTag(index, patch)}
            onRemove={() => removeTag(index)}
          />
        ))}
        <button type="button" className="required-tag-add" onClick={addTag}>
          Add required tag
        </button>
      </div>
    </div>
  )
}
