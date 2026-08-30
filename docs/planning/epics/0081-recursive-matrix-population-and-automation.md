# 0081: Recursive matrix population and automation

## Status
Not Started — not yet scoped. Split off epic 0060 on its closure (2026-08-25), consolidating the recursion/automation vision recorded across that epic's Notes rounds 7–10. Depends on [epic 0079](0079-security-data-as-diagram-element-property.md) (real per-element security data) — nothing here has real data to walk or roll up until that lands.

## Goal
Stop requiring every service/column in the matrix to be manually typed, and every level of a diagram hierarchy to be manually re-assessed. Populate the matrix's non-threat dimension from the diagram itself (linked child diagrams, or shapes already present), roll a child diagram's own computed scores up into its parent's matrix automatically, and keep that rollup from silently going stale — while treating any value the app derived (rather than a human entered) as visually distinct and not manually editable.

## Relevant existing behavior
All of the following is design vision only, captured but not built — see [epic 0060](completed/0060-threat-risk-matrix.md)'s Notes, rounds 7–10, for the full round-by-round reasoning:
- **Populating columns from the diagram** (round 7): linking each column to a sub-graph (a linked "daughter" diagram, epic 0009), or deriving columns from shapes already present in the current diagram view.
- **Recursive rollup** (round 7): a parent view aggregates the union of every child's own threat list as candidate rows; for a shared threat, the child's already-computed `threatScore()` copies directly into the corresponding parent cell — not re-entered or re-derived by a different formula.
- **Leaf vs. non-leaf, in-scope vs. out-of-scope** (round 8): a leaf is a shape with no linked sub-diagram (needs a human estimate); in/out of scope is decided by a diagram-configurable tag mapping (which tag key/value means "external"), not a hardcoded system tag — a diagram with no such tag is "unclassified," not silently assumed internal.
- **Resolved automation risks** (round 9): only Shape-type nodes are rollup candidates by default, with a per-shape opt-out tag; cycles handled by a visited-set during a necessarily depth-first, bottom-up traversal; a dedicated "not yet assessed" sentinel (distinct from a real low score) surfaced via the Diagnostics panel, reusing epic 0075's mechanism.
- **Refresh strategy, decided as a hybrid** (round 10): scores stay cached in-session while working in the matrix; a full crawl fires automatically on switching into the matrix persona, throttled behind a cooldown (leaning 2–5 minutes, not settled); the manual refresh button always forces a real crawl regardless of the cooldown.
- **A reserved "Security score" metadata field** (round 8, "also raised"): once a shape has a linked sub-diagram with its own matrix, that child's grand-total could surface back onto the parent shape as a system-populated (not user-editable) metadata field, visible in the Property Panel alongside regular tags.

## Real open questions (deliberately not resolved here)
- **Locking and visually distinguishing derived values** — raised when this epic was split off: a rolled-up/derived cell should be locked from manual edits and visually distinct (color-coded?) from a manually-entered one. Not designed — needs a concrete UI treatment, and to decide whether this reuses the existing `lockedStatic` metadata-lock concept (`docs/file-format.md`'s Metadata section) or is its own thing specific to matrix cells.
- **Staleness signaling** — round 9 flagged that a child re-assessed after its score was copied up leaves the parent silently outdated; no concrete "this parent value is stale" indicator designed yet.
- **Sharing/double-counting safety net** — round 9's "detecting a file linked from more than one place, and/or labeling a score with its lineage" is a nice-to-have mentioned, not designed.
- **Exact cooldown duration** for the automatic on-persona-switch crawl (round 10 leaned 2–5 minutes, not decided).
- **The tag-mapping UI** for in/out-of-scope classification, including the "offer to create the tag on a target diagram" flow round 8 flagged as needing its own confirmation step (a real write to someone else's diagram file).

## Notes
Not scheduled into any current batch — logged the same day epic 0060 closed. This is the largest and least-scoped of the three epics split from 0060; expect a real design pass before implementation starts, same as 0060 itself needed.
