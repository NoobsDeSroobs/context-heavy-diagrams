# 0055: Security/threat data lives on diagram elements; the matrix is a read-time view over it

## Status
Accepted (2026-08-25)

## Context
The threat/risk-matrix prototype built a full-canvas "Security Matrix" mode-switch (a toolbar persona swap replacing the diagram canvas with a threats × services table). Through most of that design conversation, two mechanisms were treated as competing alternatives for how this feature would ultimately work: the mode-switch view itself, versus a "per-shape facet" — threat/risk data attached directly to a node, parallel to `data.details`/`data.linkedDiagram` — with no separate matrix view at all.

The prototype as built is entirely in-memory, backed by hardcoded placeholder data (`threatMatrixTestData.ts`, `threatMatrixScale.ts`) — closing that prototype phase surfaced persistence as unfinished, foundational work blocking every other follow-up (tag-driven automation, recursive rollup, refresh strategy).

## Decision
**The two mechanisms aren't actually alternatives — they operate at different layers, and combining them resolves persistence as a side effect rather than a separate problem.**

- **Per-element data is the source of truth.** A node (and, contingent on further design) an edge carries its own `RiskCell`-shaped entries (probability, consequence, optional rationale notes) keyed by threat, stored directly in the `.chd` file the same way `data.details` or `metadata` already are. This is real diagram content, not matrix-view state.
- **Diagram-level configuration, not per-element, for what's shared**: the catalog of threats relevant to this diagram (replacing the hardcoded `TEST_THREATS` list), the probability/consequence scale definitions (replacing `PROBABILITY_SCALE`/`CONSEQUENCE_SCALE`), and the calculation modes (`CombineMethod`/`AggregateMethod`) — new top-level `.chd` fields, following the same "absent means none/default" convention as `requiredTags`/`highlights`/`legend`/`gravityPresets`.
- **The Security Matrix mode-switch view becomes a pure read-time visualization.** It reads every relevant element's own security data plus the diagram-level catalog/config and computes the table live — it does not own or separately persist a matrix-shaped artifact of its own. Refreshing the matrix (the already-decided hybrid strategy) means re-reading element data, not re-syncing two divergent stores.
- **A shape's own Property Panel gains a "Security" section**, surfacing that element's own threat scores directly in context — the user's own motivating case: looking at one service shouldn't require scanning a potentially long matrix to find its row.

## Alternatives considered
**A wholly separate colocated matrix file** (a second-round idea — the security view as its own file in the diagram's colocation folder, like a linked child diagram). Rejected: reintroduces a second source of truth that can drift from the elements it's supposedly describing, and structurally can't support a per-shape "Security" panel section without duplicating data back onto the element anyway.

**Matrix-only state, kept separate from node/edge data** (what the prototype currently does). Rejected: this is exactly what made persistence hard in the first place, and treats threat/risk data as belonging to the view rather than to the thing it's actually about.

## Consequences
- `.chd` schema gains: an optional per-node/edge security field (name TBD at implementation), and a diagram-level security config block (threat catalog + scales + calculation modes) — both following the established "absent when unused" convention, so [ADR 0054](0054-progressive-disclosure-for-advanced-features.md) is satisfied for free: a diagram that never opens the security matrix gains nothing in its saved file.
- `docs/file-format.md` needs a new section once this is implemented (per this repo's standing rule that the spec stays current with `src/shared/diagram.ts`).
- The prototype's hardcoded test data/scale files are replaced by real diagram data — tracked as a dedicated follow-up (real per-element security persistence plus a Property Panel Security section).
- Open question this ADR deliberately leaves to that follow-up's own design pass: whether edges carry security data alongside nodes (raised by the user — attacking a communication protocol is a real, distinct threat surface from attacking an endpoint — but an edge doesn't map cleanly onto the matrix's node-based "service" column today). **Resolved by [ADR 0082](0082-security-data-schema.md): Shapes only — not edges, not containers.** Reaffirmed by the user 2026-09-07: the security matrix is built purely from shapes; edges are out of scope unless they ever earn their own separate view.
- Unblocks the recursive-rollup vision: a parent's rollup can now read a linked child diagram's real per-element data instead of needing its own separate persisted matrix to read from.
