import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRafThrottledCallback } from '../hooks/useRafThrottledCallback'

// Shared, dumb field primitives for the property panel — no knowledge of
// NodeStyle/EdgeStyle or the diagram model, just generic value-in/onChange-out
// controls plus the "mixed across selection" display convention from the
// styling panel (blank/placeholder rather than defaulting to the first
// item's value). See
// fieldValue.ts for the FieldValue/computeFieldValue helpers this reads —
// split into their own file so this one only exports components (Fast
// Refresh requirement).

// Remembered open/closed state, per section, for the lifetime of the app
// session — module-level rather than component state, so
// closing "Transform" on one entity stays closed when a different entity/
// edge/container is selected next, instead of resetting on every remount
// (a selection change always remounts the whole property panel). Session-
// only on purpose, no persistence to disk — this is view state, not
// diagram content or a user Setting.
const sectionOpenState = new Map<string, boolean>()

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  sectionKey
}: {
  title: string
  children: ReactNode
  // Required-tags panel's allowed-values list wants collapsed by default —
  // every other caller keeps today's always-open behavior.
  defaultOpen?: boolean
  // Only needed when `title` is dynamic (carries a live count, e.g.
  // "Colors (3)") — remembered state has to key off something stable, or
  // every count change would look like a brand-new, never-seen section.
  // Defaults to `title` for the common case where the two are the same.
  sectionKey?: string
}): React.JSX.Element {
  const key = sectionKey ?? title
  const [open, setOpen] = useState(() => sectionOpenState.get(key) ?? defaultOpen)
  return (
    <div className="property-section">
      <button
        type="button"
        className="property-section-header"
        onClick={() =>
          setOpen((o) => {
            const next = !o
            sectionOpenState.set(key, next)
            return next
          })
        }
        aria-expanded={open}
      >
        <span className={`property-section-caret${open ? ' open' : ''}`}>▸</span>
        {title}
      </button>
      {open && <div className="property-section-body">{children}</div>}
    </div>
  )
}

export function FieldRow({
  label,
  children
}: {
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <label className="property-field">
      <span className="property-field-label">{label}</span>
      {children}
    </label>
  )
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

// A session groups every change between focus and blur into one undo step
// (via beginContinuousEdit/endContinuousEdit) — matches the pattern
// TextNode's rotate handle already established for continuous, non-React-Flow-
// native gestures. A plain click that doesn't focus anything (the "clear"
// button) brackets itself explicitly instead.
//
// Both text inputs below keep a local `draft` string, only resynced from
// the incoming (selection-derived) `value` while not focused — the same
// technique EditableLabel uses. Without it, a controlled input bound
// straight to `value` fights every keystroke: typing a character triggers
// onChange -> parent state update -> new `value` prop -> which is exactly
// what's already on screen, but the round-trip makes multi-character entry
// (e.g. typing "120" into a width field) effectively impossible to observe
// correctly since intermediate keystrokes could be clobbered by the same
// tick's re-derived value.
function useDraft(
  value: string,
  mixed: boolean
): [string, (v: string) => void, () => void, () => void] {
  const [draft, setDraft] = useState(value)
  const focusedRef = useRef(false)
  useEffect(() => {
    if (!focusedRef.current) setDraft(value)
  }, [value, mixed])
  const onFocus = (): void => {
    focusedRef.current = true
  }
  const onBlur = (): void => {
    focusedRef.current = false
    setDraft(value)
  }
  return [draft, setDraft, onFocus, onBlur]
}

export function ColorField({
  label,
  value,
  mixed,
  onChange,
  onSessionStart,
  onSessionEnd,
  paletteColors
}: {
  label: string
  value: string | undefined
  mixed: boolean
  onChange: (value: string | undefined) => void
  onSessionStart: () => void
  onSessionEnd: () => void
  // User/org palette swatches (ADR 0048) — optional, purely a
  // quick-pick row; a click is a single discrete commit (session start+end
  // together), same treatment as the clear button below, not a drag
  // gesture like the native color input.
  paletteColors?: { label: string; value: string }[]
}): React.JSX.Element {
  const swatchValue = value && HEX_RE.test(value) ? value : '#808080'
  const [draft, setDraft, onDraftFocus, onDraftBlur] = useDraft(value ?? '', mixed)
  // A native color-input drag can fire dozens of onChange events per
  // second — see ADR 0056. Coalescing to one commit per animation frame keeps
  // the swatch fully live (60fps reads as continuous) without forcing a
  // state update, and everything downstream of it, on every single tick.
  const throttledOnChange = useRafThrottledCallback(onChange)
  return (
    <FieldRow label={label}>
      <div className="property-color-field">
        <input
          type="color"
          className={mixed ? 'property-color-swatch mixed' : 'property-color-swatch'}
          value={swatchValue}
          onFocus={onSessionStart}
          onChange={(event) => throttledOnChange(event.target.value)}
          onBlur={onSessionEnd}
          title={mixed ? 'Mixed' : (value ?? 'Unset')}
        />
        <input
          type="text"
          className="property-color-text"
          placeholder={mixed ? 'Mixed' : 'Unset'}
          value={draft}
          onFocus={() => {
            onDraftFocus()
            onSessionStart()
          }}
          onChange={(event) => {
            setDraft(event.target.value)
            onChange(event.target.value || undefined)
          }}
          onBlur={() => {
            onDraftBlur()
            onSessionEnd()
          }}
        />
        {value != null && (
          <button
            type="button"
            className="property-field-clear"
            title="Clear"
            aria-label="Clear"
            onClick={() => {
              onSessionStart()
              onChange(undefined)
              onSessionEnd()
            }}
          >
            ×
          </button>
        )}
      </div>
      {paletteColors && paletteColors.length > 0 && (
        <div className="property-palette-swatches">
          {paletteColors.map((c) => (
            <button
              key={c.label + c.value}
              type="button"
              className="property-palette-swatch"
              style={{ backgroundColor: c.value }}
              title={c.label}
              aria-label={c.label}
              onClick={() => {
                onSessionStart()
                onChange(c.value)
                onSessionEnd()
              }}
            />
          ))}
        </div>
      )}
    </FieldRow>
  )
}

export function NumberField({
  label,
  value,
  mixed,
  min,
  max,
  onChange,
  onSessionStart,
  onSessionEnd
}: {
  label: string
  value: number | undefined
  mixed: boolean
  min?: number
  max?: number
  onChange: (value: number | undefined) => void
  onSessionStart: () => void
  onSessionEnd: () => void
}): React.JSX.Element {
  const [draft, setDraft, onDraftFocus, onDraftBlur] = useDraft(
    value != null ? String(value) : '',
    mixed
  )
  return (
    <FieldRow label={label}>
      <input
        type="number"
        className="property-number-field"
        placeholder={mixed ? 'Mixed' : undefined}
        min={min}
        max={max}
        value={draft}
        onFocus={() => {
          onDraftFocus()
          onSessionStart()
        }}
        onChange={(event) => {
          setDraft(event.target.value)
          const raw = event.target.value
          onChange(raw === '' ? undefined : Number(raw))
        }}
        onBlur={() => {
          onDraftBlur()
          onSessionEnd()
        }}
      />
    </FieldRow>
  )
}

// Slider + number, linked — both are controlled from the same value/
// onChange, so dragging one and typing the other naturally stay in sync
// without extra wiring. Originally built for the fillOpacity/strokeOpacity/
// fontOpacity fields (per-channel opacity, not one whole-element value — see
// FontStyle.fontOpacity's comment), generalized for any bounded numeric
// field that reads naturally as a slider — e.g. an edge label's
// position. Mixed selections show the slider at `defaultValue` — a range
// input has no way to represent "blank" the way NumberField's placeholder
// does.
export function SliderField({
  label,
  value,
  mixed,
  min = 0,
  max = 100,
  defaultValue = 100,
  onChange,
  onSessionStart,
  onSessionEnd
}: {
  label: string
  value: number | undefined
  mixed: boolean
  min?: number
  max?: number
  defaultValue?: number
  onChange: (value: number | undefined) => void
  onSessionStart: () => void
  onSessionEnd: () => void
}): React.JSX.Element {
  const [draft, setDraft, onDraftFocus, onDraftBlur] = useDraft(
    value != null ? String(value) : String(defaultValue),
    mixed
  )
  const sliderValue = mixed ? defaultValue : (value ?? defaultValue)

  const applyNumeric = (raw: number): void => {
    setDraft(String(raw))
    onChange(raw)
  }

  return (
    <FieldRow label={label}>
      <div className="property-slider-field">
        <input
          type="range"
          min={min}
          max={max}
          className={mixed ? 'property-range-slider mixed' : 'property-range-slider'}
          value={sliderValue}
          onFocus={onSessionStart}
          onChange={(event) => applyNumeric(Number(event.target.value))}
          onBlur={onSessionEnd}
        />
        <input
          type="number"
          className="property-range-number"
          min={min}
          max={max}
          placeholder={mixed ? 'Mixed' : undefined}
          value={draft}
          onFocus={() => {
            onDraftFocus()
            onSessionStart()
          }}
          onChange={(event) => {
            setDraft(event.target.value)
            const raw = event.target.value
            onChange(raw === '' ? undefined : Number(raw))
          }}
          onBlur={() => {
            onDraftBlur()
            onSessionEnd()
          }}
        />
      </div>
    </FieldRow>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  mixed,
  options,
  onChange,
  pushSnapshot
}: {
  label: string
  value: T | undefined
  mixed: boolean
  // An option with a `group` is listed under a heading (<optgroup>); options
  // without one come first, ungrouped. Groups keep the order they first appear in.
  options: { value: T; label: string; group?: string }[]
  onChange: (value: T) => void
  pushSnapshot: () => void
}): React.JSX.Element {
  const ungrouped = options.filter((o) => !o.group)
  const groupNames = [...new Set(options.filter((o) => o.group).map((o) => o.group as string))]
  return (
    <FieldRow label={label}>
      <select
        className="property-select-field"
        value={mixed ? '' : (value ?? '')}
        onChange={(event) => {
          pushSnapshot()
          onChange(event.target.value as T)
        }}
      >
        {mixed && (
          <option value="" disabled>
            Mixed
          </option>
        )}
        {/* Distinct from `!value`: a field like fontFamily has a real ''-valued
            "Default" option meaning "no override," which is a legitimate
            selection, not a missing one — only show this placeholder when
            there's truly nothing selected yet. */}
        {!mixed && value === undefined && (
          <option value="" disabled>
            Select…
          </option>
        )}
        {ungrouped.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {groupNames.map((name) => (
          <optgroup key={name} label={name}>
            {options
              .filter((opt) => opt.group === name)
              .map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </FieldRow>
  )
}
