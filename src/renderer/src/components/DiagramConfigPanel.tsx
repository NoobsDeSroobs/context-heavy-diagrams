import { useEffect, useRef, useState } from 'react'

interface DiagramConfigPanelProps {
  // Raw diagram value — undefined means "not overridden, using the
  // Settings default." Same raw-vs-resolved distinction as
  // GravityPresetsPanel's `presets` prop.
  maxConnectionPointsPerSide: number | undefined
  settingsDefault: number
  onChange: (value: number | undefined) => void
  onClose: () => void
}

// Local draft, resynced only while not focused — same technique as every
// other blur-committed field in this app (RequiredTagsPanel's
// useFieldDraft, SettingsPanel's useNumberDraft).
function useDraft(value: string): [string, (v: string) => void, () => void, () => void] {
  const [draft, setDraft] = useState(value)
  const focusedRef = useRef(false)
  useEffect(() => {
    if (!focusedRef.current) setDraft(value)
  }, [value])
  return [
    draft,
    setDraft,
    () => {
      focusedRef.current = true
    },
    () => {
      focusedRef.current = false
      setDraft(value)
    }
  ]
}

// First panel to hold a *pure* diagram-level Configuration value with no
// existing panel of its own to live in (epic 0073/ADR 0052) — the same
// tier RequiredTags/Highlights/Legend/Gravity presets already occupy, but
// none of those were the right fit for this one field. Deliberately
// scoped to just this field for now; folding those other panels in here
// too is a real UI-architecture refactor (each has its own toggle state
// cross-referencing several others) logged separately, not attempted as
// a drive-by here — see epic 0073's own Notes.
export default function DiagramConfigPanel({
  maxConnectionPointsPerSide,
  settingsDefault,
  onChange,
  onClose
}: DiagramConfigPanelProps): React.JSX.Element {
  const isOverridden = maxConnectionPointsPerSide !== undefined
  const [draft, setDraft, onFocus, onBlur] = useDraft(
    String(maxConnectionPointsPerSide ?? settingsDefault)
  )

  return (
    <div className="required-tags-panel">
      <div className="required-tags-panel-toolbar">
        <span className="required-tags-panel-title">Diagram configuration</span>
        <div className="details-panel-spacer" />
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="required-tags-panel-body">
        <p className="required-tags-panel-hint">
          Values here apply to this diagram only, overriding your own Settings default for anyone
          who opens it.
        </p>
        <label className="property-field">
          <span className="property-field-label">Max connection points per side</span>
          <input
            type="number"
            className="property-number-field"
            min={1}
            value={draft}
            onFocus={onFocus}
            onChange={(e) => {
              setDraft(e.target.value)
              if (e.target.value !== '') onChange(Number(e.target.value))
            }}
            onBlur={onBlur}
            title="Overrides your Settings default for this diagram — lowering it never removes points an element already has, only stops adding more"
          />
        </label>
        <p className="required-tags-panel-hint">
          {isOverridden
            ? `Overridden for this diagram. Your Settings default is ${settingsDefault}.`
            : `Not overridden — using your Settings default of ${settingsDefault}.`}
        </p>
        <button type="button" disabled={!isOverridden} onClick={() => onChange(undefined)}>
          Revert to Settings default
        </button>
      </div>
    </div>
  )
}
