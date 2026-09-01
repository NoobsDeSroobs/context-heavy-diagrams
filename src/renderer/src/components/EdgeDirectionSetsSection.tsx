import { useState } from 'react'
import type { EdgeDirectionSet, EdgeDirectionSetLegend, EdgeStyle } from '@shared/diagram'
import { markerUrl } from '../edges/markerIds'
import { DEFAULT_DIRECTION_SET_LEGEND_COLOR } from '../edges/edgeDirectionSets'
import StylePicker from './StylePicker'

interface EdgeDirectionSetsSectionProps {
  // Raw diagram value. Empty means the feature is dormant.
  sets: EdgeDirectionSet[]
  activeId: string | undefined
  onSwitchActive: (id: string) => void
  onCreate: () => void
  onDuplicate: (id: string) => void
  onRename: (id: string, name: string) => void
  onUpdateLegend: (id: string, patch: Partial<EdgeDirectionSetLegend>) => void
  onDelete: (id: string) => void
}

// Same three dash patterns as LabeledEdge.tsx / LegendPanel.tsx — small
// independent copy, matching this codebase's precedent for this one-liner.
const DASH_ARRAY: Record<Exclude<EdgeStyle['lineStyle'], undefined>, string | undefined> = {
  solid: undefined,
  dashed: '8 6',
  dotted: '2 4'
}

function DirectionSwatch({
  legend
}: {
  legend: EdgeDirectionSetLegend | undefined
}): React.JSX.Element {
  const color = legend?.color ?? DEFAULT_DIRECTION_SET_LEGEND_COLOR
  return (
    <svg viewBox="0 0 40 14" width="40" height="14">
      <line
        x1="3"
        y1="7"
        x2="35"
        y2="7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={legend?.lineStyle ? DASH_ARRAY[legend.lineStyle] : undefined}
        markerStart={markerUrl(legend?.startMarker)}
        markerEnd={markerUrl(legend?.endMarker)}
      />
    </svg>
  )
}

// One section of DiagramSettingsPanel (see ADR 0071 / ADR 0081). Named
// "readings" of the diagram's edges that differ only in arrow direction —
// "Data flow" vs. "Trigger direction" being the canonical pair. A single
// set is meaningful: it names the current reading and contributes a legend
// row (label = the set name, swatch styled here). Two or more sets can be
// switched between diagram-wide. Body-only: the enclosing CollapsibleSection
// provides the title/expand chrome.
export default function EdgeDirectionSetsSection({
  sets,
  activeId,
  onSwitchActive,
  onCreate,
  onDuplicate,
  onRename,
  onUpdateLegend,
  onDelete
}: EdgeDirectionSetsSectionProps): React.JSX.Element {
  const [stylePickerFor, setStylePickerFor] = useState<{ id: string; rect: DOMRect } | null>(null)

  if (sets.length === 0) {
    return (
      <>
        <p className="required-tags-panel-hint">
          Name the direction your edges show &mdash; e.g. &ldquo;Data flow&rdquo; &mdash; and it
          appears as a legend row. Add a second reading (e.g. &ldquo;Trigger direction&rdquo;) to
          switch the whole diagram between them: every edge stays in every reading, only its arrow
          direction (and which connection point each end uses) changes.
        </p>
        <button type="button" className="required-tag-add" onClick={onCreate}>
          Add direction set
        </button>
      </>
    )
  }

  const baseId = sets[0].id

  return (
    <>
      {sets.length >= 2 && (
        <label className="property-field">
          <span className="property-field-label">Active reading</span>
          <select
            className="property-select-field"
            value={activeId ?? baseId}
            onChange={(e) => onSwitchActive(e.target.value)}
          >
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="required-tags-panel-hint">
        Each reading shows as a legend row (in the panel and PNG export). The swatch is illustrative
        &mdash; it does not recolour the actual edges.
        {sets.length >= 2 && (
          <>
            {' '}
            The first set is the <em>base</em>: edges are stored on disk in its orientation
            whichever reading is active, so switching keeps file diffs small.
          </>
        )}
      </p>
      <div className="required-tag-values-list">
        {sets.map((s) => (
          <div key={s.id} className="required-tag-value-row edge-direction-set-row">
            <button
              type="button"
              className="edge-direction-set-swatch"
              title="Line style / arrowheads"
              onClick={(e) =>
                setStylePickerFor({ id: s.id, rect: e.currentTarget.getBoundingClientRect() })
              }
            >
              <DirectionSwatch legend={s.legend} />
            </button>
            <input
              type="color"
              className="edge-direction-set-color"
              value={s.legend?.color ?? DEFAULT_DIRECTION_SET_LEGEND_COLOR}
              onChange={(e) => onUpdateLegend(s.id, { color: e.target.value })}
              title="Swatch colour"
              aria-label="Swatch colour"
            />
            <input
              className="required-tag-value-input"
              type="text"
              value={s.name}
              onChange={(e) => onRename(s.id, e.target.value)}
              title={s.id === baseId && sets.length >= 2 ? 'Base reading' : undefined}
            />
            <button
              type="button"
              className="required-tag-value-move"
              onClick={() => onDuplicate(s.id)}
              title="Duplicate this reading"
            >
              ⧉
            </button>
            <button
              type="button"
              className="required-tag-value-remove"
              onClick={() => onDelete(s.id)}
              title={
                sets.length === 1
                  ? 'Delete this reading (the diagram goes back to no named direction)'
                  : 'Delete this reading'
              }
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="required-tag-add" onClick={onCreate}>
        Add direction set
      </button>

      {stylePickerFor && (
        <StylePicker
          anchorRect={stylePickerFor.rect}
          onPick={(style) => {
            onUpdateLegend(stylePickerFor.id, {
              lineStyle: style.lineStyle,
              startMarker: style.startMarker,
              endMarker: style.endMarker
            })
            setStylePickerFor(null)
          }}
          onClose={() => setStylePickerFor(null)}
        />
      )}
    </>
  )
}
