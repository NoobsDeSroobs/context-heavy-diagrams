import { showAlert } from '../alerts'
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import type { EdgeStyle, IconRef, LegendEntry, LegendEntryKind } from '@shared/diagram'
import { loadBuiltinIconSvg, searchBuiltinIconIds } from '../icons/builtinIcons'
import { markerUrl } from '../edges/markerIds'
import type { DirectionSetLegendRow } from '../edges/edgeDirectionSets'
import type { LegendLineLook } from './legendLinePick'
import { EDGE_STYLE_DEFAULTS } from '@shared/styleDefaults'
import { useTheme } from '../theme'
import IconSlotView from '../icons/IconSlotView'
import StylePicker from '../components/StylePicker'

interface LegendPanelProps {
  diagramPath: string | null
  legend: LegendEntry[]
  // The active edge direction set's legend row (ADR 0081), shown pinned
  // above the authored entries. Read-only here — its label is the set name
  // and its swatch is edited in the Edge direction sets section. `null`
  // when the diagram has no direction set.
  directionSetRow: DirectionSetLegendRow | null
  anchorRect: DOMRect | null
  onAdd: (entry: Omit<LegendEntry, 'id'>) => void
  onUpdate: (id: string, patch: Partial<Omit<LegendEntry, 'id'>>) => void
  onRemove: (id: string) => void
  // "Line" copies an edge from the canvas (ADR 0123): the canvas calls `onPicked` with the clicked
  // edge's look, or null if the pick was cancelled there (Esc). `onCancelLinePick` is for this
  // panel ending the wait itself, including when it unmounts.
  onRequestLinePick: (onPicked: (look: LegendLineLook | null) => void) => void
  onCancelLinePick: () => void
  onClose: () => void
}

const PANEL_WIDTH = 300
const DEFAULT_COLOR = '#e6194b'

// Same three dash patterns as LabeledEdge.tsx's own DASH_ARRAY — small
// independent copy, not a shared import, matching this codebase's existing
// precedent for this exact one-liner (see HighlightsPanel's stringifyValue).
const DASH_ARRAY: Record<Exclude<EdgeStyle['lineStyle'], undefined>, string | undefined> = {
  solid: undefined,
  dashed: '8 6',
  dotted: '2 4'
}

const MAX_ICON_RESULTS = 24

// Small swatch previewing what a legend entry actually looks like on
// canvas — a short marked line for 'line', the real icon for 'icon', a
// plain circle (never a box, see ADR 0033) for 'entity'. Sized generously
// (48px for a line) so a dashed/dotted pattern actually reads as dashed
// rather than aliasing into what looks like a solid line at a glance.
function LegendSwatch({
  entry,
  diagramPath
}: {
  entry: LegendEntry
  diagramPath: string | null
}): React.JSX.Element {
  if (entry.kind === 'icon') {
    return (
      <IconSlotView
        icon={entry.icon}
        diagramPath={diagramPath}
        className="legend-swatch legend-swatch-icon"
      />
    )
  }
  if (entry.kind === 'entity') {
    return (
      <span
        className="legend-swatch legend-swatch-dot"
        style={{ background: entry.color ?? 'var(--ev-c-gray-1)' }}
      />
    )
  }
  return (
    <svg className="legend-swatch legend-swatch-line" viewBox="0 0 48 16" width="48" height="16">
      <line
        x1="3"
        y1="8"
        x2="43"
        y2="8"
        // Absent color means "this diagram's default edge look" (same
        // convention as an edge/node with no explicit style — see
        // field-reference.md) — fall back to the real default rather than
        // rendering with no stroke attribute at all, which SVG treats as
        // stroke: none and is genuinely invisible. Found 2026-09-05: a
        // hand-authored legend entry that deliberately omitted color (the
        // in-app "add entry" flow always seeds one, so this never surfaced
        // before) rendered completely blank.
        stroke={entry.color ?? 'var(--xy-edge-stroke-default)'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={entry.lineStyle ? DASH_ARRAY[entry.lineStyle] : undefined}
        markerStart={markerUrl(entry.startMarker)}
        markerEnd={markerUrl(entry.endMarker)}
      />
    </svg>
  )
}

// Compact icon search, deliberately not the full IconPicker component —
// that one's built around assigning an icon to one of an entity's 4 corner
// slots, which has no meaning for a legend entry. Reuses the same
// builtin/custom icon data sources, just without the slot picker.
function LegendIconPicker({
  diagramPath,
  onPick
}: {
  diagramPath: string | null
  onPick: (icon: IconRef) => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [customIcons, setCustomIcons] = useState<string[]>([])
  const [customPreviews, setCustomPreviews] = useState<Record<string, string>>({})

  const results = useMemo(() => searchBuiltinIconIds(query).slice(0, MAX_ICON_RESULTS), [query])

  useEffect(() => {
    let cancelled = false
    for (const id of results) {
      loadBuiltinIconSvg(id)?.then((svg) => {
        if (!cancelled) setPreviews((prev) => ({ ...prev, [id]: svg }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [results])

  useEffect(() => {
    if (!diagramPath) return undefined
    let cancelled = false
    window.api.listCustomIcons(diagramPath).then((paths) => {
      if (cancelled) return
      setCustomIcons(paths)
      for (const path of paths) {
        window.api.readIconAsDataUrl(diagramPath, path).then((url) => {
          if (!cancelled) setCustomPreviews((prev) => ({ ...prev, [path]: url }))
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [diagramPath])

  const handleUpload = async (): Promise<void> => {
    if (!diagramPath) {
      showAlert('Save the diagram before adding a custom icon.')
      return
    }
    const path = await window.api.pickAndCopyCustomIcon(diagramPath)
    if (path) onPick({ source: 'custom', path })
  }

  return (
    <div className="legend-icon-subpicker">
      <input
        className="icon-picker-search"
        placeholder="Search icons…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />
      <div className="icon-picker-scroll">
        <div className="icon-picker-grid">
          {results.map((id) => (
            <button
              key={id}
              type="button"
              title={id}
              onClick={() => onPick({ source: 'builtin', id })}
              dangerouslySetInnerHTML={previews[id] ? { __html: previews[id] } : undefined}
            />
          ))}
        </div>
        {customIcons.length > 0 && (
          <>
            <div className="icon-picker-label">This diagram&apos;s custom icons</div>
            <div className="icon-picker-grid">
              {customIcons.map((path) => (
                <button
                  key={path}
                  type="button"
                  title={path}
                  onClick={() => onPick({ source: 'custom', path })}
                >
                  {customPreviews[path] && <img src={customPreviews[path]} alt="" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <button type="button" onClick={handleUpload}>
        Upload custom icon…
      </button>
    </div>
  )
}

// A draft entry under construction — every field optional until the kind's
// own picker step fills in the kind-specific ones, and label is filled in
// last regardless of kind.
type Draft = Omit<LegendEntry, 'id' | 'label'>

// Small floating panel next to the canvas's bottom-left <Controls> widget
// — deliberately not the right-side UtilityDock shell every other panel
// (Highlights/Required tags/Diagnostics/Settings) uses, see ADR 0033. No
// per-entry enabled state here (unlike HighlightsPanel) — the whole panel's
// shown/hidden state is what's session-local, not anything per-row.
export default function LegendPanel({
  diagramPath,
  legend,
  directionSetRow,
  anchorRect,
  onAdd,
  onUpdate,
  onRemove,
  onRequestLinePick,
  onCancelLinePick,
  onClose
}: LegendPanelProps): React.JSX.Element {
  const { theme } = useTheme()
  const [pickingKind, setPickingKind] = useState(false)
  const [pickingLine, setPickingLine] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [label, setLabel] = useState('')
  const [linePickerAnchor, setLinePickerAnchor] = useState<DOMRect | null>(null)

  useEffect(() => onCancelLinePick, [onCancelLinePick])

  // The colour a line entry with no colour of its own is drawn in, so its colour input starts on
  // what the swatch shows rather than on an unrelated red.
  const defaultColorFor = (kind: LegendEntryKind): string =>
    kind === 'line' ? EDGE_STYLE_DEFAULTS.stroke[theme] : DEFAULT_COLOR

  const rect = anchorRect ?? new DOMRect(0, 0, 0, 0)
  const left = Math.min(rect.right + 8, window.innerWidth - PANEL_WIDTH - 8)
  const bottom = Math.max(window.innerHeight - rect.bottom, 8)

  const resetDraft = (): void => {
    setPickingKind(false)
    setDraft(null)
    setLabel('')
    setLinePickerAnchor(null)
  }

  const cancelLinePick = (): void => {
    onCancelLinePick()
    setPickingLine(false)
  }

  // The fallback for a diagram with no edge to copy: the named line-style presets.
  const choosePreset = (event: MouseEvent<HTMLButtonElement>): void => {
    cancelLinePick()
    setLinePickerAnchor(event.currentTarget.getBoundingClientRect())
    setDraft({ kind: 'line', color: DEFAULT_COLOR })
  }

  const startKind = (kind: LegendEntryKind): void => {
    setPickingKind(false)
    if (kind === 'line') {
      setPickingLine(true)
      onRequestLinePick((look) => {
        setPickingLine(false)
        if (look) setDraft({ kind: 'line', ...look })
      })
      return
    }
    if (kind === 'entity') {
      setDraft({ kind, color: DEFAULT_COLOR })
      return
    }
    setDraft({ kind }) // 'icon' — waits for LegendIconPicker below
  }

  const confirmAdd = (): void => {
    if (!draft || !label.trim()) return
    onAdd({ ...draft, label: label.trim() })
    resetDraft()
  }

  return (
    <div className="legend-panel nodrag nopan" style={{ left, bottom, width: PANEL_WIDTH }}>
      <div className="legend-panel-toolbar">
        <span className="legend-panel-title">Legend</span>
        <div className="details-panel-spacer" />
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="legend-panel-body">
        {legend.length === 0 && !directionSetRow && !draft && !pickingKind && !pickingLine && (
          <p className="legend-panel-hint">No legend entries yet.</p>
        )}
        {directionSetRow && (
          <div className="legend-row legend-row-pinned" title="Active edge direction set">
            <span className="legend-swatch-slot">
              <LegendSwatch
                entry={{
                  id: '__direction-set',
                  kind: 'line',
                  label: directionSetRow.label,
                  color: directionSetRow.color,
                  lineStyle: directionSetRow.lineStyle,
                  startMarker: directionSetRow.startMarker,
                  endMarker: directionSetRow.endMarker
                }}
                diagramPath={diagramPath}
              />
            </span>
            <span className="legend-row-label">{directionSetRow.label}</span>
          </div>
        )}
        {legend.map((entry) => (
          <div key={entry.id} className="legend-row">
            <span className="legend-swatch-slot">
              <LegendSwatch entry={entry} diagramPath={diagramPath} />
              {entry.kind !== 'icon' && (
                // Invisible overlay, not a separate visible color box —
                // clicking anywhere on the swatch itself edits its color,
                // reclaiming the row width a dedicated color input used to
                // take (a follow-up sizing fix).
                <input
                  type="color"
                  className="legend-swatch-color-overlay"
                  value={entry.color ?? defaultColorFor(entry.kind)}
                  onChange={(event) => onUpdate(entry.id, { color: event.target.value })}
                  title="Change color"
                  aria-label="Change color"
                />
              )}
            </span>
            <span className="legend-row-label">{entry.label}</span>
            <button
              type="button"
              className="legend-row-remove"
              title="Remove"
              aria-label="Remove"
              onClick={() => onRemove(entry.id)}
            >
              ×
            </button>
          </div>
        ))}

        {!draft && !pickingKind && !pickingLine && (
          <button type="button" className="legend-add-button" onClick={() => setPickingKind(true)}>
            Add legend entry
          </button>
        )}

        {pickingLine && (
          <>
            <p className="legend-panel-hint">
              Click an edge in the diagram to copy its line. Esc cancels.
            </p>
            <div className="legend-kind-picker">
              <button type="button" onClick={choosePreset}>
                Choose a preset…
              </button>
              <button type="button" onClick={cancelLinePick}>
                Cancel
              </button>
            </div>
          </>
        )}

        {pickingKind && (
          <div className="legend-kind-picker">
            <button type="button" onClick={() => startKind('line')}>
              Line
            </button>
            <button type="button" onClick={() => startKind('icon')}>
              Icon
            </button>
            <button type="button" onClick={() => startKind('entity')}>
              Color
            </button>
            <button type="button" onClick={resetDraft}>
              Cancel
            </button>
          </div>
        )}

        {linePickerAnchor && draft?.kind === 'line' && draft.lineStyle === undefined && (
          <StylePicker
            anchorRect={linePickerAnchor}
            onPick={(patch) => {
              setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
              setLinePickerAnchor(null)
            }}
            onClose={resetDraft}
          />
        )}

        {draft?.kind === 'icon' && !draft.icon && (
          <LegendIconPicker
            diagramPath={diagramPath}
            onPick={(icon) => setDraft((prev) => (prev ? { ...prev, icon } : prev))}
          />
        )}

        {draft &&
          (draft.kind !== 'line' || draft.lineStyle !== undefined) &&
          (draft.kind !== 'icon' || draft.icon) && (
            <div className="legend-draft-form">
              {draft.kind === 'line' && (
                <span className="legend-swatch-slot">
                  <LegendSwatch
                    entry={{ id: '__draft', label: '', ...draft }}
                    diagramPath={diagramPath}
                  />
                </span>
              )}
              {draft.kind !== 'icon' && (
                <label className="legend-draft-color">
                  Color
                  <input
                    type="color"
                    value={draft.color ?? defaultColorFor(draft.kind)}
                    onChange={(event) =>
                      setDraft((prev) => (prev ? { ...prev, color: event.target.value } : prev))
                    }
                  />
                </label>
              )}
              <input
                className="legend-draft-label"
                placeholder="What does this mean?"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                autoFocus
              />
              <div className="legend-draft-actions">
                <button type="button" onClick={confirmAdd} disabled={!label.trim()}>
                  Add
                </button>
                <button type="button" onClick={resetDraft}>
                  Cancel
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  )
}
