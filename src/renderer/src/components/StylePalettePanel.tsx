import { useState } from 'react'
import type { EdgeStyle, NodeStyle } from '@shared/diagram'
import type { PaletteColor } from '../settings'
import type { Theme } from '../theme'
import { CollapsibleSection, ColorField } from '../panels/fields'
import { themeAdaptiveColor } from '../styles/themeAdaptiveColor'

interface StylePalettePanelProps {
  palette: { colors: PaletteColor[]; fonts: string[] }
  defaultStyles: { shape?: NodeStyle; container?: NodeStyle; text?: NodeStyle }
  defaultEdgeStyle: EdgeStyle
  canvasBackgroundColor: string | undefined
  // Needed to flip the canvas background swatch the same way every other
  // explicit color in this app does (ADR 0034/epic 0040) — this stored
  // value is always a dark-theme baseline, same convention as fill/stroke/
  // fontColor, regardless of which theme is active when it's picked.
  theme: Theme
  onChangePalette: (palette: { colors: PaletteColor[]; fonts: string[] }) => void
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

// Diagram-level? No — global, app-wide preference like SettingsPanel, not
// diagram content (epic 0030/ADR 0048). Same fixed right-side dock shell
// as RequiredTagsPanel/SettingsPanel/DiagnosticsPanel — see ADR 0013.
export default function StylePalettePanel({
  palette,
  defaultStyles,
  defaultEdgeStyle,
  canvasBackgroundColor,
  theme,
  onChangePalette,
  onChangeCanvasBackgroundColor,
  onClearDefault,
  onClose
}: StylePalettePanelProps): React.JSX.Element {
  // Import replaces the whole working copy outright (ADR 0048) — confirmed
  // in-panel first when there's something to lose, not via window.confirm()
  // (see docs/known-issues.md — a native dialog left a different panel's
  // <select> elements unresponsive afterward; avoided here on the same
  // precedent even though this panel has no <select> of its own today).
  const [pendingImport, setPendingImport] = useState<{
    colors: PaletteColor[]
    fonts: string[]
  } | null>(null)

  const handleExport = async (): Promise<void> => {
    const json = JSON.stringify(palette, null, 2)
    await window.api.exportStylePalette(json)
  }

  const handleImport = async (): Promise<void> => {
    const raw = await window.api.importStylePalette()
    if (raw === null) return
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      alert('Not a valid style palette file (not valid JSON).')
      return
    }
    const candidate = parsed as { colors?: unknown; fonts?: unknown }
    if (!Array.isArray(candidate.colors) || !Array.isArray(candidate.fonts)) {
      alert('Not a valid style palette file (missing colors/fonts arrays).')
      return
    }
    const imported = {
      colors: candidate.colors as PaletteColor[],
      fonts: candidate.fonts as string[]
    }
    if (palette.colors.length === 0 && palette.fonts.length === 0) {
      onChangePalette(imported)
      return
    }
    setPendingImport(imported)
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

  return (
    <div className="required-tags-panel">
      <div className="required-tags-panel-toolbar">
        <span className="required-tags-panel-title">Style Palette</span>
        <div className="details-panel-spacer" />
        <button
          type="button"
          onClick={handleExport}
          disabled={palette.colors.length === 0 && palette.fonts.length === 0}
        >
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
        {pendingImport && (
          <div className="required-tag-value-confirm">
            <p>
              Replace the current palette ({palette.colors.length} colors, {palette.fonts.length}{' '}
              fonts) with the imported one ({pendingImport.colors.length} colors,{' '}
              {pendingImport.fonts.length} fonts)?
            </p>
            <div className="required-tag-value-confirm-actions">
              <button
                type="button"
                onClick={() => {
                  onChangePalette(pendingImport)
                  setPendingImport(null)
                }}
              >
                Replace
              </button>
              <button type="button" onClick={() => setPendingImport(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <p className="required-tags-panel-hint">
          Reusable colors and fonts, surfaced as quick-pick options in every color field and the
          Font Family dropdown. Export to a file to share with a team; anyone imports it to get the
          same set locally.
        </p>
        <CollapsibleSection title={`Colors (${palette.colors.length})`} sectionKey="Colors">
          <ColorsEditor
            colors={palette.colors}
            onChange={(colors) => onChangePalette({ ...palette, colors })}
          />
        </CollapsibleSection>
        <CollapsibleSection title={`Fonts (${palette.fonts.length})`} sectionKey="Fonts">
          <FontsEditor
            fonts={palette.fonts}
            onChange={(fonts) => onChangePalette({ ...palette, fonts })}
          />
        </CollapsibleSection>
        <CollapsibleSection title="Canvas background">
          <p className="required-tags-panel-hint">
            Overrides the light/dark theme&rsquo;s default canvas color. Clear to go back to
            following the theme.
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
            it. Edges: use the toolbar swatch next to the file name.
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
