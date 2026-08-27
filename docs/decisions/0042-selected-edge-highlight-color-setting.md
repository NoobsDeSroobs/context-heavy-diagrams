# 0042: Selected-edge highlight color setting

## Status
Accepted

## Context
While retesting the edge z-index fix (see [docs/known-issues.md](../known-issues.md)'s "Edge reconnect-handle ownership" entry) on the dense Meridian Rail landscape, the user found that even once handle-priority worked correctly, a selected edge could still be genuinely hard to visually track — today's only selection treatment is a stroke-width bump ([`SELECTED_STROKE_WIDTH_DELTA`](../../src/renderer/src/edges/LabeledEdge.tsx)), no color change at all. Raised as an improvement: a global setting for a highlight color a selected edge's line swaps to.

## Decision
- **Full color replacement, not a secondary halo.** Considered rendering a wider colored path behind the edge's own line (preserving its real color, visible on top). Rejected as more visually busy and more code (a second path per edge) for a case where "make the selected edge unmistakable" is the entire point — the user's own real color isn't something you need to keep seeing while actively tracking it through a busy diagram.
- **Overrides both the edge's own explicit style color and any highlight-match color.** Selection is meant to win outright, not compete with the diagram's own coloring — same reasoning as choosing full replacement over a halo.
- **Edges only, not nodes.** The motivating case (`docs/known-issues.md`) was specifically about losing track of a selected *edge*; shapes/containers already get a normal selection outline from React Flow itself, which the user didn't report any problem with.
- **On by default, with a deliberately unusual pre-picked color** (`#ff00aa`, vivid magenta) rather than shipped off requiring the user to first discover and enable it. Chosen specifically because it falls outside the blue/green/red/orange range typical diagram content tends to use, so it reads unambiguously as a UI selection indicator rather than diagram content — still fully user-changeable in Settings.
- **No separate enable/disable toggle** — just a color field. The user's own framing was "add a setting that allows the user to set a highlight colour," not an on/off switch; if a genuine "don't do this at all" need shows up later, that's a small addition, not a redesign.

## Alternatives considered
- **Halo/outline behind the real color.** Rejected — see Decision.
- **Extending the same treatment to selected nodes.** Rejected for now — not the reported problem, and nodes already have React Flow's own selection outline; can revisit if a real complaint about node selection visibility shows up.
- **Off by default, opt-in only.** Rejected — the user explicitly wanted it on immediately, just changeable.

## Consequences
- New `AppPreferences.selectedEdgeHighlightColor` (`preferences.ts`), a plain color swatch row in `PreferencesPanel.tsx` (not the property panel's `ColorField`, which supports an "unset" state that doesn't apply to an always-required global setting).
- Threaded through `DiagramContext` the same way `edgeStraightSegmentLength`/`maxConnectionPointsPerSide` already are, read in `LabeledEdge.tsx` and applied as the last entry in `computedStyle`'s spread so it wins over both an explicit edge style color and a highlight-match color.
- Arrowhead/marker color needed no separate handling — `edgeMarkers.tsx`'s markers already use the CSS `context-stroke` keyword, inheriting whatever color the referencing path resolves to.
