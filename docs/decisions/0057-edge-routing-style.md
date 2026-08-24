# 0057: Edge routing style as a style field, not a line/edge schema unification

## Status
Decided and implemented (2026-08-24)

## Context

[Epic 0032](../planning/epics/0032-edge-routing-and-waypoints.md) opened as "let an edge be routed around an obstacle it would otherwise cross." A fuller idea — unifying `DiagramEdge` and the `'line'` node type into one connector, with `source`/`target` as a bound-or-free union — was designed in detail (see that epic's own history) and built across two live-testing rounds. Both rounds surfaced the same real problem: a free (unattached) endpoint needs *some* real node for React Flow to hang an edge's coordinates and drag interaction off of, since React Flow's `<Edge>` type requires real node ids for both `source` and `target`. No amount of restyling or curve-math correction changed that structurally — confirmed independently by the user, who found React Flow's own official "Temporary Edges" example (`useIncompleteEdge`/`GhostNode`) uses the identical stand-in-node pattern. The only way to avoid a stand-in node entirely is to stop using React Flow's native edge system for anything with a free end — a materially larger, hand-rolled rendering/selection/drag/undo system.

## Decision

**No schema unification.** `'line'` stays its own `DiagramNode` type exactly as epic 0064/[ADR 0050](0050-freeform-line-as-node-type.md) left it. `DiagramEdge` stays bound-to-bound only, same as before this epic.

**`EdgeStyle` gains `routingStyle?: 'straight' | 'step' | 'smoothstep' | 'catmullRom'`.** Absent means the original, only-ever behavior (a plain bezier). The first three route through React Flow's own built-in path functions unchanged. `'catmullRom'` reuses `bendablePath.ts` (epic 0064's freeform-line curve, per-point Catmull-Rom gravity) — the one piece of that epic deliberately built "no notion of node or edge" specifically so a future bendable edge type could reuse it verbatim, which is exactly what happens here.

**`DiagramEdge` gains `points?: LinePoint[]`** (absolute canvas coordinates), meaningful only under `'catmullRom'` routing — manual bend points, editable via the same right-click-add / drag / gravity-preset-menu interaction `'line'` points already have. Both fields are purely additive; no `.chd` version bump, unlike the unification attempt's `source`/`target` change (which altered an existing field's meaning, not just added a new one).

`bendablePath.ts`'s per-point tangent formula gained one addition to make this work: a point can carry an optional, renderer-only `direction` (a fixed outward unit vector), used instead of the neighbor-based tangent. A `'line' `node's points never set it (nothing to leave "outward" from). An edge's own two endpoints always set it once routed with `'catmullRom'` (both are always bound to a real shape, so a real "leaves this side" direction always exists) — interior bend points don't, and fall back to the plain gravity/neighbor formula, same as a line's own points always have.

## Alternatives considered

**Full edge/line unification** (bound-or-free `EdgeEndpoint`, a synthetic node standing in for any free endpoint, `'anchor'`/`'line'` both retiring into it) — designed in full, implemented, live-tested twice. Rejected after the second round: even with the curve math and endpoint styling corrected, the result was structurally indistinguishable from a reintroduced `AnchorNode`, confirmed by the user's own research into React Flow's official patterns for this exact scenario. The user's own framing, decisive here: "if it becomes such a big codebase to maintain, then using RF loses its meaning" — truly eliminating the stand-in node would mean abandoning React Flow's native edge rendering for a hand-built alternative, a much larger and riskier undertaking than this epic's actual ask justified. See [epic 0032](../planning/epics/0032-edge-routing-and-waypoints.md)'s Notes for the full account, including why this wasn't just a bug (a design flaw was found and fixed mid-attempt too — a fixed connection "direction" leaking from React Flow's rendering requirement into the curve shape of what should have been a direction-agnostic free point).

## Consequences

- `.chd` version stays `1` — both new fields are additive, per [ADR 0029](0029-backward-compatible-loading-is-a-standing-rule.md). `docs/file-format.md` updated with the new `Edge style.routingStyle` field and a new `Edge points` section (mirroring `Line points`, cross-referenced rather than duplicated).
- `gravityPresets` (epic 0064's diagram-level catalog) is now shared between a `'line'` node's points and a catmull-rom edge's points — same catalog, same right-click menu, no separate one.
- A discarded but real design (bound-or-free `EdgeEndpoint`, `AnchorNode` retirement, cascade-delete-safe detached endpoints) remains pushed to `origin/epic/0032-edge-line-unification`, deleted locally, never merged — kept for reference in case any piece of it (e.g., want (3), cascade-delete not destroying an edge) is worth revisiting on its own, smaller terms later. Not tracked as an open epic item; would need its own fresh scoping if picked up again.
