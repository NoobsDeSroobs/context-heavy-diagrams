# 0116: Security-matrix rollup — automation & scope polish

## Status
Not Started — split from [epic 0081](../completed-epics.md#0081-recursive-matrix-population-and-automation)
on its close (2026-09-10). Epic 0081 shipped the recursive rollup itself
(compute-on-open, derived + broken columns, modes flowing down the tree,
[ADR 0088](../../decisions/0088-recursive-security-matrix-rollup.md)); this epic
is the remaining automation and scoping work. Each item is small and largely
independent — expect a branch per item, not one big branch.

## Goal
Make the rollup less manual and safer to trust: classify shapes as
in/out-of-scope, stop re-crawling on every persona flip, surface a child's
grand-total on the parent shape, and guard against a sub-diagram being
counted twice.

## Tasks

- [ ] **In/out-of-scope tag mapping.** `DiagramSecurity.externalTag?: { key, value }`
      pointing at whatever tag convention a diagram already uses; a diagram
      with no mapping treats every shape as **unclassified** (in scope, with a
      Diagnostics note), never silently external ([ADR 0088](../../decisions/0088-recursive-security-matrix-rollup.md)).
      Manage-panel UI to set it. Only `shape`-type nodes are rollup candidates;
      a per-shape opt-out is a tag, not schema. Also unblocks the deferred
      "populate columns" scope filter from epic 0081 item 1.
- [ ] **Crawl cooldown throttle.** Today the crawl fires on every switch into
      the matrix persona. Add a cooldown (leaning 2–5 min, not settled) that
      gates only the *automatic* on-switch crawl — the "↻ Refresh links"
      button always forces a real crawl.
- [ ] **Reserved "Security score" property-panel field.** A shape with a
      linked sub-diagram surfaces that child's grand-total as a
      system-populated, non-editable field in the Property panel. Overlaps
      [epic 0107](0107-per-element-security-exposure.md) (per-element security
      exposure) — design them together; this is the "read-only rollup number
      on the parent" half.
- [ ] **Sharing / double-count safety net.** Detect a `.chd` linked from more
      than one parent (its score rolls into both aggregates); at minimum a
      Diagnostics note, optionally lineage labelling (which parent path a
      score was computed under). Epic 0088 assumes a strict tree; this is the
      violation detector.
- [ ] **Virtual rows for downstream-only threats.** Epic 0081 v1 shows a
      threat assessed only in a linked subtree as a *note* ("Linked diagrams
      also assess: …"), not a row. Consider showing it as a real (synthetic,
      non-assessable-in-leaf-columns) row instead — needs a stable synthetic
      identity and a clear "add to catalog to assess here" affordance.

## Notes
None of this changes the rollup's core contract (compute-on-open, never
persist a derived value, modes are session state) — that's fixed by
[ADR 0088](../../decisions/0088-recursive-security-matrix-rollup.md). Each item
here likely wants a short ADR or an ADR 0088 addendum.
