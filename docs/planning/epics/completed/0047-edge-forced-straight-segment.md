# 0047: Forced straight segment near edge endpoints

## Status
Done (2026-08-21).

## Goal
Force every edge to travel straight outward from each endpoint for a configurable number of pixels (the user's own suggestion: 5-10px, adjustable in an options/settings menu) before curving toward the other end — rather than curving immediately from the connection point, which reads badly for steep inclines or near-horizontal connections. A default-routing improvement, not manual control over the whole path.

## Relevant existing behavior
Every edge was a single path computed end-to-end by React Flow's `getBezierPath` (`LabeledEdge.tsx`) — no concept of a forced initial straight run at either end.

## Relationship to epic 0032 (edge routing/waypoints)
Kept separate, as originally planned: this is an always-on default rendering behavior with one global number, not per-edge manual authoring. See that epic's own notes for the cross-reference back to this one's `buildEdgePath` as reusable groundwork for a shared piecewise-path mechanism.

## Design decisions made while building
- **Where the setting lives**: not a one-off toolbar popup as first proposed — the user pushed back and asked for a real, general-purpose Settings panel, started now with this as its first entry. See [ADR 0032](../../../decisions/0032-global-settings-panel.md) for the full reasoning (reuses the existing `UtilityDock` panel pattern, `localStorage`-backed, extensible for future settings).
- **Default/range**: 8px, a single global number (`AppSettings.edgeStraightSegmentLength`) applying to every edge in every diagram — not per-edge, not per-diagram. `0` means off (today's old behavior, unchanged).
- **Markers**: as anticipated, arrowheads/markers now point straight out from the node consistently (the path's tangent right at each endpoint is the straight lead-in's direction, not the curve's own initial tangent) — this is the intended visual effect, not a side effect.

## Implementation
- `LabeledEdge.tsx`'s new `buildEdgePath()`: runs the actual bezier curve between two points offset straight outward from the real endpoints (by the setting's length, clamped to half the straight-line endpoint distance so two short segments can never overlap or fold a short edge back on itself), then splices a straight `L` segment from each real endpoint onto that curve's own path string. Falls back to a plain `getBezierPath` call when the setting is `0`.
- Label positioning (epic 0045) changed to always use the arc-length `pointAtRatio` method, including for the default midpoint (ratio 0.5) — previously the default case used `getBezierPath`'s own `labelX`/`labelY` untouched for exact backward compatibility with pre-0045 files. That guarantee doesn't extend to this epic: since every edge's rendered shape changes by default now (that's the whole point), keeping the label centered on the *whole* path, straight segments included, is more correct going forward than approximating with the old curve-only center.
- New `settings.ts` (`AppSettings` + `useSettings()`) and `SettingsPanel.tsx`, wired into `Canvas.tsx`'s existing toggle-panel machinery (toolbar button, `UtilityDock`, Escape-key chain, mutual exclusion with the other four dock panels). `edgeStraightSegmentLength` threaded to edge rendering via `DiagramContext`, same as `matchHighlights`.

## Verification
Clean typecheck. Live-checked in the dev server: the Settings panel opens/renders/persists to `localStorage` correctly (toolbar button → panel → edited value → confirmed via `localStorage.getItem('settings')`). `buildEdgePath`'s geometry was checked directly (not through a live edge, which still isn't reliably creatable via automation here — same limitation as epics 0042/0045/0046): a normal edge produces a straight lead-in of the exact configured length on each end before curving; a short edge correctly clamps both segments to meet exactly at the midpoint with no overlap; a `0` setting falls back to the exact old plain-bezier path. **Not visually verified in-session** — worth a real look, especially at a busy diagram like the C4 examples, to confirm the new default (8px) actually reads better as intended.

## Notes
This was the last epic in the Edges group of the current batch (see [PROGRESS.md](../../../../PROGRESS.md)) — Visual is next.
