import { useState } from 'react'
import type { EdgeDirectionSet, EdgeDirectionSetStyle, EdgeStyle } from '@shared/diagram'
import { markerUrl } from './markerIds'
import { DEFAULT_DIRECTION_SET_LEGEND_COLOR } from './edgeDirectionSets'
import EdgeDirectionSetStyleEditor from './EdgeDirectionSetStyleEditor'

interface EdgeDirectionSetsSectionProps {
  // Raw diagram value. Empty means the feature is dormant.
  sets: EdgeDirectionSet[]
  activeId: string | undefined
  onSwitchActive: (id: string) => void
  onCreate: () => void
  onDuplicate: (id: string) => void
  onRename: (id: string, name: string) => void
  onUpdateStyle: (id: string, patch: Partial<EdgeDirectionSetStyle>) => void
  onDelete: (id: string) => void
}

// Same three dash patterns as LabeledEdge.tsx / LegendPanel.tsx — small
// independent copy, matching this codebase's precedent for this one-liner.
const DASH_ARRAY: Record<Exclude<EdgeStyle['lineStyle'], undefined>, string | undefined> = {
  solid: undefined,
  dashed: '8 6',
  dotted: '2 4'
}

// Live preview of the set's default edge style (ADR 0083), drawn as an
// arrow. Honours the configured stroke width, clamped so the tiny swatch
// stays legible; the read-only legend row elsewhere renders at a fixed
// width. Read-only — editing is via the ✎ button.
function DirectionSwatch({
  style
}: {
  style: EdgeDirectionSetStyle | undefined
}): React.JSX.Element {
  const color = style?.stroke ?? DEFAULT_DIRECTION_SET_LEGEND_COLOR
  const width = Math.min(Math.max(style?.strokeWidth ?? 2, 1), 6)
  return (
    <svg viewBox="0 0 40 14" width="40" height="14">
      <line
        x1="3"
        y1="7"
        x2="35"
        y2="7"
        stroke={color}
        strokeWidth={width}
        strokeOpacity={style?.strokeOpacity !== undefined ? style.strokeOpacity / 100 : undefined}
        strokeLinecap="round"
        strokeDasharray={style?.lineStyle ? DASH_ARRAY[style.lineStyle] : undefined}
        markerStart={markerUrl(style?.startMarker)}
        markerEnd={markerUrl(style?.endMarker)}
      />
    </svg>
  )
}

// One section of DiagramSettingsPanel (see ADR 0071 / ADR 0081 / ADR 0083).
// Named "readings" of the diagram's edges that differ only in arrow
// direction — "Data flow" vs. "Trigger direction" being the canonical pair.
// A single set is meaningful: it names the current reading, contributes a
// legend row, and its style is the default for edges drawn while it is
// active. Two or more sets can be switched between diagram-wide. The style
// is a creation-time default only — switching sets never restyles an edge
// that already exists. Body-only: the enclosing CollapsibleSection provides
// the title/expand chrome.
export default function EdgeDirectionSetsSection({
  sets,
  activeId,
  onSwitchActive,
  onCreate,
  onDuplicate,
  onRename,
  onUpdateStyle,
  onDelete
}: EdgeDirectionSetsSectionProps): React.JSX.Element {
  const [editing, setEditing] = useState<{ id: string; rect: DOMRect } | null>(null)

  if (sets.length === 0) {
    return (
      <>
        <p className="required-tags-panel-hint">
          Name the direction your edges show &mdash; e.g. &ldquo;Data flow&rdquo; &mdash; and it
          becomes a legend row and the default style for edges you draw. Add a second reading (e.g.
          &ldquo;Trigger direction&rdquo;) to switch the whole diagram between them: every edge
          stays in every reading, only its arrow direction (and which connection point each end
          uses) changes.
        </p>
        <button type="button" className="required-tag-add" onClick={onCreate}>
          Add direction set
        </button>
      </>
    )
  }

  const baseId = sets[0].id
  const editingSet = editing ? sets.find((s) => s.id === editing.id) : undefined

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
        Each reading&rsquo;s style is the default for edges <em>drawn while it is active</em> and is
        what its legend row (panel + PNG export) shows. Editing an existing edge&rsquo;s style still
        wins; switching readings never restyles an edge that already exists.
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
            <span
              className="edge-direction-set-swatch"
              title="Preview of this reading's edge style"
            >
              <DirectionSwatch style={s.style} />
            </span>
            <button
              type="button"
              className="required-tag-value-move"
              title="Edit this reading's default edge style"
              onClick={(e) =>
                setEditing({ id: s.id, rect: e.currentTarget.getBoundingClientRect() })
              }
            >
              ✎
            </button>
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

      {editing && editingSet && (
        <EdgeDirectionSetStyleEditor
          set={editingSet}
          anchorRect={editing.rect}
          onUpdateStyle={(patch) => onUpdateStyle(editing.id, patch)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
