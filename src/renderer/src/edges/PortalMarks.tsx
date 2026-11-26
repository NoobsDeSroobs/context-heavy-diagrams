import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  PORTAL_COLOR,
  PORTAL_MARK_WIDTH,
  PORTAL_OVAL,
  PORTAL_TILDE_PATH,
  markTransform,
  numberPoint,
  type PortalMarkKind,
  type PortalSplit
} from '@shared/portals/portals'
import type { Theme } from '../styling/theme'

// The two ends of a portal's gap (ADR 0185's gates are the other thing drawn on an edge like this):
// a mark and the number at each. The oval at the exit is drawn under the edge, so the line comes out
// of it, and the oval at the entry over it, so the line goes into it; everything else is drawn over.
export default function PortalMarks({
  split,
  kind,
  number,
  theme,
  layer,
  hot,
  onPointerDown,
  onHover
}: {
  split: PortalSplit
  kind: PortalMarkKind
  number: number
  theme: Theme
  layer: 'under' | 'over'
  hot: boolean
  // Absent in the read-only compare window, where a mark cannot be moved.
  onPointerDown?: (event: ReactPointerEvent<SVGGElement>, which: 'start' | 'end') => void
  onHover: (on: boolean) => void
}): React.JSX.Element | null {
  const color = PORTAL_COLOR[theme]
  const width = hot ? PORTAL_MARK_WIDTH + 1 : PORTAL_MARK_WIDTH
  const ends = [
    { which: 'start' as const, mark: split.entry, towardsGap: 1 as const },
    { which: 'end' as const, mark: split.exit, towardsGap: -1 as const }
  ]
  if (kind === 'oval' && layer === 'under') {
    const { mark } = ends[1]
    return (
      <g
        className="edge-portal-mark nodrag nopan"
        transform={markTransform(mark, 'oval')}
        onPointerDown={onPointerDown && ((e) => onPointerDown(e, 'end'))}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <ellipse
          rx={PORTAL_OVAL.rx}
          ry={PORTAL_OVAL.ry}
          className="edge-portal-oval"
          stroke={color}
        />
        <circle r={15} className="edge-portal-hit" />
      </g>
    )
  }
  if (layer === 'under') return null
  return (
    <>
      {ends.map(({ which, mark, towardsGap }) => {
        const at = numberPoint(mark, towardsGap)
        return (
          <g
            key={which}
            className="edge-portal-mark nodrag nopan"
            onPointerDown={onPointerDown && ((e) => onPointerDown(e, which))}
            onPointerEnter={() => onHover(true)}
            onPointerLeave={() => onHover(false)}
          >
            <g transform={markTransform(mark, kind)}>
              {kind === 'tilde' ? (
                <path
                  d={PORTAL_TILDE_PATH}
                  className="edge-portal-tilde"
                  stroke={color}
                  strokeWidth={width}
                />
              ) : (
                // The exit oval is drawn in the layer under; only the entry one is over the edge.
                which === 'start' && (
                  <ellipse
                    rx={PORTAL_OVAL.rx}
                    ry={PORTAL_OVAL.ry}
                    className="edge-portal-oval"
                    stroke={color}
                    strokeWidth={hot ? 3 : 2}
                  />
                )
              )}
              <circle r={15} className="edge-portal-hit" />
            </g>
            <text x={at.x} y={at.y} textAnchor="middle" className="edge-portal-number" fill={color}>
              {number}
            </text>
          </g>
        )
      })}
    </>
  )
}
