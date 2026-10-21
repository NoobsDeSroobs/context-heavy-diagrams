import { useEffect, useRef, useState } from 'react'
import type {
  EdgeDirectionSet,
  EdgeDirectionSetStyle,
  GravityPreset,
  JsonValue,
  RequiredTagDefinition
} from '@shared/diagram'
import { CollapsibleSection } from '../ui/fields'
import RequiredTagsSection from '../tagging/RequiredTagsSection'
import GravityPresetsSection from '../nodes/GravityPresetsSection'
import EdgeDirectionSetsSection from '../edges/EdgeDirectionSetsSection'

interface DiagramSettingsPanelProps {
  // --- Max connection points per side ---
  // Raw diagram value — undefined means "not overridden, using the
  // Preferences default." Same raw-vs-resolved distinction as the sections
  // below.
  maxConnectionPointsPerSide: number | undefined
  preferencesDefault: number
  onChangeMaxConnectionPoints: (value: number | undefined) => void
  // --- Required tags section ---
  requiredTags: RequiredTagDefinition[]
  usedTags: { key: string; value: JsonValue }[]
  onChangeRequiredTags: (tags: RequiredTagDefinition[]) => void
  onCopyRequiredTagsToChildren: () => void
  // --- Line bend presets section ---
  gravityPresets: GravityPreset[]
  onChangeGravityPresets: (presets: GravityPreset[]) => void
  gravityPresetsUserDefault: GravityPreset[] | undefined
  onSetGravityPresetsUserDefault: (presets: GravityPreset[]) => void
  onClearGravityPresetsUserDefault: () => void
  // --- Edge direction sets section (ADR 0081 / ADR 0083) ---
  edgeDirectionSets: EdgeDirectionSet[]
  activeEdgeDirectionSetId: string | undefined
  onSwitchEdgeDirectionSet: (id: string) => void
  onCreateEdgeDirectionSet: () => void
  onDuplicateEdgeDirectionSet: (id: string) => void
  onRenameEdgeDirectionSet: (id: string, name: string) => void
  onUpdateEdgeDirectionSetStyle: (id: string, patch: Partial<EdgeDirectionSetStyle>) => void
  onDeleteEdgeDirectionSet: (id: string) => void
  onClose: () => void
}

// Local draft, resynced only while not focused — same technique as every
// other blur-committed field in this app (RequiredTagsSection's
// useFieldDraft, PreferencesPanel's useNumberDraft).
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

// The single home for pure diagram-level state — the "Diagram settings"
// tier (per-diagram, stored in the .chd file; see the glossary and
// ADR 0052's addendum for the "Configuration" -> "Diagram settings"
// rename). ADR 0067 added the first field, ADR 0071 folded the standalone
// Required-tags and Line-bend-presets panels in here as collapsible
// sections rather than each owning a top-level dock toggle. Deliberately
// excludes Highlights/Legend (floating popups by design), Diagnostics/
// Layers (no owned state), and Preferences/Style Palette (per-app).
export default function DiagramSettingsPanel({
  maxConnectionPointsPerSide,
  preferencesDefault,
  onChangeMaxConnectionPoints,
  requiredTags,
  usedTags,
  onChangeRequiredTags,
  onCopyRequiredTagsToChildren,
  gravityPresets,
  onChangeGravityPresets,
  gravityPresetsUserDefault,
  onSetGravityPresetsUserDefault,
  onClearGravityPresetsUserDefault,
  edgeDirectionSets,
  activeEdgeDirectionSetId,
  onSwitchEdgeDirectionSet,
  onCreateEdgeDirectionSet,
  onDuplicateEdgeDirectionSet,
  onRenameEdgeDirectionSet,
  onUpdateEdgeDirectionSetStyle,
  onDeleteEdgeDirectionSet,
  onClose
}: DiagramSettingsPanelProps): React.JSX.Element {
  const isOverridden = maxConnectionPointsPerSide !== undefined
  const [draft, setDraft, onFocus, onBlur] = useDraft(
    String(maxConnectionPointsPerSide ?? preferencesDefault)
  )

  return (
    <div className="required-tags-panel diagram-settings-panel">
      <div className="required-tags-panel-toolbar">
        <span className="required-tags-panel-title">Diagram settings</span>
        <div className="details-panel-spacer" />
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="required-tags-panel-body">
        <p className="required-tags-panel-hint">
          Values here apply to this diagram only, overriding your own Preferences default for anyone
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
              if (e.target.value !== '') onChangeMaxConnectionPoints(Number(e.target.value))
            }}
            onBlur={onBlur}
            title="Overrides your Preferences default for this diagram — lowering it never removes points an element already has, only stops adding more"
          />
        </label>
        <p className="required-tags-panel-hint">
          {isOverridden
            ? `Overridden for this diagram. Your Preferences default is ${preferencesDefault}.`
            : `Not overridden — using your Preferences default of ${preferencesDefault}.`}
        </p>
        <button
          type="button"
          disabled={!isOverridden}
          onClick={() => onChangeMaxConnectionPoints(undefined)}
        >
          Revert to Preferences default
        </button>

        <CollapsibleSection title="Required tags" sectionKey="diagram-settings-required-tags">
          <RequiredTagsSection
            requiredTags={requiredTags}
            usedTags={usedTags}
            onChange={onChangeRequiredTags}
            onCopyToChildren={onCopyRequiredTagsToChildren}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Line bend presets"
          sectionKey="diagram-settings-bend-presets"
          defaultOpen={false}
        >
          <GravityPresetsSection
            presets={gravityPresets}
            onChange={onChangeGravityPresets}
            userDefault={gravityPresetsUserDefault}
            onSetUserDefault={onSetGravityPresetsUserDefault}
            onClearUserDefault={onClearGravityPresetsUserDefault}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Edge direction sets"
          sectionKey="diagram-settings-edge-direction-sets"
          defaultOpen={false}
        >
          <EdgeDirectionSetsSection
            sets={edgeDirectionSets}
            activeId={activeEdgeDirectionSetId}
            onSwitchActive={onSwitchEdgeDirectionSet}
            onCreate={onCreateEdgeDirectionSet}
            onDuplicate={onDuplicateEdgeDirectionSet}
            onRename={onRenameEdgeDirectionSet}
            onUpdateStyle={onUpdateEdgeDirectionSetStyle}
            onDelete={onDeleteEdgeDirectionSet}
          />
        </CollapsibleSection>
      </div>
    </div>
  )
}
