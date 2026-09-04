# 0079: Security data as a diagram-element property (real persistence)

## Status
Done — merged to `master` (PR #85, 2026-09-04). Design committed 2026-09-01, see [ADR 0082](../../decisions/0082-security-data-schema.md) (the concrete schema for [ADR 0055](../../decisions/0055-security-data-lives-on-diagram-elements.md)). NOT live-tested (Electron renderer). Follow-ups: [epic 0081](../0081-recursive-matrix-population-and-automation.md) (now unblocked), [epic 0107](../0107-per-element-security-exposure.md).

## Goal
Replace the epic 0060 threat-matrix prototype's hardcoded, in-memory-only
data (`threatMatrixTestData.ts`, `threatMatrixScale.ts`, component-state
calc modes) with real data that lives on the diagram's own Shape nodes and
persists through `.chd` save/reload, so the Security Matrix view works on a
real model instead of placeholders.

## Committed design (2026-09-01)
Full rationale + rejected alternatives in [ADR 0082](../../decisions/0082-security-data-schema.md).
Settled with the user across two rounds:

- **Shapes only** carry security data — not edges (a protocol attack is
  real but doesn't fit the matrix's column model), not containers.
  `DiagramNode.data.security?: Record<threatId, RiskCell>`, **sparse** (a
  missing cell = "not assessed" = drives the completeness alert; no
  placeholder seeding).
- **Diagram-level `DiagramFile.security`**: `threats` catalog (id-keyed) +
  `matrixShapeIds` (the matrix's data model, ordered) + `hiddenThreatIds`
  / `hiddenShapeIds` + optional `probabilityScale` / `consequenceScale` /
  `combineMethod` / `aggregateMethod` (absent → app built-in defaults).
- **Hide ≠ Remove.** Hide = stays in the data model, not shown, still
  counts toward completeness. Remove = deleted from the model *and* every
  shape's cells (threats) / the shape's whole `data.security` (shapes).
- **Completeness alert** in the matrix overview — "N of M assessments not
  entered", over every (matrixShape × threat) pair, visible or hidden.
- **No Property-panel Security section in v1** — the property view is
  crowded and the diagram-side exposure needs its own design pass. Data is
  entered through the matrix cell editor, as today. → [epic 0107](0107-per-element-security-exposure.md).
- Schema types (`RiskCell`, `SecurityThreat`, `SecurityScaleLevel`,
  `CombineMethod`, `AggregateMethod`) move to `src/shared/diagram.ts`; the
  math (`combine`, `cellScore`, …) stays in the renderer.

## Tasks
- [x] `src/shared/diagram.ts`: `RiskCell`, `SecurityThreat`,
      `SecurityScaleLevel`, `CombineMethod`, `AggregateMethod`,
      `DiagramSecurity`; `DiagramNode.data.security`, `DiagramFile.security`.
      `serializeDiagram` gating + deterministic key order + map-key sort +
      `hidden*Ids` sort. **Also fixed a 5th instance of the serialize
      picklist-gap bug found here: `data.references` (epic 0090) was never
      serialized either — see known-issues.md.**
- [x] `renderer/src/security/threatMatrixScale.ts` → `DEFAULT_PROBABILITY_SCALE`
      / `DEFAULT_CONSEQUENCE_SCALE` + `effectiveScales(security)` helper.
- [x] `threatMatrixMath.ts`: imports shared types; keeps the functions +
      labels; `BLANK_RISK_CELL` moved here (react-refresh lint rule).
- [x] Deleted `threatMatrixTestData.ts`.
- [x] `Canvas.tsx`: `security` state; `fromDiagramFile` prunes dangling
      shape refs + strips orphan cells (threat removed / shape not a member
      / non-shape node) with a Diagnostics note; `toDiagramFile` (both call
      sites) + autosave ref + `loadDiagramIntoCanvas`; `updateSecurity` +
      `updateNodeSecurityCell` (undoable) + `removeSecurityThreat` /
      `removeSecurityShape` (not undo steps; also strip history snapshots).
- [x] `ThreatMatrixView` rewrite — props from Canvas, columns/rows from
      the (de-hidden) model, scores over assessed cells only, methods
      read/write `security.*`, completeness banner, empty-state guidance.
- [x] `ThreatMatrixManagePanel` — threats add / rename / hide / remove;
      shapes: `<select>` picker of un-added Shape nodes + per-shape hide /
      remove. Two-step inline confirm on remove (destructive).
- [x] `ThreatMatrixCellEditor` — threat × shape *label* header, "not
      assessed" hint, "Clear this assessment" button.
- [x] `docs/file-format.md`: new "Security" section + `data.security` row.
- [x] `typecheck` clean; `lint` 0 errors.
- [ ] Live-test (Electron): add threats + shapes, assess cells, hide vs
      remove each, completeness banner, delete an assessed shape from the
      canvas → matrix self-heals, save/reload round-trip, dormant diagram
      stays dormant.

## Relevant existing behavior
- `RiskCell` (`threatMatrixMath.ts`) — already the right per-element shape.
- `CombineMethod` / `AggregateMethod` + the pure math — reused as-is.
- `data.details` / `data.linkedDiagram` / `data.references` — the family
  `data.security` joins (optional richer context on one element).
- `requiredTags` / `highlights` / `legend` / `gravityPresets` /
  `edgeDirectionSets` — the "absent means unused" top-level precedent
  `DiagramFile.security` follows.
- `recentDiagrams`' prune-on-load (ADR 0078) — the model for
  `matrixShapeIds` dangling-id cleanup.

## Notes
Split off epic 0060 on its closure (2026-08-25); prerequisite for
[epic 0081](0081-recursive-matrix-population-and-automation.md) (recursive
rollup — nothing to walk until real per-element data exists). Epic 0060's
branch merged (PR #55) before this started. Design pass done 2026-09-01;
the Property-panel / on-canvas exposure was deliberately carved out into
[epic 0107](0107-per-element-security-exposure.md) at the user's request.
