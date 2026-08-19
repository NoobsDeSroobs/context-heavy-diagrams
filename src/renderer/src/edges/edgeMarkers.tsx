import { MARKER_ID } from './markerIds'

// Custom SVG <marker> defs for the full MarkerKind set — see ADR 0014.
// React Flow's own MarkerType only covers plain/closed arrows, so anything
// beyond that (circles, diamonds, crow's-foot) needs hand-drawn markers
// referenced by id, same mechanism RF's own built-ins use under the hood.
//
// Every shape is drawn pointing toward +x (the node the edge connects to)
// with its "attachment" point (where it meets the node boundary) at the
// marker's own refX — orient="auto-start-reverse" then handles both ends:
// it points forward for markerEnd and auto-flips 180° for markerStart, so
// one definition serves both.
//
// fill/stroke use the CSS context-fill/context-stroke keywords (supported
// since Chromium 121 — this project ships Electron 43, well past that) to
// inherit the referencing path's own stroke color, so there's no need for
// one marker per color.
//
// Deliberately approximate, not pixel-correct ERD/UML notation — see ADR
// 0014's Notes on why the exact notation-base question is out of scope for
// this pass. These just need to be recognizably the right *shape*. See
// markerIds.ts for the id map and the url(#id) helper LabeledEdge uses.

const STROKE = { fill: 'none', stroke: 'context-stroke', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const FILLED = { fill: 'context-stroke', stroke: 'none' }

// Rendered once, globally — see Canvas.tsx. Zero-size and non-interactive;
// only exists so <marker> ids are resolvable from any edge's marker-end/
// marker-start attribute (SVG marker id references resolve document-wide,
// not just within the same <svg>).
export default function EdgeMarkerDefs(): React.JSX.Element {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
      <defs>
        <marker id={MARKER_ID.arrowOpen} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M1,1 L8,5 L1,9" {...STROKE} />
        </marker>
        <marker id={MARKER_ID.arrowClosed} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M1,1 L9,5 L1,9 Z" {...FILLED} />
        </marker>
        <marker id={MARKER_ID.circle} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <circle cx="5" cy="5" r="3" {...STROKE} />
        </marker>
        <marker id={MARKER_ID.circleFilled} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <circle cx="5" cy="5" r="3" {...FILLED} />
        </marker>
        <marker id={MARKER_ID.diamond} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="8" orient="auto-start-reverse">
          <path d="M1,5 L5,1 L9,5 L5,9 Z" {...STROKE} />
        </marker>
        <marker id={MARKER_ID.diamondFilled} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="8" orient="auto-start-reverse">
          <path d="M1,5 L5,1 L9,5 L5,9 Z" {...FILLED} />
        </marker>
        <marker id={MARKER_ID.crowsFootOne} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="8" orient="auto-start-reverse">
          <path d="M6,1 L6,9" {...STROKE} />
        </marker>
        <marker id={MARKER_ID.crowsFootMany} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M9,5 L1,1 M9,5 L1,5 M9,5 L1,9" {...STROKE} />
        </marker>
        <marker id={MARKER_ID.crowsFootOneOrMany} viewBox="0 0 14 10" refX="13" refY="5" markerWidth="11" markerHeight="8" orient="auto-start-reverse">
          <path d="M13,5 L5,1 M13,5 L5,5 M13,5 L5,9 M3,1 L3,9" {...STROKE} />
        </marker>
        <marker id={MARKER_ID.crowsFootZeroOrOne} viewBox="0 0 12 10" refX="9" refY="5" markerWidth="9.6" markerHeight="8" orient="auto-start-reverse">
          <path d="M9,1 L9,9" {...STROKE} />
          <circle cx="4.5" cy="5" r="3" {...STROKE} />
        </marker>
        <marker id={MARKER_ID.crowsFootZeroOrMany} viewBox="0 0 14 10" refX="13" refY="5" markerWidth="11" markerHeight="8" orient="auto-start-reverse">
          <path d="M13,5 L7,1 M13,5 L7,5 M13,5 L7,9" {...STROKE} />
          <circle cx="3.5" cy="5" r="3" {...STROKE} />
        </marker>
      </defs>
    </svg>
  )
}
