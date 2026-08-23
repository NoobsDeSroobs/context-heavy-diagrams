import type { ScaleLevel } from './threatMatrixScale'

function ScaleList({ title, levels }: { title: string; levels: ScaleLevel[] }): React.JSX.Element {
  return (
    <div className="threat-matrix-scale-group">
      <h3 className="threat-matrix-scale-title">{title}</h3>
      <ul className="threat-matrix-scale-list">
        {levels.map((level) => (
          <li key={level.value}>
            <strong>
              {level.value} — {level.label}
            </strong>
            <span>{level.description}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Reference panel for whoever is filling in the matrix — so the meaning
// of "3" isn't left to memory or guesswork. Not configurable yet (see
// threatMatrixScale.ts); just a read-only rendering of whatever scale is
// currently defined there.
export default function ThreatMatrixScaleReference({
  probabilityScale,
  consequenceScale
}: {
  probabilityScale: ScaleLevel[]
  consequenceScale: ScaleLevel[]
}): React.JSX.Element {
  return (
    <div className="threat-matrix-scale-reference">
      <ScaleList title="Probability" levels={probabilityScale} />
      <ScaleList title="Consequence" levels={consequenceScale} />
    </div>
  )
}
