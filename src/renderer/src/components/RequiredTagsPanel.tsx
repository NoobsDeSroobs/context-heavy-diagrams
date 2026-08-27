import { useEffect, useRef, useState } from 'react'
import type { JsonValue, MetadataLock, RequiredTagDefinition } from '@shared/diagram'
import { CollapsibleSection } from '../panels/fields'

interface RequiredTagsPanelProps {
  requiredTags: RequiredTagDefinition[]
  // Live scan of every node/edge's current metadata (Canvas.tsx's own
  // `usedTags`, already computed for HighlightsPanel) — reused here to
  // warn before an edit would invalidate an in-use value. See ADR 0047.
  usedTags: { key: string; value: JsonValue }[]
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

// The default-value dropdown's option value for "None" — same "null"
// token/round-trip convention MetadataSection's per-element dropdown
// already established (ADR 0046): JSON.parse("null") already
// yields real null via parseDefaultValue above, no special-casing needed
// on commit. undefined and explicit null are both "None" here — this app
// already treats an absent defaultValue as null everywhere else
// (docs/file-format.md), so the dropdown shouldn't draw a distinction the
// rest of the app doesn't.
function defaultValueToken(value: JsonValue | undefined): string {
  return value == null ? 'null' : stringifyDefault(value)
}

// Whether the dropdown already has a real option for this default value —
// None is always known; a string present in allowedValues is known;
// anything else (a stale value left over from before allowedValues
// existed or was last edited — this field was never validated against
// allowedValues, see ADR 0047) is an orphan that still needs a visible
// slot so it isn't silently dropped out from under an existing file.
function isKnownDefaultValue(value: JsonValue | undefined, allowedValues: string[]): boolean {
  if (value == null) return true
  return typeof value === 'string' && allowedValues.includes(value)
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

// Enter commits immediately (blurs the field, which triggers the same
// onBlur commit path) rather than requiring a separate click elsewhere.
function commitOnEnter(event: React.KeyboardEvent<HTMLInputElement>): void {
  if (event.key === 'Enter') event.currentTarget.blur()
}

// One row per existing allowed value (rename via the same blur-commit
// draft pattern as everything else in this panel, reorder/remove as
// discrete one-shot actions), plus a trailing always-blank row — typing
// into it and blurring/pressing Enter appends a new value and the row
// goes blank again, ready for the next one. Not literally per-keystroke
// (that would mean one sync per character, the exact bug this panel's
// other fields already learned to avoid — see useFieldDraft's own
// comment) but still buttonless: no "Add" click needed between values,
// matching the user's own stated preference. See ADR 0047.
// A pending remove/rename of an in-use value — see AllowedValuesEditor's
// own comment for why this replaced window.confirm().
interface PendingChange {
  index: number
  replacement: string | null
}

function AllowedValuesEditor({
  tagKey,
  values,
  usedTags,
  onChange
}: {
  tagKey: string
  values: string[]
  usedTags: { key: string; value: JsonValue }[]
  onChange: (values: string[]) => void
}): React.JSX.Element {
  const [newDraft, setNewDraft] = useState('')
  const [pending, setPending] = useState<PendingChange | null>(null)

  const isInUse = (value: string): boolean =>
    usedTags.some((t) => t.key === tagKey && t.value === value)

  const applyChange = (index: number, replacement: string | null): void => {
    if (replacement === null) {
      onChange(values.filter((_, i) => i !== index))
      return
    }
    onChange(values.map((v, i) => (i === index ? replacement : v)))
  }

  // Covers both "remove this row outright" and "rename it to something
  // that already collided/emptied" — a rename that changes what an
  // in-use value actually reads as has the exact same consequence as
  // deleting it (the old value stops being allowed, so any element still
  // holding it goes invalid and resets to the tag's default on next
  // sync), so both paths share this one confirmation.
  //
  // Deliberately NOT window.confirm() — a real bug found live: a native
  // confirm() dialog, once dismissed (confirmed OR cancelled), left this
  // panel's <select> elements unresponsive to further clicks (no console
  // error, matching a known Electron/Chromium class of native-dialog/
  // focus-state quirk — see docs/known-issues.md). Confirming in-panel
  // via `pending` state instead avoids a native dialog entirely.
  const commitRemovalOrRename = (index: number, replacement: string | null): void => {
    const oldValue = values[index]
    if (replacement === oldValue) return
    // Renaming onto a value that already exists elsewhere in the list
    // would produce a duplicate row — same "no-op on collision" treatment
    // as adding one via the trailing row below.
    if (replacement !== null && values.includes(replacement)) return
    if (isInUse(oldValue)) {
      setPending({ index, replacement })
      return
    }
    applyChange(index, replacement)
  }

  const moveValue = (index: number, direction: -1 | 1): void => {
    const target = index + direction
    if (target < 0 || target >= values.length) return
    const next = [...values]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const commitNew = (): void => {
    const trimmed = newDraft.trim()
    setNewDraft('')
    if (!trimmed || values.includes(trimmed)) return
    onChange([...values, trimmed])
  }

  return (
    <div className="required-tag-values-list">
      {values.map((value, index) =>
        pending?.index === index ? (
          <div key={index} className="required-tag-value-confirm">
            <p>
              &ldquo;{value}&rdquo; is used by at least one element for &ldquo;{tagKey}&rdquo;.{' '}
              {pending.replacement === null
                ? 'Removing it'
                : `Renaming it to "${pending.replacement}"`}{' '}
              will reset those elements to this tag&rsquo;s default value on the next sync.
            </p>
            <div className="required-tag-value-confirm-actions">
              <button
                type="button"
                onClick={() => {
                  applyChange(pending.index, pending.replacement)
                  setPending(null)
                }}
              >
                {pending.replacement === null ? 'Remove' : 'Rename'}
              </button>
              <button type="button" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <ValueRow
            key={index}
            value={value}
            isFirst={index === 0}
            isLast={index === values.length - 1}
            onMoveUp={() => moveValue(index, -1)}
            onMoveDown={() => moveValue(index, 1)}
            onCommit={(next) =>
              commitRemovalOrRename(index, next.trim() === '' ? null : next.trim())
            }
            onRemove={() => commitRemovalOrRename(index, null)}
          />
        )
      )}
      <div className="required-tag-value-row required-tag-value-row-new">
        <input
          className="required-tag-value-input"
          placeholder="Add value…"
          value={newDraft}
          onChange={(event) => setNewDraft(event.target.value)}
          onBlur={commitNew}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </div>
    </div>
  )
}

function ValueRow({
  value,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onCommit,
  onRemove
}: {
  value: string
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onCommit: (next: string) => void
  onRemove: () => void
}): React.JSX.Element {
  const field = useFieldDraft(value, onCommit)
  return (
    <div className="required-tag-value-row">
      <input
        className="required-tag-value-input"
        value={field.draft}
        onFocus={field.onFocus}
        onChange={(event) => field.onChange(event.target.value)}
        onBlur={field.onBlur}
        onKeyDown={commitOnEnter}
      />
      <button
        type="button"
        className="required-tag-value-move"
        title="Move up"
        aria-label="Move up"
        disabled={isFirst}
        onClick={onMoveUp}
      >
        ▲
      </button>
      <button
        type="button"
        className="required-tag-value-move"
        title="Move down"
        aria-label="Move down"
        disabled={isLast}
        onClick={onMoveDown}
      >
        ▼
      </button>
      <button
        type="button"
        className="required-tag-value-remove"
        title="Remove"
        aria-label="Remove"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  )
}

function RequiredTagRow({
  tag,
  usedTags,
  onUpdate,
  onRemove
}: {
  tag: RequiredTagDefinition
  usedTags: { key: string; value: JsonValue }[]
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
  const allowedValues = tag.allowedValues ?? []

  return (
    <div className="required-tag-entry">
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
        {allowedValues.length > 0 ? (
          <select
            className="required-tag-default"
            value={defaultValueToken(tag.defaultValue)}
            onChange={(event) => onUpdate({ defaultValue: parseDefaultValue(event.target.value) })}
          >
            <option value="null">None</option>
            {allowedValues.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {!isKnownDefaultValue(tag.defaultValue, allowedValues) && (
              <option value={defaultValueToken(tag.defaultValue)}>
                {stringifyDefault(tag.defaultValue)} (not in list)
              </option>
            )}
          </select>
        ) : (
          <input
            className="required-tag-default"
            value={defaultField.draft}
            placeholder="default value"
            onFocus={defaultField.onFocus}
            onChange={(event) => defaultField.onChange(event.target.value)}
            onBlur={defaultField.onBlur}
            onKeyDown={commitOnEnter}
          />
        )}
        <button
          type="button"
          className="required-tag-remove"
          title="Remove"
          aria-label="Remove"
          onClick={onRemove}
        >
          ×
        </button>
      </div>
      <CollapsibleSection
        title={`Allowed values (${allowedValues.length})`}
        sectionKey={`allowedValues-${tag.key}`}
        defaultOpen={false}
      >
        <p className="required-tags-panel-hint">
          Leave empty to allow any value. &ldquo;None&rdquo; is always available for editable tags
          without needing to be listed here — see the panel&rsquo;s own hint above.
        </p>
        <AllowedValuesEditor
          tagKey={tag.key}
          values={allowedValues}
          usedTags={usedTags}
          onChange={(values) => onUpdate({ allowedValues: values.length > 0 ? values : undefined })}
        />
      </CollapsibleSection>
    </div>
  )
}

// Diagram-level settings surface, fixed right-side dock alongside
// DetailsPanel/DiagnosticsPanel — see ADR 0022. Text fields are
// draft-until-blur (see useFieldDraft above); the lock dropdown, remove,
// and add are discrete one-shot actions so they commit immediately, same
// as everywhere else in the app.
export default function RequiredTagsPanel({
  requiredTags,
  usedTags,
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
          Every Shape, Container, and Edge in this diagram always carries these keys. &ldquo;Locked,
          editable&rdquo; leaves the value for a human to fill in; &ldquo;locked, fixed&rdquo;
          always shows the template&rsquo;s own value.
        </p>
        <p className="required-tags-panel-hint">
          Allowed values (editable tags only) restrict a tag to a fixed list — expand &ldquo;Allowed
          values&rdquo; below each tag to edit it. When set, that tag shows as a dropdown instead of
          free text wherever it&rsquo;s edited. Every editable tag also always has an implicit
          &ldquo;None&rdquo; value available, for elements this tag just doesn&rsquo;t apply to — no
          need to add it to the list.
        </p>
        {requiredTags.length === 0 && (
          <p className="required-tags-panel-hint">No required tags yet.</p>
        )}
        {requiredTags.map((tag, index) => (
          <RequiredTagRow
            key={index}
            tag={tag}
            usedTags={usedTags}
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
