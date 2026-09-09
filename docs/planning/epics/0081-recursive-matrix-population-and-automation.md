# 0081: Recursive matrix population and automation

## Status
**Done — core feature complete, pending PR/merge (2026-09-10)**, on `epic/0081-recursive-matrix-population-and-automation`. The user's call: the recursive rollup as built is a complete, shippable feature on its own — items 1/3/4/5 + the worked example, live-confirmed working (derived columns, broken-link cells, downstream-only note, mode changes flowing down the tree). The remaining automation polish (scope tagging, crawl throttle, reserved property field, double-count safety net, virtual rows) is **split out to [epic 0116](0116-security-rollup-automation-polish.md)** — each its own branch, per the user.

Split off epic 0060 on its closure (2026-08-25), consolidating the recursion/automation vision from that epic's Notes rounds 7–10. Depends on [epic 0079](completed/0079-security-data-as-diagram-element-property.md) — landed (PR #85).

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

## Design pass (2026-09-08) — infrastructure findings

Read of the current code before the design conversation:

- **The matrix is one flat instance.** `security` (top-level `DiagramSecurity`) + per-shape `data.security` (ADR 0082). No child-matrix / cross-file concept anywhere. `ThreatMatrixView` computes everything live from `nodes` + `security` (`threatMatrixMath.ts` is pure).
- **Linked children are reachable but not read headlessly today.** `data.linkedDiagram` holds a path relative to the diagram file's own dir; `resolveLinkPath` (`src/main/linkPaths.ts`) resolves it; linked `.chd` files colocate as `my-diagram/child.chd` (`links.ts`). But the only "read a `.chd`" IPC is `diagram:openPath`, which also records the file into recent/last-opened. **A crawl needs a new side-effect-free read IPC** (e.g. `security:readForCrawl` → `{ security, shapeSecurityById }` per file), or a raw `diagram:readRaw`.
- **`parseDiagram` / `serializeDiagram` live in `@shared/diagram`** — usable from main, so a main-side crawler is viable. The math (`combine`/`threatScore`/…) is renderer-only right now; a crawl either moves the math to shared or crawls in the renderer over IPC-fetched file contents.
- **No `zIndex`/version bump concerns** — anything added here stays additive (ADR 0029).

## Decisions (2026-09-08) → [ADR 0088](../../decisions/0088-recursive-security-matrix-rollup.md)

Settled with the user:

- **Derived values are computed on open, cached in renderer memory, refreshable on click. Never persisted.** No `derived` flag, no lock state, no staleness fingerprint on disk — a derived value is recomputed from source every time it's shown, so staleness can't happen.
- **Calculation modes (`combineMethod` / `aggregateMethod`) become session-only** — dropped from the persisted `.chd` schema (amends [ADR 0082](../../decisions/0082-security-data-schema.md)). A traversal passes the *active view's* two modes all the way down; every linked diagram at every depth is scored with the same modes. `diagram.threatScoreFor(normalizedThreatName, cellScoreMode, threatScoreMode) → number | null` — naturally recursive.
- **Threats matched across files by normalized name** (trim, case-fold, collapse whitespace). Unmatched child threats → Diagnostics note. Shared cross-tree catalog deferred.
- **A derived cell is greyed and read-only** — shows only the rolled-up threat score (or "—" for `null`); no probability/consequence; click → read-only breakdown, not the editor.
- **Leaf = no `linkedDiagram` (structural). In/out-of-scope = a diagram-configured `externalTag` mapping**; absent → unclassified (in scope + note), never silently external.

## Tasks

Sliced by size (see [ADR 0088](../../decisions/0088-recursive-security-matrix-rollup.md)). Item 1 is independent of the recursion and useful on its own; 2–5 are the core; 6–8 are follow-ups.

- [x] **1. Populate columns from the diagram** — "+ Add all N shapes" in `ThreatMatrixManagePanel` (bulk-add every `shape`-type node not in `matrixShapeIds`). Scope filtering deferred to item 2. *(commit 321b2de)*
- [ ] 2. `DiagramSecurity.externalTag` + a tag-mapping UI in the manage panel; `unclassified`/`external` classification with Diagnostics notes; Shape-type-only + per-shape opt-out tag.
- [x] 3. Dropped `combineMethod`/`aggregateMethod` from the persisted schema → Canvas session state (not reset on load); ignore-on-read, stop-on-write; `docs/file-format.md` + ADR 0082 updated. *(commit 3c04440)*
- [x] 4. `threatMatrixMath.ts` → `@shared/`; `normalizeThreatName`, `CrawledMatrix`/`CrawledShape`, recursive `threatScoreFor` (→ `number | null`), `threatNamesInSubtree`. *(commit 3c769d9)*
- [x] 5. `security:crawlLinked` main IPC (`src/main/security.ts`, side-effect-free) building a `CrawledMatrix` tree per linked matrix shape (ancestor-revisit → warning + leaf); Canvas session cache + crawl-on-persona-enter + "↻ Refresh links" button; derived columns render italic/muted read-only, **broken-link columns render a red hatch** (per the user); click a derived cell → read-only breakdown popup; completeness banner splits "(N in linked diagrams)". **v1: rows = own catalog only** — downstream-only threat names shown as a note, not virtual rows (deferred). *(commit 634926f)*
  - Deferred here: virtual rows for downstream-only threats; the in/out-of-scope tag (item 2); the crawl throttle (item 6).
- [x] **3-layer worked example** — `examples/gallery/technical/security-rollup.chd` + `security-rollup/` (7 files): Business domain → Services → Technical components, with a broken link, a non-linked shape, a downstream-only threat, and mode-sensitive numbers. *(commit 2068341)* Live-confirmed by the user (2026-09-10).

**Moved to [epic 0116](0116-security-rollup-automation-polish.md):** 2 (in/out-of-scope `externalTag`), 6 (crawl cooldown throttle), 7 (reserved "Security score" property field — coordinate with [epic 0107](0107-per-element-security-exposure.md)), 8 (sharing/double-count safety net), and virtual rows for downstream-only threats.

## Notes
Split off the same day epic 0060 closed. Scoped and mostly built 2026-09-08–10; the user drew the line at "the rollup itself is a complete feature" and moved the automation polish to epic 0116 so each piece gets its own branch.
