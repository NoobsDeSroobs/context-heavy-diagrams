import { useState } from 'react'
import type { HighlightDefinition, JsonValue } from '@shared/diagram'
import { highlightId } from '../highlights'

interface HighlightsPanelProps {
  highlights: HighlightDefinition[]
  enabledIds: Set<string>
  usedTags: { key: string; value: JsonValue }[]
  onAdd: (key: string, value: JsonValue, color: string) => void
  onUpdateColor: (id: string, color: string) => void
  onRemove: (id: string) => void
  onToggle: (id: string) => void
  onClose: () => void
}

// Same stringify-for-display convention as MetadataSection/RequiredTagsPanel
// (small independent copy, not a shared import — this codebase's existing
// pattern for this exact one-liner).
function stringifyValue(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

// Cycled by how many highlights already exist, not a single fixed default
// — so adding several in a row starts them visually distinct instead of
// all landing on the same color until someone edits them.
const DEFAULT_PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6']

// Diagram-level settings surface, same UtilityDock shell as RequiredTagsPanel/
// DiagnosticsPanel — see epic 0026/ADR 0025. "Add highlight" is an inline
// searchable list (not a floating anchored popup like IconPicker) — this
// panel already has a fixed-position dock's worth of space, no anchor
// coordinate needed.
export default function HighlightsPanel({
  highlights,
  enabledIds,
  usedTags,
  onAdd,
  onUpdateColor,
  onRemove,
  onToggle,
  onClose
}: HighlightsPanelProps): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')

  const catalogIds = new Set(highlights.map(highlightId))
  const availableTags = usedTags.filter((t) => !catalogIds.has(highlightId(t)))
  const filtered = availableTags.filter((t) =>
    `${t.key} = ${stringifyValue(t.value)}`.toLowerCase().includes(query.toLowerCase())
  )

  const closeAdd = (): void => {
    setAdding(false)
    setQuery('')
  }

  return (
    <div className="highlights-panel">
      <div className="highlights-panel-toolbar">
        <span className="highlights-panel-title">Highlights</span>
        <div className="details-panel-spacer" />
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="highlights-panel-body">
        <p className="highlights-panel-hint">
          Each highlight colors every Shape, Container, or Edge tagged with an exact key = value match. A single
          matching highlight recolors the element&rsquo;s border; two or more show as small color chips instead.
          Enabled/disabled state isn&rsquo;t saved with the file — everyone starts with highlights off.
        </p>
        {highlights.length === 0 && <p className="highlights-panel-hint">No highlights yet.</p>}
        {highlights.map((h) => {
          const id = highlightId(h)
          return (
            <div key={id} className="highlight-row">
              <input
                type="checkbox"
                checked={enabledIds.has(id)}
                onChange={() => onToggle(id)}
                title={enabledIds.has(id) ? 'Enabled' : 'Disabled'}
                aria-label={enabledIds.has(id) ? 'Enabled' : 'Disabled'}
              />
              <input
                type="color"
                className="highlight-row-swatch"
                value={h.color}
                onChange={(event) => onUpdateColor(id, event.target.value)}
                title="Color"
              />
              <span className="highlight-row-label">
                {h.key} = {stringifyValue(h.value)}
              </span>
              <button
                type="button"
                className="highlight-row-remove"
                title="Remove"
                aria-label="Remove"
                onClick={() => onRemove(id)}
              >
                ×
              </button>
            </div>
          )
        })}
        {adding ? (
          <div className="highlight-add-picker">
            <input
              className="highlight-add-picker-search"
              placeholder="Search tags…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
            <div className="highlight-add-picker-list">
              {filtered.length === 0 && <p className="highlights-panel-hint">No matching tags.</p>}
              {filtered.map((t) => (
                <button
                  key={highlightId(t)}
                  type="button"
                  className="highlight-add-picker-item"
                  onClick={() => {
                    onAdd(t.key, t.value, DEFAULT_PALETTE[highlights.length % DEFAULT_PALETTE.length])
                    closeAdd()
                  }}
                >
                  {t.key} = {stringifyValue(t.value)}
                </button>
              ))}
            </div>
            <button type="button" onClick={closeAdd}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="highlight-add-button"
            onClick={() => setAdding(true)}
            disabled={availableTags.length === 0}
            title={
              availableTags.length === 0
                ? 'No tags left to highlight — every tag in use already has a highlight'
                : undefined
            }
          >
            Add highlight
          </button>
        )}
      </div>
    </div>
  )
}
