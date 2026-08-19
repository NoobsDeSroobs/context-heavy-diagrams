# 0014: Node and edge style schema

## Status
Accepted (schema shape) — preset catalog content and naming system explicitly deferred, see Notes

## Context
Epic 0003 needs an actual schema for style, which doesn't exist on `DiagramNode`/`DiagramEdge` today at all (`src/shared/diagram.ts` has no `style` field on either). The [project brief](../project-brief.md)'s own draft schema sketched `"style": { "stroke": "#333", "strokeWidth": 2, "fill": "#fff" }` on nodes and left the edge schema "not yet finalized." [ADR 0010](0010-named-searchable-style-presets.md) already decided *how presets get picked* (a searchable catalog, never stored as an identity — only the raw style properties it applies are saved) but didn't define what those raw properties actually are.

Working out the styling panel's structure (epic 0003) surfaced the actual field list needed: fill/border for shapes and containers, font styling for any node with a label *and* for edges (their label needs styling too — easy to miss since edges were mostly discussed in terms of line/markers), line style and independent start/end markers for edges, and exact numeric transform fields (position/size/rotation) to complement the existing drag-based resize/rotate (epic 0002).

## Decision
**One `style` bag per node, one per edge** — extending the brief's original draft rather than introducing a second top-level field for text-specific properties. A node's fill/border and its label's font are both "how this node looks," not two separate concerns warranting separate schema fields.

```ts
export interface FontStyle {
  fontSize?: number
  fontColor?: string
  fontWeight?: 'normal' | 'bold'
}

export interface NodeStyle extends FontStyle {
  fill?: string          // shape/container body. Meaningful for text nodes too,
                          // now that container fill is customizable (see below) —
                          // consistent to not special-case text out of a field
                          // it's simply optional and usually unset for.
  stroke?: string
  strokeWidth?: number
  textAlign?: 'start' | 'center' | 'end'   // CSS logical values — RTL-correct,
                                            // not 'left'/'right'
}

export type LineStyleKind = 'solid' | 'dashed' | 'dotted'

// Deliberately shape-described, not notation-named (see Notes) — "arrowOpen"
// not "UML dependency," "crowsFootMany" not "ERD many-side." The picker layer
// (ADR 0010) attaches names on top of these; the schema itself only needs to
// describe what's actually drawn.
export type MarkerKind =
  | 'none' | 'arrowOpen' | 'arrowClosed'
  | 'circle' | 'circleFilled' | 'diamond' | 'diamondFilled'
  | 'crowsFootOne' | 'crowsFootMany'
  | 'crowsFootOneOrMany' | 'crowsFootZeroOrOne' | 'crowsFootZeroOrMany'

export interface EdgeStyle extends FontStyle {
  stroke?: string
  strokeWidth?: number
  lineStyle?: LineStyleKind
  startMarker?: MarkerKind
  endMarker?: MarkerKind
}
```

`DiagramNode` gains `style?: NodeStyle`. `DiagramEdge` gains `style?: EdgeStyle`. Both additive per the schema's established versioning approach (ADR 0003) — absent `style` means "use the current hardcoded look," same as every other optional field.

**`textAlign` lives on `NodeStyle`, not `EdgeStyle`** — an edge label is a small floating text near the line, not multi-line block text; alignment doesn't meaningfully apply the way it does to a shape's label. `FontStyle` is factored out as the shared subset both actually need (`fontSize`/`fontColor`/`fontWeight`), not force-unified into one identical interface.

**Groups, per element type** (drives the property panel's collapsible sections, epic 0003):
- **Shape / Container**: Fill, Border, Font, Transform (x/y/width/height — no rotation, ADR 0004/0012)
- **Text**: Font, Transform (x/y/width/height, *plus* rotation — text does rotate)
- **Edge**: Start (marker), Line (stroke/width/lineStyle), End (marker), Font (label styling)

## Alternatives considered
- **Separate `textStyle` field instead of folding font properties into `style`**: rejected — every property in `style` is "how this element looks," splitting font out into its own top-level field doesn't correspond to any real distinction a reader of the file format would find meaningful, just adds a field to track.
- **UML/notation-named marker enum values** (e.g. `'umlDependency'`, `'erdManyMandatory'`) instead of shape-described ones (`'arrowOpen'`, `'crowsFootMany'`): rejected for the schema layer specifically — see Notes on why naming/notation choice is being kept out of the schema entirely, not just deferred in the picker UI.

## Consequences
- `docs/file-format.md` needs `style` documented on both Node and Edge once this ships, matching the existing per-field table format.
- The marker enum (`MarkerKind`) will grow as real diagram types get attempted (epic 0022's gallery) or as the eventual notation-base discussion (see Notes) concretely needs a shape this list doesn't have yet — not something to try to enumerate exhaustively now.
- Rendering `startMarker`/`endMarker`/`lineStyle` is new custom SVG marker work on top of React Flow's edge rendering (`LabeledEdge.tsx`) — not itself decided here, an implementation detail for whoever builds epic 0003.

## Notes
**The notation-base question — which naming system(s) the eventual preset catalog draws from (UML? BPMN? ERD/crow's-foot? something invented for this tool?) — is explicitly not decided here, and was kept out of this discussion on purpose.** When discussing what to call a dashed vs. solid line, the user deliberately used invented, non-standard terms ("evanescent connection" / "continuous connection") specifically to avoid priming the schema/naming discussion with any one real notation system's vocabulary before that choice has actually been made. That choice needs its own real discussion later — informed by testing and real diagram-building experience over time, not decided as a side effect of getting the schema shape right. [ADR 0010](0010-named-searchable-style-presets.md) already established that whatever naming system(s) get chosen, they're a *picker-layer* concern (labels + search keywords over raw style values) — this ADR's `MarkerKind`/`LineStyleKind` enums are deliberately visual/structural ("arrowOpen," "crowsFootMany") rather than notation-specific, precisely so they stay valid regardless of which naming system(s) end up layered on top.
