# 0088: Recursive security-matrix rollup — computed live, never persisted

## Status
Accepted (2026-09-08). Implements the recursion/automation vision from the
threat-matrix design Notes (rounds 7–10 of the epic that closed as
[ADR 0055](0055-security-data-lives-on-diagram-elements.md)); builds on
[ADR 0082](0082-security-data-schema.md) (the `.chd` security schema).
**Amends ADR 0082** — see Consequences.

## Context
The Security Matrix ([ADR 0055](0055-security-data-lives-on-diagram-elements.md) /
[ADR 0082](0082-security-data-schema.md)) is a single flat table over one
diagram's shapes. Real threat-modelling work is hierarchical: you assess leaf
systems directly and every level above extrapolates from what's underneath (the
user's own prior Excel workflow). Doing that by hand means re-typing every parent
score and keeping it in sync as children change.

Open questions this ADR settles:
- Where does a rolled-up (derived) value live — in the file, or recomputed?
- Which calculation modes govern a traversal when parent and child differ?
- How are threats in different files matched, given threat ids are per-diagram?
- How does a derived cell behave in the UI?

## Decision

### Derived values are computed live and never persisted
A `.chd` file stores only its own hand-entered `data.security` cells. A matrix
column whose shape has a `data.linkedDiagram` is a **derived column**: its cells
are computed at view time by crawling the linked subtree. Nothing derived — not
the rolled-up scores, not "this cell is locked", not a staleness fingerprint — is
ever written to disk.

- **Crawl on open / on entering the matrix persona; refresh on demand.** The
  result is cached in renderer memory for the session. A manual **Refresh**
  control re-crawls. (A cooldown throttle on the automatic re-crawl is a later
  follow-up; v1 crawls on switch + manual button.)
- Staleness stops being a problem by construction — a derived value is recomputed
  from source every time it is shown.

### Calculation modes are session-only and flow down from the active view
`combineMethod` (cell-score mode) and `aggregateMethod` (threat/vulnerability-
score mode) are **not persisted** and are **not read from any file during a
crawl**. They are renderer session state on the active matrix view. A traversal
passes the active view's two modes all the way down; every diagram in the tree is
scored with the same two modes. Opening a child diagram directly just means
*that* view's session modes apply to it.

Conceptually each diagram in the tree answers:

```
diagram.threatScoreFor(normalizedThreatName, cellScoreMode, threatScoreMode) -> number | null
```

- **Leaf** (a matrix shape with no `linkedDiagram`): aggregate that shape's own
  `data.security` cells whose threat's normalized name matches — `cellScore(cell,
  cellScoreMode)` per cell, then `aggregate(_, threatScoreMode)`.
- **Non-leaf** (a matrix shape *with* a `linkedDiagram`): recurse —
  `child.threatScoreFor(name, cellScoreMode, threatScoreMode)`. The returned
  scalar enters the parent's aggregation as one value.
- `null` when nothing downstream is assessed for that threat — distinct from a
  real low score.

Naturally recursive (linked diagrams inside linked diagrams all use the same
modes); cycles handled by a visited-set on the depth-first, bottom-up walk.

### Threats are matched across files by normalized name
Threat ids are per-diagram ([ADR 0082](0082-security-data-schema.md)), so a crawl
joins a parent threat to a child threat by **name, normalized** (trimmed,
case-folded, whitespace-collapsed). A parent's candidate rows are the union of its
own catalog and every descendant's catalog, deduped by normalized name. Child
threats with no name match in the parent are surfaced as a Diagnostics note, not
silently dropped. A shared cross-tree threat catalog is explicitly out of scope —
a later idea if name-matching proves too fragile.

### A derived cell is read-only
It renders greyed, shows the single rolled-up threat score (or "—" when `null`),
and is **not editable** — no probability, no consequence, because a derived value
is an aggregate, not a P/C pair. Clicking it opens a **read-only breakdown**
(source diagram, contributing cell count, a link to open the child) instead of
the cell editor. Derived-but-`null` cells count as "not entered" in the
completeness banner, phrased to distinguish downstream gaps.

### Leaf vs. non-leaf is structural; in-scope vs. out-of-scope is a tag
A shape is a leaf iff it has no `data.linkedDiagram`. Whether a shape is in scope
(internal) vs. out of scope (third party) is a diagram-configurable **tag
mapping** on `DiagramSecurity` (`externalTag?: {key, value}`), pointing at
whatever tag convention the diagram already uses. A diagram with no such mapping
treats every shape as **unclassified** (in scope, with a Diagnostics note), never
silently external. Only `shape`-type nodes are rollup candidates; a per-shape
opt-out is a tag, not schema.

## Alternatives considered
- **Persist derived cells with a `derived` flag + fingerprint.** Rejected:
  reintroduces the staleness problem it was trying to solve, churns git on every
  re-crawl, and mixes computed data into hand-authored `data.security`.
- **Honor each file's own saved modes during rollup.** Rejected: produces a
  matrix whose columns were computed by different formulas — "confidently
  inconsistent", the worst failure mode for a security artifact — and forces a
  "whose mode wins" decision at every level.
- **Keep modes persisted per diagram** (what ADR 0082 shipped). Superseded: with
  rollup, a persisted per-file mode is either ignored (pointless) or honored
  (inconsistent). Session-only is the only coherent option once traversal exists.
- **A shared threat catalog across a diagram tree.** Correct long-term, much
  larger (needs a catalog identity/ownership model). Deferred; normalized-name
  matching is the v1.

## Consequences
- **Amends [ADR 0082](0082-security-data-schema.md):**
  `DiagramSecurity.combineMethod` / `aggregateMethod` are **dropped from the
  persisted schema** — they become renderer session state. Readers ignore them if
  present in an older file; writers stop emitting them. No in-repo `.chd` carries
  a `security` block yet, so there is nothing to migrate. `docs/file-format.md`'s
  Security section updated.
- `DiagramSecurity` gains `externalTag?: { key: string; value: string }`.
- New **side-effect-free** main IPC (`security:crawlLinked`) — resolves
  `linkedDiagram` paths ([linkPaths.ts](../../src/main/linkPaths.ts)), reads +
  `parseDiagram`s each file, walks depth-first, returns each matrix shape's
  flattened subtree leaf cells keyed by normalized threat name. Must **not** call
  `recordOpenedOrSaved` (unlike `diagram:openPath`).
- `threatMatrixMath.ts` moves to `@shared/` (already a pure, dependency-free
  module) so the crawl result and the view share one implementation.
- `ThreatMatrixView` gains a memory-cached crawl result, a Refresh control,
  derived-column rendering, and the read-only derived-cell breakdown.
- Unblocks the reserved "Security score" property-panel field (overlaps
  [epic 0107](../planning/epics/0107-per-element-security-exposure.md)).

## Implementation notes (2026-09-08)

- **`security:crawlLinked`** (`src/main/security.ts`) takes the open diagram's
  path + the `{shapeId, relativePath}` list of its linked matrix shapes;
  returns `{ columns: Record<shapeId, CrawledColumn>, warnings: string[] }`.
  Reuses `openDiagramAtPath` (the read+parse with no recent-diagrams write) and
  `resolveLinkPath`. `path.resolve()` normalises before the visited-set check.
- **Broken links mark cells, they don't fail.** A root column whose direct
  `linkedDiagram` doesn't resolve → `{kind:'broken'}`; its cells render with a
  red diagonal hatch and are inert (the user's ask). A broken link *deeper* in
  a subtree → a `warnings` entry + that shape contributes nothing to the
  rollup (`CrawledShape.linkBroken`, skipped by `threatScoreFor`).
- **v1 row set = the matrix's own catalog only.** Threat names assessed only
  in linked subtrees are surfaced as a note ("Linked diagrams also assess: …")
  rather than shown as virtual rows — virtual rows need a synthetic identity
  and can't be assessed in a normal column, so they're deferred. Matches the
  intended workflow: add the threat to the parent catalog to see it roll up.
- **Modes are the active view's, session state in `Canvas.tsx`**
  (`securityCombineMethod` / `securityAggregateMethod`), passed down; a mode
  change recomputes derived cells from the cached crawl with no re-crawl.
- **Crawl triggers:** entering the matrix persona + an explicit "↻ Refresh
  links" button. No cooldown throttle yet — that's a follow-up (epic 0081
  item 6).
- **Derived cell click → read-only breakdown popup** (source path, contributing
  assessment count, "Open <linked diagram>"), never the P/C editor.
