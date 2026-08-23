import { useEffect, useRef, useState } from 'react'
import { FieldRow, NumberField } from '../panels/fields'
import type { LegendCorner } from '../export/exportLegendPlacement'

export interface PngExportChoice {
  paddingPx: number
  transparentBackground: boolean
  backgroundColorOverride?: string
  legendCorner: LegendCorner
}

interface ExportPngDialogProps {
  initial: PngExportChoice
  // The real, resolved canvas background color (#rrggbb) at the moment
  // this dialog opened — previews what "use canvas color" (no override)
  // will actually export, instead of a hardcoded placeholder. See
  // exportPng.ts's resolveEffectiveBackgroundColor/rgbStringToHex.
  effectiveCanvasColorHex: string
  // Whether there's currently anything for the legend to show (diagram
  // Legend entries, or any enabled highlight) — hides the corner picker
  // rather than offering a choice that would place nothing.
  hasLegendContent: boolean
  onConfirm: (choice: PngExportChoice) => void
  onClose: () => void
}

// Epic 0010/ADR 0051 (revised 2026-08-23 after live feedback: the first
// pass put padding/transparency in the global Settings panel instead of
// here, on the theory they'd rarely change export-to-export — wrong in
// practice, the user expected a dialog). Reuses AboutDialog's centered-
// overlay shell (about-dialog-*) and RequiredTagsPanel's confirm-row
// button styling (required-tag-value-confirm-actions) rather than
// introducing new CSS for a shape both already have.
export default function ExportPngDialog({
  initial,
  effectiveCanvasColorHex,
  hasLegendContent,
  onConfirm,
  onClose
}: ExportPngDialogProps): React.JSX.Element {
  const [paddingPx, setPaddingPx] = useState(initial.paddingPx)
  const [transparentBackground, setTransparentBackground] = useState(initial.transparentBackground)
  const [backgroundColorOverride, setBackgroundColorOverride] = useState(
    initial.backgroundColorOverride
  )
  const [legendCorner, setLegendCorner] = useState(initial.legendCorner)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div className="about-dialog-overlay">
      <div ref={dialogRef} className="about-dialog">
        <div className="about-dialog-toolbar">
          <span className="about-dialog-title">Export as PNG</span>
          <button type="button" title="Close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="about-dialog-body">
          <NumberField
            label="Padding (px)"
            value={paddingPx}
            mixed={false}
            min={0}
            onChange={(v) => setPaddingPx(v ?? 0)}
            onSessionStart={() => {}}
            onSessionEnd={() => {}}
          />
          <FieldRow label="Transparent background">
            <input
              type="checkbox"
              checked={transparentBackground}
              onChange={(e) => setTransparentBackground(e.target.checked)}
            />
          </FieldRow>
          {!transparentBackground && (
            <FieldRow label="Background color">
              <input
                type="color"
                className="property-color-swatch"
                value={backgroundColorOverride ?? effectiveCanvasColorHex}
                onChange={(e) => setBackgroundColorOverride(e.target.value)}
                title="Override the exported background color, instead of using the canvas's own background"
              />
              {backgroundColorOverride && (
                <button type="button" onClick={() => setBackgroundColorOverride(undefined)}>
                  Use canvas color
                </button>
              )}
            </FieldRow>
          )}
          {hasLegendContent && (
            <FieldRow label="Legend corner">
              <select
                value={legendCorner}
                onChange={(e) => setLegendCorner(e.target.value as LegendCorner)}
              >
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-right">Bottom right</option>
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
              </select>
            </FieldRow>
          )}
          <div className="required-tag-value-confirm-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                onConfirm({
                  paddingPx,
                  transparentBackground,
                  backgroundColorOverride,
                  legendCorner
                })
              }
            >
              Export…
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
