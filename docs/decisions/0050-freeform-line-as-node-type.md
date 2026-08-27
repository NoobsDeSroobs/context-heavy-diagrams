# 0050: Freeform line modeled as a node type, not a new top-level entity or a unified edge

## Status
Decided (2026-08-22)

## Context
A curved, freeform line is needed for trust-boundary-style diagrams — placed independently of any node, its shape controlled by adding bend points along it. Three real questions had to be settled before writing any code: what the line's endpoints and interior points actually are as a data model, how a "gravity" value turns into an actual curve, and whether this should be the same underlying construct as an edge.

## Decision

**1. New `DiagramNode` type (`'line'`), not a new top-level `DiagramFile` array.**

A line's points live in `data.points: LinePoint[]` (node-local coordinates), and `position`/`size` are kept as the bounding box of those points (plus a small padding for point handles/stroke). This reuses the entire existing node envelope — selection, dragging, locking, z-order, the layer panel, undo/redo via the existing node snapshot mechanism — the same way every prior node type (`shape`/`container`/`text`/`anchor`) was added, just by extending `Canvas.tsx`'s `nodeTypes` map.

**2. Curve math: per-point "gravity" on a Catmull-Rom spline, converted to piecewise cubic bezier.**

Each interior point's tangent is `(P[i+1] - P[i-1]) * gravity_i` (an endpoint uses its single neighbor); each segment between consecutive points converts to one cubic bezier via the standard Hermite-to-Bezier formula (`C1 = Pi + Ti/3`, `C2 = P[i+1] - T[i+1]/3`). `gravity` absent means `0.5` — the classic uniform-tension Catmull-Rom default, a smooth pass-through curve with no manual tangent-handle dragging needed. `0` gives a sharp corner (a polyline vertex); higher values bend more. A 2-point line with no interior points always renders perfectly straight regardless of gravity — the control points land exactly on the chord — so no special-casing is needed for the common "just a line" case.

This is implemented as a pure function (`bendablePath.ts`, point list in, SVG path string out) with no notion of "node" or "edge" — deliberately, so it's reusable without modification if edges gain the same capability later (see Alternatives below).

**3. Styling reuses the existing style vocabulary, added onto `NodeStyle`.**

`stroke`/`strokeOpacity`/`strokeWidth`/`lineStyle`/`startMarker`/`endMarker` — the same fields `EdgeStyle` already has — are added as new optional fields on `NodeStyle` rather than introducing a parallel style type or making `DiagramNode.style` a union. `LegendEntry` already does exactly this (its own `'line'` kind carries `lineStyle`/`startMarker`/`endMarker` alongside a plain `color`), so this isn't a new pattern in the schema.

## Alternatives considered

**A new top-level `freeformLines` array**, with its own render component and interaction, entirely separate from `DiagramNode`/`DiagramEdge`. Clean conceptual boundary, but duplicates selection/dragging/locking/z-order/undo machinery the node system already provides for free. Rejected — no real benefit over extending the node envelope for something that behaves like a positioned, draggable object.

**Unifying edges and lines into one connector type**, where `source`/`target` are each either bound to a node's connection point or a free `{x, y}` — floated during design as the "real" architectural answer, since it would also let `AnchorNode`'s dangling-edge-end placeholder disappear entirely (a free endpoint would just be a point on the connector itself). The user agreed this is the right eventual shape but chose to defer it: unifying now means reshaping `DiagramEdge.source`/`target` from required node ids into a bound-or-free union, a real `.chd` schema change, before the bend-point mechanism itself has been built or tested at all. Building the line as a separate node type first lets the curve math get exercised and corrected without any risk to `LabeledEdge.tsx`, which is working code today. The judgment call on how to avoid throwaway work later: keep the *geometry* (point list + gravity → path) in its own dependency-free module now, so a future bendable-edge type (folding edge routing/waypoints into this same mechanism) can consume it directly — the parts that would actually need reworking (data model, selection/drag interaction, right-click point editing) are cheap enough to redo once, and premature unification would mean guessing at edge requirements this pass doesn't actually need answered.

**Full bezier handle editor per point** (independent/mirrored/auto tangent handles, à la Affinity Designer/Illustrator) — the user's own opening reference point, explicitly walked back in favor of the single-scalar gravity model. Rejected as more interaction surface than the stated need (trust-boundary lines) requires.

**Continuous/draggable gravity control** (e.g. drag-with-modifier to adjust tension) instead of discrete presets. Deferred, not rejected outright — three presets (Sharp/Smooth/Curvy) on the point's context menu are enough to validate the mechanism; worth revisiting after live testing if they feel too coarse.

## Addendum (2026-08-22): gravity presets are a diagram-level catalog

The point context menu's three gravity presets (Sharp/Smooth/Curvy) were originally a hardcoded array in `LineNode.tsx`. The user's feedback, before any live testing: a specific diagram's layout may call for its own bend values, and reliably reproducing that diagram — for any reader, not just this app — means those named options need to live in the file, not be implied by whatever version of this app happened to author it. Reworked into a new `DiagramFile.gravityPresets: GravityPreset[]` catalog (`{id, label, value}`), same file-scoped/persisted treatment as `highlights`/`legend`, editable via a new `GravityPresetsPanel` in the existing `UtilityDock` family (View → "Line bend presets"). Absent/empty resolves to this app's own built-in four (`lineGravityPresets.ts`'s `DEFAULT_GRAVITY_PRESETS`) — a diagram only needs to spell its own out once it actually diverges.

Worth being precise about what this catalog does and doesn't affect: every point's `gravity` is already a concrete number once set (unaffected by this change), so a reader building the curve from `docs/file-format.md`'s documented formula never needs to consult `gravityPresets` — the catalog only changes what a human authoring a line is *offered*, closer in spirit to [Legend](../file-format.md#legend) than to anything that changes rendering. The reliability concern the user raised is real, but at the authoring-convenience layer, not the rendering layer: without this catalog, two people editing the same diagram (or the same person on two different app versions) could end up with different named-preset numeric values in their head for "this diagram's Smooth," even though any point's already-stored `gravity` always renders identically regardless.

Also added the same day, both small, both user-requested before live testing:
- A fourth built-in preset, **Acute** (`gravity: 0.2`), between Sharp (`0`) and Smooth (`0.5`) — a noticeably tighter turn than Smooth without being a hard corner.
- `ContextMenuItem` gained an optional `separatorBefore` flag (a generic addition, not line-specific) so "Remove point" renders visually set apart from the gravity-preset options above it in the point's right-click menu.

## Addendum (2026-08-22): hit-testing needed to track the curve, not the bounding box

Live feedback before the first real run of the app: a line's clickable/selectable area was its full rectangular `position`/`size` box (React Flow's own default node hit-testing), not the curve itself. For a concave shape — the user's example, a U-bend — that box necessarily includes the U's own empty interior, so clicking well away from any actual stroke still selected the line. Edges don't have this problem since they're not rectangular nodes at all; a line, being modeled as a `DiagramNode` (this ADR's own decision above), inherited React Flow's rectangle-hit-tests-the-whole-node behavior by default.

Fixed by setting `pointerEvents: 'none'` in the RF `Node.style` field (not `data.style` — a different, normally-unused field React Flow applies directly to its own node wrapper element) on every `line`-typed node, in `Canvas.tsx`'s `zIndexedNodes` mapping. `pointer-events: none` on that wrapper makes the entire bounding box — including a concave shape's empty interior — click/drag-through by default; `LineNode.tsx`'s invisible wide hit-stroke path (already built for right-click "add point," now also carrying left-click select/drag) and its own point handles each explicitly reset `pointer-events` back to a real value, since CSS `pointer-events` is inherited but any descendant can override it. Net effect: only the curve itself (within the hit-stroke's ~14px tolerance) and its point handles are interactive, matching how an edge only responds near its own path — including dragging the whole line, which now also requires grabbing the stroke rather than anywhere in the box, the same root cause fixed once rather than patched separately for click vs. drag.

Not independently live-tested (same Electron-only-API blocker as this feature's first pass) — the mechanism (`Node.style` applied to React Flow's own wrapper, pointer-events overridable per descendant) is standard, documented React Flow/CSS behavior, but worth a direct check: clicking empty space inside a bent line should deselect/pan through to whatever's behind it, clicking near the stroke or a point should still select/drag normally.

## Addendum (2026-08-23): Layers panel gaps, and a real edge/line difference worth logging

Two real gaps found once the hit-testing fix above was confirmed working: a freshly created line showed as "(unlabeled)" in the Layers panel (its `data.label` was seeded as `''`, unlike Shape/Container/Text which each default to their own type name — fixed by seeding `'Line'` instead, same convention, even though a line has no on-canvas label-editing UI yet), and clicking a line's row to "point at" it (`entityHighlightNodeId`, ADR 0035) did nothing — `LineNode.tsx` never rendered ShapeNode/ContainerNode/TextNode's `entity-highlighted` treatment at all. A plain CSS outline on the node's own box (what those three use) reads wrong on a line — the same concave-bounding-box problem the hit-testing addendum above describes — so the fix instead traces a dashed halo along the curve's own path, painted underneath the real stroke.

While diagnosing this, the user surfaced a real, worth-remembering structural difference from the earlier line/edge unification question (this ADR's own "Alternatives considered" section): **a line has its own `zIndex` and its own row in the Layers panel; an edge has neither** — an edge's stacking position is derived from its connected nodes' `zIndex` ([ADR 0035](0035-layer-order-control.md) scoped the Layers feature to Shape/Container/Text/now-Line only), and edges don't appear in the Layers panel at all. This is a direct, concrete consequence of modeling a line as a `DiagramNode` rather than deferring to the unified bound-or-free-endpoint connector this ADR's Alternatives section described as the eventual likely shape — worth weighing explicitly if/when that unification is revisited: would a "line" still get its own independent stacking position the way it does today, or would unifying with edges mean it inherits their endpoint-derived positioning instead? Not resolved here, just logged so it isn't rediscovered from scratch.

## Consequences
- `.chd` version stays `1` — every change here is additive (`NodeStyle` gains three optional fields, `DiagramNode.data` gains an optional `points` field, `type` gains a new recognized value), per [ADR 0029](0029-backward-compatible-loading-is-a-standing-rule.md). `docs/file-format.md` updated accordingly.
- Lines don't carry metadata/required-tags (same treatment as `text`/`anchor` — `nodeMetadataEligible` unchanged) and don't participate in highlights, since they're a decorative/annotation element, not a modeled system component.
- Edge waypoints/bias offsets stay open and unmerged for now, but their likely eventual shape has narrowed: reuse `bendablePath.ts` inside a new edge type rather than building separate routing math from scratch. (This later happened — see [ADR 0057](0057-edge-routing-style.md).)
