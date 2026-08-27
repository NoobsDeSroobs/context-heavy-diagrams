// Canonical definition moved to @shared/settings (ADR 0053) —
// main also needs the full AppSettings shape now, and this is one of its
// fields. Re-exported here (a bare `export type { X } from '...'` doesn't
// also bind X locally, hence the separate `import type` below) so nothing
// importing it from this module (ExportPngDialog.tsx, exportPng.ts) needed
// to change.
import type { LegendCorner } from '@shared/settings'
export type { LegendCorner }

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export interface LegendPlacement {
  position: { x: number; y: number }
  bounds: Rect
}

// Places the legend in one corner of `bounds` (the diagram's own content
// bounding box), insetted by `margin`. Legend size is never shrunk to fit
// — the user's own framing, after seeing the first pass: "make sure the
// legend grows to make the content readable, that is most important."
// If the corner's existing space is free of every obstacle (every node's
// own bounds, plus a coarse per-edge bounding box — see exportPng.ts),
// the legend just slots into that empty space and the image size is
// unchanged (avoids the "wasteful" case the user flagged: don't grow the
// canvas just because a corner *could* need it). If that space doesn't
// exist or is occupied, `bounds` grows outward from that same corner by
// exactly the legend's own footprint (plus margin) — a dedicated new
// strip, not a search for a smaller gap elsewhere, so the result is
// always either "free space already there" or "guaranteed-empty new
// space," never a placement that might still clip something.
export function placeLegend(
  bounds: Rect,
  legendSize: { width: number; height: number },
  corner: LegendCorner,
  margin: number,
  obstacles: Rect[]
): LegendPlacement {
  const left = corner.endsWith('left')
  const top = corner.startsWith('top')

  const candidate: Rect = {
    x: left ? bounds.x + margin : bounds.x + bounds.width - legendSize.width - margin,
    y: top ? bounds.y + margin : bounds.y + bounds.height - legendSize.height - margin,
    width: legendSize.width,
    height: legendSize.height
  }

  const fits =
    legendSize.width + margin * 2 <= bounds.width && legendSize.height + margin * 2 <= bounds.height
  const collides = obstacles.some((o) => rectsOverlap(candidate, o))

  if (fits && !collides) {
    return { position: { x: candidate.x, y: candidate.y }, bounds }
  }

  const requiredWidth = legendSize.width + margin * 2
  const extraWidth = requiredWidth > bounds.width ? requiredWidth - bounds.width : 0
  const extraHeight = legendSize.height + margin * 2

  const newBounds: Rect = {
    x: left ? bounds.x - extraWidth : bounds.x,
    y: top ? bounds.y - extraHeight : bounds.y,
    width: bounds.width + extraWidth,
    height: bounds.height + extraHeight
  }
  const position = {
    x: left ? newBounds.x + margin : newBounds.x + newBounds.width - legendSize.width - margin,
    y: top ? newBounds.y + margin : newBounds.y + newBounds.height - legendSize.height - margin
  }
  return { position, bounds: newBounds }
}
