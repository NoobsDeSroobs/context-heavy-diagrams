import type { HighlightDefinition } from '@shared/diagram'

// Rendered when 2+ enabled highlights match the same element (see
// ADR 0025) — one color chip per match, no blending or priority. Purely
// the swatch row itself; positioning it (node corner vs. edge midpoint)
// is each caller's job, same split as IconSlotView/SLOT_CLASS.
export default function HighlightChips({
  highlights
}: {
  highlights: HighlightDefinition[]
}): React.JSX.Element | null {
  if (highlights.length === 0) return null
  return (
    <div
      className="highlight-chips"
      title={highlights.map((h) => `${h.key} = ${String(h.value)}`).join(', ')}
    >
      {highlights.map((h) => (
        <span
          key={`${h.key}:${String(h.value)}`}
          className="highlight-chip"
          style={{ background: h.color }}
        />
      ))}
    </div>
  )
}
