import { useEffect, useRef, useState, type ReactNode } from 'react'

// Shared, dumb field primitives for the property panel — no knowledge of
// NodeStyle/EdgeStyle or the diagram model, just generic value-in/onChange-out
// controls plus the "mixed across selection" display convention from epic
// 0003's design (blank/placeholder rather than defaulting to the first
// item's value — see docs/planning/epics/0003-styling-panel.md). See
// fieldValue.ts for the FieldValue/computeFieldValue helpers this reads —
// split into their own file so this one only exports components (Fast
// Refresh requirement).

export function CollapsibleSection({
  title,
  children
}: {
  title: string
  children: ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div className="property-section">
      <button
        type="button"
        className="property-section-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={`property-section-caret${open ? ' open' : ''}`}>▸</span>
        {title}
      </button>
      {open && <div className="property-section-body">{children}</div>}
    </div>
  )
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }): React.JSX.Element {
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
function useDraft(value: string, mixed: boolean): [string, (v: string) => void, () => void, () => void] {
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
  onSessionEnd
}: {
  label: string
  value: string | undefined
  mixed: boolean
  onChange: (value: string | undefined) => void
  onSessionStart: () => void
  onSessionEnd: () => void
}): React.JSX.Element {
  const swatchValue = value && HEX_RE.test(value) ? value : '#808080'
  const [draft, setDraft, onDraftFocus, onDraftBlur] = useDraft(value ?? '', mixed)
  return (
    <FieldRow label={label}>
      <div className="property-color-field">
        <input
          type="color"
          className={mixed ? 'property-color-swatch mixed' : 'property-color-swatch'}
          value={swatchValue}
          onFocus={onSessionStart}
          onChange={(event) => onChange(event.target.value)}
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
  const [draft, setDraft, onDraftFocus, onDraftBlur] = useDraft(value != null ? String(value) : '', mixed)
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
// without extra wiring. Used for the fillOpacity/strokeOpacity/fontOpacity
// fields, always right next to the color it modifies (per-channel opacity,
// not one whole-element value — see FontStyle.fontOpacity's comment).
// Mixed selections show the slider at a neutral 100 — a range input has no
// way to represent "blank" the way NumberField's placeholder does.
export function OpacityField({
  label,
  value,
  mixed,
  onChange,
  onSessionStart,
  onSessionEnd
}: {
  label: string
  value: number | undefined
  mixed: boolean
  onChange: (value: number | undefined) => void
  onSessionStart: () => void
  onSessionEnd: () => void
}): React.JSX.Element {
  const [draft, setDraft, onDraftFocus, onDraftBlur] = useDraft(value != null ? String(value) : '100', mixed)
  const sliderValue = mixed ? 100 : (value ?? 100)

  const applyNumeric = (raw: number): void => {
    setDraft(String(raw))
    onChange(raw)
  }

  return (
    <FieldRow label={label}>
      <div className="property-opacity-field">
        <input
          type="range"
          min={0}
          max={100}
          className={mixed ? 'property-opacity-slider mixed' : 'property-opacity-slider'}
          value={sliderValue}
          onFocus={onSessionStart}
          onChange={(event) => applyNumeric(Number(event.target.value))}
          onBlur={onSessionEnd}
        />
        <input
          type="number"
          className="property-opacity-number"
          min={0}
          max={100}
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
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  pushSnapshot: () => void
}): React.JSX.Element {
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
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldRow>
  )
}
