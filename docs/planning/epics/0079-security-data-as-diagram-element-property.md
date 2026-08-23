# 0079: Security data as a diagram-element property (real persistence)

## Status
Not Started — not yet scoped. Split off epic 0060 on its closure (2026-08-25), the first and foundational of three follow-ups. See [ADR 0055](../../decisions/0055-security-data-lives-on-diagram-elements.md) for the design decision this epic implements.

## Goal
Replace the epic 0060 prototype's hardcoded, in-memory-only threat/risk data (`threatMatrixTestData.ts`, `threatMatrixScale.ts`) with real data that lives on the diagram's own nodes and persists through `.chd` save/reload — plus a "Security" section in the Property Panel so a single shape's own security info is visible without opening the full matrix view (the user's own motivating case: no need to scan a potentially long matrix to find one service's row).

## Relevant existing behavior
- `RiskCell` (`threatMatrixMath.ts`): `{ probability, consequence, probabilityNote?, consequenceNote? }` — already the right per-element, per-threat shape, just not yet attached to a node.
- `CombineMethod`/`AggregateMethod` (`threatMatrixMath.ts`) and `PROBABILITY_SCALE`/`CONSEQUENCE_SCALE` (`threatMatrixScale.ts`) are currently hardcoded constants — these are diagram-level configuration, not per-element data, per ADR 0055.
- `data.details`/`data.linkedDiagram` on `DiagramNode` (`src/shared/diagram.ts`) are the closest existing precedent for "optional richer context attached to one element" — same family a security entry joins.
- The Property Panel (`src/renderer/src/components/PropertyPanel.tsx` — check current filename) already has a per-element sections pattern (style, metadata) a new "Security" section would follow.
- File-format precedent for the new diagram-level config block: `requiredTags`/`highlights`/`legend`/`gravityPresets` in `docs/file-format.md` — absent means none/default, same rule this epic's new fields must follow (per ADR 0054).

## Real open questions (deliberately not resolved here)
- **Field shape and name** — a `data.security: Record<threatId, RiskCell>` on `DiagramNode`, or something else. Needs a stable threat identity (name vs. a generated id) that survives a threat being renamed in the diagram-level catalog.
- **Do edges carry security data too?** Raised by the user when this epic was split off: "you can attack the communication protocol" — a real, distinct threat surface from attacking an endpoint. Structurally unresolved: the matrix's columns are node-based "services" today, and an edge doesn't obviously become a column the same way. Could be a separate concern from the matrix's own display (edges get a Security section in their own Property Panel without needing to appear as a matrix column) — worth deciding early since it affects the schema shape.
- **Which node types can carry security data** — epic 0060's ninth round scoped the matrix's own *column* candidates to Shape-type nodes only (not Container/Text/Line/Anchor), but that was a decision about the view, made before this per-element-data model existed. Worth revisiting whether Container should carry security data too now that it's not matrix-only state (metadata already allows Container, per `docs/file-format.md`).
- **Diagram-level config block's exact shape** — one `security` object bundling the threat catalog + both scales + both calculation modes, or several separate top-level fields. Should follow whatever reads cleanest against the existing top-level field list in `docs/file-format.md`.
- **Threat catalog lifecycle** — renaming or removing a threat from the catalog needs a reconciliation rule for existing per-element entries referencing it, similar to `requiredTags`' "demote to free rather than delete" rule (`docs/file-format.md`'s Required tags section) — not yet designed for this case.
- **Wiring the existing prototype views** (`ThreatMatrixView.tsx`, `ThreatMatrixCellEditor.tsx`, `ThreatMatrixManagePanel.tsx`) to read/write this real data instead of the test-data module — mechanical once the schema is settled, but real work (the manage panel's add/remove currently mutates in-memory-only state).

## Notes
Not scheduled into any current batch — logged the same day epic 0060 closed. This is the prerequisite for epic 0081 (recursive automation) doing anything real; that epic's tag-driven rollup has nothing to persist or read until this one lands.
