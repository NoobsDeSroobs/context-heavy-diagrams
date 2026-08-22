import { useState } from 'react'
import type { HighlightDefinition, JsonValue } from '@shared/diagram'
import { DEFAULT_HIGHLIGHT_COLOR, highlightId } from '../highlights'

interface HighlightsPanelProps {
  highlights: HighlightDefinition[]
  enabledIds: Set<string>
  usedTags: { key: string; value: JsonValue }[]
  anchorRect: DOMRect | null
  onAdd: (key: string, value: JsonValue, color: string) => void
  onUpdateColor: (id: string, color: string) => void
  onRemove: (id: string) => void
  onToggle: (id: string) => void
  // Bulk set (not toggle) for a group's "select all" checkbox.
  onToggleGroup: (ids: string[], enable: boolean) => void
  // Both creates a brand new group and resyncs an existing one — see
  // epic 0036/ADR 0026: it's the same reconcile either way.
  onAddOrResyncGroup: (key: string) => void
  onClose: () => void
}

const PANEL_WIDTH = 300

// Same stringify-for-display convention as MetadataSection/RequiredTagsPanel
// (small independent copy, not a shared import — this codebase's existing
// pattern for this exact one-liner). null renders as "None" — the implicit
// "not applicable" value every required tag carries (epic 0058/ADR 0046) —
// rather than the raw JSON token; purely a display choice, the value
// passed around everywhere else here stays real null.
function stringifyValue(value: JsonValue): string {
  if (value === null) return 'None'
  return typeof value === 'string' ? value : JSON.stringify(value)
}

// A key with 2+ entries renders as a collapsible group; exactly one entry
// for a key stays a plain row. Pure display split, no schema behind it —
// grouping is entirely derived from `highlights` sharing a `.key`.
function groupByKey(highlights: HighlightDefinition[]): Map<string, HighlightDefinition[]> {
  const groups = new Map<string, HighlightDefinition[]>()
  for (const h of highlights) {
    const existing = groups.get(h.key)
    if (existing) existing.push(h)
    else groups.set(h.key, [h])
  }
  return groups
}

function HighlightRow({
  h,
  enabled,
  label,
  onToggle,
  onUpdateColor,
  onRemove
}: {
  h: HighlightDefinition
  enabled: boolean
  label: string
  onToggle: () => void
  onUpdateColor: (color: string) => void
  onRemove: () => void
}): React.JSX.Element {
  return (
    <div className="highlight-row">
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        title={enabled ? 'Enabled' : 'Disabled'}
        aria-label={enabled ? 'Enabled' : 'Disabled'}
      />
      <input
        type="color"
        className="highlight-row-swatch"
        value={h.color}
        onChange={(event) => onUpdateColor(event.target.value)}
        title="Color"
      />
      <span className="highlight-row-label">{label}</span>
      <button
        type="button"
        className="highlight-row-remove"
        title="Remove"
        aria-label="Remove"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  )
}

// Native checkboxes have no `indeterminate` attribute — it's a DOM
// property only, set imperatively via a ref, never through JSX props.
function GroupCheckbox({
  state,
  onChange
}: {
  state: 'all' | 'none' | 'mixed'
  onChange: () => void
}): React.JSX.Element {
  return (
    <input
      type="checkbox"
      checked={state === 'all'}
      ref={(el) => {
        if (el) el.indeterminate = state === 'mixed'
      }}
      onChange={onChange}
      title={state === 'all' ? 'All enabled' : state === 'none' ? 'All disabled' : 'Some enabled'}
      aria-label="Toggle whole group"
    />
  )
}

// Small floating panel next to the canvas's bottom-left <Controls> widget,
// alongside LegendPanel — see epic 0026/ADR 0025 for the feature itself.
// Originally the same fixed-position UtilityDock shell as RequiredTagsPanel/
// DiagnosticsPanel; moved to this floating-popup treatment
// (fix/highlights-free-tags-and-toggle) to sit next to the Legend toggle
// instead, at the user's request. Both add flows stay inline searchable
// lists (not a second nested floating popup like IconPicker) — unchanged
// by the move, they never needed their own anchor.
export default function HighlightsPanel({
  highlights,
  enabledIds,
  usedTags,
  anchorRect,
  onAdd,
  onUpdateColor,
  onRemove,
  onToggle,
  onToggleGroup,
  onAddOrResyncGroup,
  onClose
}: HighlightsPanelProps): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)
  const [groupQuery, setGroupQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const rect = anchorRect ?? new DOMRect(0, 0, 0, 0)
  const left = Math.min(rect.right + 8, window.innerWidth - PANEL_WIDTH - 8)
  const bottom = Math.max(window.innerHeight - rect.bottom, 8)
  // Was a flat 320px cap (main.css), too small once a diagram has enough
  // highlight groups/entries to matter (36 across 5 groups, for example) —
  // grow to whatever room actually exists above the anchor instead, so it's
  // only ever as tall as the window allows, never a fixed guess. The CSS's
  // own overflow-y: auto on .highlights-panel-body already handles
  // scrolling correctly beyond that; it just rarely got exercised before
  // since 320px was hit so rarely.
  const maxHeight = Math.max(window.innerHeight - bottom - 16, 200)

  const catalogIds = new Set(highlights.map(highlightId))
  const availableTags = usedTags.filter((t) => !catalogIds.has(highlightId(t)))
  const filteredTags = availableTags.filter((t) =>
    `${t.key} = ${stringifyValue(t.value)}`.toLowerCase().includes(query.toLowerCase())
  )

  const usedKeys = [...new Set(usedTags.map((t) => t.key))]
  const filteredKeys = usedKeys.filter((k) => k.toLowerCase().includes(groupQuery.toLowerCase()))

  const closeAdd = (): void => {
    setAdding(false)
    setQuery('')
  }
  const closeAddGroup = (): void => {
    setAddingGroup(false)
    setGroupQuery('')
  }
  const toggleCollapsed = (key: string): void => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const groups = groupByKey(highlights)

  return (
    <div className="highlights-panel nodrag nopan" style={{ left, bottom, width: PANEL_WIDTH, maxHeight }}>
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
        {[...groups.entries()].map(([key, members]) => {
          if (members.length === 1) {
            const h = members[0]
            const id = highlightId(h)
            return (
              <HighlightRow
                key={id}
                h={h}
                enabled={enabledIds.has(id)}
                label={`${h.key} = ${stringifyValue(h.value)}`}
                onToggle={() => onToggle(id)}
                onUpdateColor={(color) => onUpdateColor(id, color)}
                onRemove={() => onRemove(id)}
              />
            )
          }
          const memberIds = members.map(highlightId)
          const enabledCount = memberIds.filter((id) => enabledIds.has(id)).length
          const state = enabledCount === 0 ? 'none' : enabledCount === memberIds.length ? 'all' : 'mixed'
          const collapsed = collapsedGroups.has(key)
          return (
            <div key={key} className="highlight-group">
              <div className="highlight-group-header">
                <button
                  type="button"
                  className="highlight-group-collapse"
                  onClick={() => toggleCollapsed(key)}
                  aria-expanded={!collapsed}
                  title={collapsed ? 'Expand' : 'Collapse'}
                >
                  <span className={collapsed ? 'highlight-group-caret' : 'highlight-group-caret open'}>▸</span>
                </button>
                <GroupCheckbox state={state} onChange={() => onToggleGroup(memberIds, state !== 'all')} />
                <span className="highlight-group-title">{key}</span>
                <button
                  type="button"
                  className="highlight-group-resync"
                  title="Resync with current tag values — adds missing ones, removes ones nothing carries anymore"
                  aria-label="Resync group"
                  onClick={() => onAddOrResyncGroup(key)}
                >
                  ↻
                </button>
              </div>
              {!collapsed && (
                <div className="highlight-group-rows">
                  {members.map((h) => {
                    const id = highlightId(h)
                    return (
                      <HighlightRow
                        key={id}
                        h={h}
                        enabled={enabledIds.has(id)}
                        label={stringifyValue(h.value)}
                        onToggle={() => onToggle(id)}
                        onUpdateColor={(color) => onUpdateColor(id, color)}
                        onRemove={() => onRemove(id)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {adding && (
          <div className="highlight-add-picker">
            <input
              className="highlight-add-picker-search"
              placeholder="Search tags…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
            <div className="highlight-add-picker-list">
              {filteredTags.length === 0 && <p className="highlights-panel-hint">No matching tags.</p>}
              {filteredTags.map((t) => (
                <button
                  key={highlightId(t)}
                  type="button"
                  className="highlight-add-picker-item"
                  onClick={() => {
                    onAdd(t.key, t.value, DEFAULT_HIGHLIGHT_COLOR)
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
        )}
        {addingGroup && (
          <div className="highlight-add-picker">
            <input
              className="highlight-add-picker-search"
              placeholder="Search keys…"
              value={groupQuery}
              onChange={(event) => setGroupQuery(event.target.value)}
              autoFocus
            />
            <div className="highlight-add-picker-list">
              {filteredKeys.length === 0 && <p className="highlights-panel-hint">No matching keys.</p>}
              {filteredKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="highlight-add-picker-item"
                  onClick={() => {
                    onAddOrResyncGroup(k)
                    closeAddGroup()
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
            <button type="button" onClick={closeAddGroup}>
              Cancel
            </button>
          </div>
        )}
        {!adding && !addingGroup && (
          <div className="highlight-add-actions">
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
            <button
              type="button"
              className="highlight-add-button"
              onClick={() => setAddingGroup(true)}
              disabled={usedKeys.length === 0}
              title={usedKeys.length === 0 ? 'No tags in use yet' : undefined}
            >
              Add group…
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
