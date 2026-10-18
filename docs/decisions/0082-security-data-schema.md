# 0082: Security/threat data — the `.chd` schema

## Status

Accepted (2026-09-01). Implements [ADR 0055](0055-security-data-lives-on-diagram-elements.md)
(security data lives on elements; the matrix is a read-time view). Follows
the "absent means unused" convention of `requiredTags` / `highlights` /
`legend` / `gravityPresets` / `edgeDirectionSets`, so [ADR 0054](0054-progressive-disclosure-for-advanced-features.md)
is satisfied for free.

**Amended 2026-09-08 by [ADR 0088](0088-recursive-security-matrix-rollup.md):**
`combineMethod` / `aggregateMethod` are **no longer persisted** — they became
renderer session state when recursive rollup made a per-file mode incoherent
(a traversal spanning files needs one mode set, not one per file). Files
written before that change may still carry the keys; readers ignore them.
Everything else in this ADR stands.

## Context

The threat-matrix prototype ([`ThreatMatrixView.tsx`](../../src/renderer/src/security/ThreatMatrixView.tsx))
is entirely in-memory: hardcoded `TEST_THREATS` / `TEST_SERVICES` /
`TEST_CELLS`, hardcoded `PROBABILITY_SCALE` / `CONSEQUENCE_SCALE`, and
`combineMethod` / `aggregateMethod` as component `useState`. Nothing
persists. ADR 0055 decided the data belongs on the diagram's own elements;
this ADR pins down the exact shape, resolving the questions ADR 0055 left
to "that follow-up's own design pass."

## Decision

### Per-element data (Shape nodes only)

```ts
// on DiagramNode.data — only ever set on type === 'shape'
security?: Record<string, RiskCell>   // keyed by SecurityThreat.id
```

`RiskCell` is unchanged from the prototype:

```ts
interface RiskCell {
  probability: number
  consequence: number
  probabilityNote?: string
  consequenceNote?: string
}
```

**Shapes only** — not edges, not containers. The user's framing: "the
shapes are the concepts, and the things that can be attacked." An edge
(attacking a protocol) is a real threat surface but doesn't map onto the
matrix's column model; revisit if it ever earns its own view.

**Sparse.** A cell is written only once assessed. A missing entry means
"not yet assessed" — which is exactly the signal the completeness alert
(below) reads. Adding a shape to the matrix seeds **no** cells; the alert
goes up until they're filled. No fake `{probability:1, consequence:1}`
placeholder (the prototype's `DEFAULT_NEW_CELL` is dropped).

### Diagram-level configuration

```ts
// on DiagramFile
security?: DiagramSecurity

interface DiagramSecurity {
  threats: SecurityThreat[]        // the catalog; ordered (row order)
  hiddenThreatIds?: string[]       // ⊆ threats: in the model, not shown as a row
  matrixShapeIds: string[]         // ordered; Shape node ids in the matrix's data model
  hiddenShapeIds?: string[]        // ⊆ matrixShapeIds: in the model, not shown as a column
  probabilityScale?: SecurityScaleLevel[]
  consequenceScale?: SecurityScaleLevel[]
  combineMethod?: CombineMethod    // 'multiply' | 'add' | 'average'
  aggregateMethod?: AggregateMethod // 'average' | 'sum' | 'max'
}

interface SecurityThreat { id: string; name: string; description?: string }
interface SecurityScaleLevel { value: number; label: string; description: string }
```

- **Threats are id-keyed**, like every other catalog in this schema
  (`HighlightDefinition`, `LegendEntry`, `EdgeDirectionSet`, …). Renaming a
  threat is display-only — no per-element key migration.
- **`matrixShapeIds` is the matrix's data model** — the set of shapes being
  assessed, whether currently shown or hidden. A shape *not* in this list
  has no security data at all. Ordered (column order).
- **`probabilityScale` / `consequenceScale` absent** → the app's built-in
  1–5 scales (the prototype's `PROBABILITY_SCALE` / `CONSEQUENCE_SCALE`,
  now `DEFAULT_*`). Same Diagram-value-or-built-in-default pattern as
  gravity presets ([ADR 0052](0052-settings-ownership-tiers.md)); a
  Preferences-default tier can be a later follow-up (as gravity presets got
  one). No scale-*editing* UI in v1 — the scale reference panel just
  displays whichever scale is active.
- **`combineMethod` / `aggregateMethod` absent** → `'multiply'` /
  `'average'` (the prototype's initial `useState` values). Editable in the
  matrix's settings row; the change persists.
- The shared type `SecurityScaleLevel` supersedes the prototype's
  `ScaleLevel` and moves to `src/shared/diagram.ts` along with `RiskCell`,
  `SecurityThreat`, `CombineMethod`, `AggregateMethod` — they're schema
  now. The math functions (`combine`, `cellScore`, …) stay in the renderer
  module.

### Hide vs. Remove — the two distinct operations

| | Threat | Shape |
|---|---|---|
| **Hide** | add id to `hiddenThreatIds`. Stays in `threats`, cells untouched, **still counts toward completeness**. Not rendered as a row. | add id to `hiddenShapeIds`. Stays in `matrixShapeIds`, `data.security` untouched, still counts. Not rendered as a column. |
| **Remove** | delete from `threats` + `hiddenThreatIds`, and delete `data.security[id]` from **every** shape. Out of the completeness scope. Deliberate: "not applicable anymore, or added by mistake." | delete from `matrixShapeIds` + `hiddenShapeIds`, and delete the shape's entire `data.security`. Out of scope. |

The user's rule: "Remove = remove from the data model and the
visualisation. Hide = keep in the data model, simply do not add to the
matrix." Remove is destructive and explicit; hide is a view toggle.

### Completeness

The matrix's data model is a full grid: **every `matrixShapeId` (visible or
hidden) × every `threats` entry (visible or hidden)** is expected to have a
`RiskCell`. Unentered cells are not an error — they drive a **completeness
alert in the matrix overview**: "N of M assessments not entered", with a
way to see which. Storage stays sparse; the alert is computed from what's
absent. This is why hiding (not removing) keeps a shape/threat in scope —
the user: "Shapes that are visible AND those that are hidden shall have
data for the alert to go away."

### Dangling references

A shape deleted from the canvas takes its `data.security` with it, but its
id can linger in `matrixShapeIds` / `hiddenShapeIds`. `fromDiagramFile`
prunes ids that don't resolve to a current Shape node, with a load-time
note (same self-cleaning approach as `recentDiagrams` in
[ADR 0078](0078-recent-diagrams-menu.md)).

### Serialization

`serializeDiagram` emits `security` only when it carries something
(`threats.length > 0 || matrixShapeIds.length > 0`), and per-node
`data.security` only for entries with at least one cell. Deterministic key
order for the `security` object and each `RiskCell`; `threats` /
`matrixShapeIds` keep their array order (meaningful); `hidden*Ids` sorted.
Per-node `security` map: keys sorted. No `version` bump — purely additive.

## What's deferred (explicitly, to their own passes)

- **Per-element security in the Property panel / on the canvas.** The user:
  "the property view is already crowded; let us think about how to expose
  it on that side first." v1 has no Property-panel Security section — data
  is entered through the matrix's cell editor, as today. Logged as its own
  piece of work.
- **Scale-editing UI** — the scale fields persist and are read, but there's
  no in-app editor for them in v1.
- **A Preferences-tier default** for scales / methods.
- **Edge security**, container security.
- **Recursive rollup across linked diagrams** (see [ADR 0088](0088-recursive-security-matrix-rollup.md)),
  which this ADR unblocks.

## Alternatives considered

- **Eager cell materialisation** (write a default cell for every grid
  position on add). Rejected: bloats the file with unassessed placeholder
  data and fights git-friendliness; the completeness alert gives the same
  "you have gaps" feedback without storing anything.
- **Membership = "has `data.security`"** (no explicit `matrixShapeIds`).
  Rejected: can't represent the hidden state (data present, not shown) —
  and the user explicitly wants shapes deselectable from the matrix while
  keeping their data.
- **Orphan-preserve on threat removal** (keep the cells, drop the row).
  Rejected by the user in favour of a clean data model: remove means
  remove. Hide is the non-destructive option.
- **String-keyed threats.** Rejected — every other catalog in this schema
  is id-keyed, and a rename shouldn't rewrite per-element data.

## Consequences

- `src/shared/diagram.ts` gains `RiskCell`, `SecurityThreat`,
  `SecurityScaleLevel`, `CombineMethod`, `AggregateMethod`,
  `DiagramSecurity`, `DiagramNode.data.security`, `DiagramFile.security`.
- `renderer/src/security/`: `threatMatrixScale.ts` → default-scale
  constants + `effectiveScale` helper; `threatMatrixTestData.ts` deleted;
  `threatMatrixMath.ts` keeps the math, imports shared types;
  `ThreatMatrixView` rewritten to take `nodes` + `security` + callbacks
  from `Canvas.tsx` and compute live; `ThreatMatrixManagePanel` gains
  hide toggles and a "shape to assess" picker (by node label);
  `ThreatMatrixCellEditor` writes through to `data.security`.
- `Canvas.tsx`: new `security` state, load/save wiring (3 `toDiagramFile`
  call sites), `updateDiagramSecurity` / `updateNodeSecurity` handlers,
  dangling-id prune in `fromDiagramFile`.
- `docs/file-format.md`: new "Security" section.
