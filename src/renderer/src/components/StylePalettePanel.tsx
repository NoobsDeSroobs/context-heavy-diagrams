import { showAlert } from '../alerts'
import { useState } from 'react'
import type { EdgeStyle, NodeStyle } from '@shared/diagram'
import type { NamedStylePalette, PaletteColor } from '../preferences'
import type { Theme } from '../theme'
import { CollapsibleSection, ColorField } from '../panels/fields'
import { themeAdaptiveColor } from '../styles/themeAdaptiveColor'

interface StylePalettePanelProps {
  palettes: NamedStylePalette[]
  activePaletteId: string | null
  defaultStyles: { shape?: NodeStyle; container?: NodeStyle; text?: NodeStyle }
  defaultEdgeStyle: EdgeStyle
  canvasBackgroundColor: string | undefined
  // Needed to flip the canvas background swatch the same way every other
  // explicit color in this app does (ADR 0034) — this stored
  // value is always a dark-theme baseline, same convention as fill/stroke/
  // fontColor, regardless of which theme is active when it's picked.
  theme: Theme
  // Every palette-collection mutation (edit colors/fonts of the active one,
  // rename, create, duplicate, delete, import) goes through this single
  // callback — Canvas.tsx just does updateSettings({ stylePalettes,
  // activeStylePaletteId }), all the array work lives here.
  onChangePalettes: (palettes: NamedStylePalette[], activePaletteId: string | null) => void
  onChangeCanvasBackgroundColor: (value: string | undefined) => void
  onClearDefault: (type: 'shape' | 'container' | 'text' | 'edge') => void
  onClose: () => void
}

const DEFAULT_SWATCH_COLOR = '#808080'
const TYPE_LABELS: Record<'shape' | 'container' | 'text' | 'edge', string> = {
  shape: 'Shape',
  container: 'Container',
  text: 'Text',
  edge: 'Edge'
}

function newPaletteId(): string {
  return `palette-${crypto.randomUUID()}`
}

// Keep the palette dropdown unambiguous — a fresh "New palette" or a
// "<name> copy" that collides with an existing name gets a numeric suffix.
function uniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base
  let n = 2
  while (existing.includes(`${base} ${n}`)) n++
  return `${base} ${n}`
}

function ColorRow({
  color,
  onCommitLabel,
  onChangeValue,
  onRemove
}: {
  color: PaletteColor
  onCommitLabel: (label: string) => void
  onChangeValue: (value: string) => void
  onRemove: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(color.label)
  return (
    <div className="style-palette-color-row">
      <input
        type="color"
        className="property-color-swatch"
        value={color.value}
        onChange={(event) => onChangeValue(event.target.value)}
      />
      <input
        className="style-palette-color-label"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const trimmed = draft.trim()
          if (trimmed && trimmed !== color.label) onCommitLabel(trimmed)
          else setDraft(color.label)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
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

function ColorsEditor({
  colors,
  onChange
}: {
  colors: PaletteColor[]
  onChange: (colors: PaletteColor[]) => void
}): React.JSX.Element {
  const [newLabel, setNewLabel] = useState('')
  return (
    <div className="required-tag-values-list">
      {colors.map((c, index) => (
        <ColorRow
          key={index}
          color={c}
          onCommitLabel={(label) =>
            onChange(colors.map((entry, i) => (i === index ? { ...entry, label } : entry)))
          }
          onChangeValue={(value) =>
            onChange(colors.map((entry, i) => (i === index ? { ...entry, value } : entry)))
          }
          onRemove={() => onChange(colors.filter((_, i) => i !== index))}
        />
      ))}
      <div className="required-tag-value-row required-tag-value-row-new">
        <input
          className="required-tag-value-input"
          placeholder="Add color…"
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          onBlur={() => {
            const trimmed = newLabel.trim()
            setNewLabel('')
            if (trimmed) onChange([...colors, { label: trimmed, value: DEFAULT_SWATCH_COLOR }])
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </div>
    </div>
  )
}

function FontsEditor({
  fonts,
  onChange
}: {
  fonts: string[]
  onChange: (fonts: string[]) => void
}): React.JSX.Element {
  const [newFont, setNewFont] = useState('')
  return (
    <div className="required-tag-values-list">
      {fonts.map((font, index) => (
        <div key={index} className="required-tag-value-row">
          <span className="style-palette-font-preview" style={{ fontFamily: font }}>
            {font}
          </span>
          <button
            type="button"
            className="required-tag-value-remove"
            title="Remove"
            aria-label="Remove"
            onClick={() => onChange(fonts.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <div className="required-tag-value-row required-tag-value-row-new">
        <input
          className="required-tag-value-input"
          placeholder="Add font (CSS font-family value)…"
          value={newFont}
          onChange={(event) => setNewFont(event.target.value)}
          onBlur={() => {
            const trimmed = newFont.trim()
            setNewFont('')
            if (trimmed && !fonts.includes(trimmed)) onChange([...fonts, trimmed])
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </div>
    </div>
  )
}

// Inline rename field for the active palette — same commit-on-blur/Enter
// shape as ColorRow's label, keyed by id so switching palettes reseeds it.
function PaletteNameField({
  palette,
  onRename
}: {
  palette: NamedStylePalette
  onRename: (name: string) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(palette.name)
  return (
    <input
      key={palette.id}
      className="style-palette-name-input"
      value={draft}
      aria-label="Palette name"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const trimmed = draft.trim()
        if (trimmed && trimmed !== palette.name) onRename(trimmed)
        else setDraft(palette.name)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}

// Diagram-level? No — global, app-wide preference like PreferencesPanel, not
// diagram content (ADR 0048, reshaped into a named collection by
// ADR 0068). Same fixed right-side dock shell as RequiredTags/
// PreferencesPanel/DiagnosticsPanel — see ADR 0013.
export default function StylePalettePanel({
  palettes,
  activePaletteId,
  defaultStyles,
  defaultEdgeStyle,
  canvasBackgroundColor,
  theme,
  onChangePalettes,
  onChangeCanvasBackgroundColor,
  onClearDefault,
  onClose
}: StylePalettePanelProps): React.JSX.Element {
  // Deleting a non-empty palette is the one destructive action here —
  // confirmed in-panel first (not window.confirm(), which left a sibling
  // panel's <select> unresponsive once, see docs/known-issues.md).
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const active = palettes.find((p) => p.id === activePaletteId) ?? palettes[0] ?? null
  const names = palettes.map((p) => p.name)

  // Any switch of which palette is active abandons a pending delete
  // confirmation — otherwise the confirm card, which reads `active`, would
  // silently retarget the palette you just switched to.
  const selectActive = (id: string): void => {
    setConfirmingDelete(false)
    onChangePalettes(palettes, id)
  }

  const updateActive = (patch: Partial<Pick<NamedStylePalette, 'colors' | 'fonts' | 'name'>>): void => {
    if (!active) return
    onChangePalettes(
      palettes.map((p) => (p.id === active.id ? { ...p, ...patch } : p)),
      activePaletteId
    )
  }

  const createPalette = (mode: 'empty' | 'duplicate'): void => {
    setConfirmingDelete(false)
    const id = newPaletteId()
    const base =
      mode === 'duplicate' && active
        ? { name: `${active.name} copy`, colors: [...active.colors], fonts: [...active.fonts] }
        : { name: 'New palette', colors: [] as PaletteColor[], fonts: [] as string[] }
    onChangePalettes([...palettes, { id, ...base, name: uniqueName(base.name, names) }], id)
  }

  const deleteActive = (): void => {
    if (!active) return
    const remaining = palettes.filter((p) => p.id !== active.id)
    onChangePalettes(remaining, remaining[0]?.id ?? null)
    setConfirmingDelete(false)
  }

  const handleExport = async (): Promise<void> => {
    if (!active) return
    // File shape stays the bare { colors, fonts } — no id/name — so
    // palettes exported by any version stay interchangeable.
    const json = JSON.stringify({ colors: active.colors, fonts: active.fonts }, null, 2)
    await window.api.exportStylePalette(json)
  }

  const handleImport = async (): Promise<void> => {
    const result = await window.api.importStylePalette()
    if (result === null) return
    setConfirmingDelete(false)
    let parsed: unknown
    try {
      parsed = JSON.parse(result.content)
    } catch {
      showAlert('Not a valid style palette file (not valid JSON).')
      return
    }
    const candidate = parsed as { colors?: unknown; fonts?: unknown }
    if (!Array.isArray(candidate.colors) || !Array.isArray(candidate.fonts)) {
      showAlert('Not a valid style palette file (missing colors/fonts arrays).')
      return
    }
    // Import adds a new named palette (ADR 0068) rather than overwriting —
    // that's the whole point of keeping several around. Name seeded from
    // the file name, editable inline afterwards.
    const id = newPaletteId()
    onChangePalettes(
      [
        ...palettes,
        {
          id,
          name: uniqueName(result.name || 'Imported palette', names),
          colors: candidate.colors as PaletteColor[],
          fonts: candidate.fonts as string[]
        }
      ],
      id
    )
  }

  const defaultRows: {
    type: 'shape' | 'container' | 'text' | 'edge'
    style: NodeStyle | EdgeStyle | undefined
  }[] = [
    { type: 'shape', style: defaultStyles.shape },
    { type: 'container', style: defaultStyles.container },
    { type: 'text', style: defaultStyles.text },
    { type: 'edge', style: Object.keys(defaultEdgeStyle).length > 0 ? defaultEdgeStyle : undefined }
  ]

  const activeEmpty = !active || (active.colors.length === 0 && active.fonts.length === 0)

  return (
    <div className="required-tags-panel">
      <div className="required-tags-panel-toolbar">
        <span className="required-tags-panel-title">Style Palette</span>
        <div className="details-panel-spacer" />
        <button type="button" onClick={handleExport} disabled={activeEmpty}>
          Export…
        </button>
        <button type="button" onClick={handleImport}>
          Import…
        </button>
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="required-tags-panel-body">
        <div className="style-palette-picker">
          <select
            className="style-palette-select"
            aria-label="Active palette"
            value={active?.id ?? ''}
            onChange={(event) => selectActive(event.target.value)}
          >
            {palettes.length === 0 && <option value="">No palettes</option>}
            {palettes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {active && <PaletteNameField palette={active} onRename={(name) => updateActive({ name })} />}
          <div className="style-palette-picker-actions">
            <button type="button" onClick={() => createPalette('empty')}>
              New
            </button>
            <button type="button" disabled={!active} onClick={() => createPalette('duplicate')}>
              Duplicate
            </button>
            <button
              type="button"
              disabled={palettes.length <= 1}
              onClick={() => (activeEmpty ? deleteActive() : setConfirmingDelete(true))}
            >
              Delete
            </button>
          </div>
        </div>
        {confirmingDelete && active && (
          <div className="required-tag-value-confirm">
            <p>
              Delete the &ldquo;{active.name}&rdquo; palette ({active.colors.length} colors,{' '}
              {active.fonts.length} fonts)? This can&rsquo;t be undone.
            </p>
            <div className="required-tag-value-confirm-actions">
              <button type="button" onClick={deleteActive}>
                Delete
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <p className="required-tags-panel-hint">
          Reusable colors and fonts, surfaced as quick-pick options in every color field and the
          Font Family dropdown. Keep several named palettes around and switch which one is active;
          export one to a file to share with a team.
        </p>
        {active ? (
          <>
            <CollapsibleSection title={`Colors (${active.colors.length})`} sectionKey="Colors">
              <ColorsEditor
                colors={active.colors}
                onChange={(colors) => updateActive({ colors })}
              />
            </CollapsibleSection>
            <CollapsibleSection title={`Fonts (${active.fonts.length})`} sectionKey="Fonts">
              <FontsEditor fonts={active.fonts} onChange={(fonts) => updateActive({ fonts })} />
            </CollapsibleSection>
          </>
        ) : (
          <p className="required-tags-panel-hint">
            No palette yet — create one with &ldquo;New&rdquo; or import one to add colors and
            fonts.
          </p>
        )}
        <CollapsibleSection title="Canvas background">
          <p className="required-tags-panel-hint">
            Overrides the light/dark theme&rsquo;s default canvas color. Clear to go back to
            following the theme. Global, not per-palette.
          </p>
          <ColorField
            label="Background"
            value={themeAdaptiveColor(canvasBackgroundColor, theme)}
            mixed={false}
            onChange={(v) => onChangeCanvasBackgroundColor(themeAdaptiveColor(v, theme))}
            onSessionStart={() => {}}
            onSessionEnd={() => {}}
          />
        </CollapsibleSection>
        <CollapsibleSection title="Defaults for new elements">
          <p className="required-tags-panel-hint">
            Style a shape/container/text exactly how you want using the property panel, then use its
            &ldquo;Set as default style&rdquo; button — new elements of that type will start with
            it. Edges: use the toolbar swatch next to the file name. Global, not per-palette.
          </p>
          <div className="style-palette-defaults-list">
            {defaultRows.map(({ type, style }) => (
              <div key={type} className="style-palette-defaults-row">
                <span>{TYPE_LABELS[type]}</span>
                <span className="style-palette-defaults-status">{style ? 'Set' : 'Not set'}</span>
                <button type="button" disabled={!style} onClick={() => onClearDefault(type)}>
                  Clear
                </button>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  )
}
