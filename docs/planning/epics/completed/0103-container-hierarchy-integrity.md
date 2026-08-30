# 0103: Container hierarchy integrity and visibility

## Status
Done — on `epic/0103-container-hierarchy-integrity`, PR ready (2026-08-30).
Design pass done, [ADR 0075](../../../decisions/0075-container-hierarchy-integrity.md)
written, all implementation landed; `typecheck` + `lint` clean (0 errors). The
user live-tested the Layers-panel `in: <container>` badge + clickable point-at
and confirmed it works well; the other live-test items below (paste, attach,
load-time heal on the Project file, detach) are covered by the same code paths but
not each independently re-confirmed — merging on the badge confirmation, per the
user. `x`-prefix / move to `completed/` is deferred to the completed-epics
reorg (its own branch + ADR, after this merges).

## Goal
Fix the class of bugs where a container's parent/child (`parentId`) data drifts
out of sync with what the user sees, and make those relationships visible in the
Layers panel so they can be spotted and understood instead of only surfacing as
mystery misbehaviour.

## Background — three real bugs, one theme
Found while diagnosing a user's "Project Overview" diagram (2026-08-29). All
three are logged in [docs/known-issues.md](../../../known-issues.md):

1. **Clicking a container selects a different container that visually encloses
   it.** The data had "Container B" as a *child* of "Container A", but
   geometrically Container B is the larger outer box. React Flow forces a
   child's z-index to `parentZ + 1` (`@xyflow/system` `calculateChildXYZ`:
   `z: parentZ >= childZ ? parentZ + 1 : childZ`), overriding this app's
   `data.zIndex` model (ADR 0035) — so the child wins the click even though the
   Layers panel (reads raw `data.zIndex`) shows the parent on top. **The Layers
   panel is misleading.**
2. **"Attach contained shapes" can fling a node to the canvas origin.**
   `attachContainedNodes` (`Canvas.tsx`) filters candidates by `!n.parentId` but
   never checks whether a candidate is an *ancestor* of the target container.
   Attaching an ancestor creates a parent cycle → React Flow can't compute
   positions → the node collapses toward origin. The drag-to-reparent path
   (`onNodeDragStop`, `isDescendantOf` guard) already handles this;
   `attachContainedNodes` doesn't.
3. **Pasted children of a container keep a `parentId` to a container that isn't
   there.** `remapForPaste` (`clipboard.ts`) spreads `...n` and never remaps or
   strips `parentId`. Copy shapes out of a container without the container (or
   paste into another diagram) → dangling `parentId`. This is also the root cause
   of the existing Open issue "pasting a child-of-a-container lands far off
   screen."

## Design decisions
Settled with the user 2026-08-30, recorded in
[ADR 0075](../../../decisions/0075-container-hierarchy-integrity.md):
- Load-time healing: **silent + a Diagnostics note.**
- Outgrown child (bug 1's shape): **warn only, no auto-fix / quick-fix.**
- Layers panel: **flat list + an `in: <container>` badge**, not an indented
  tree. The tree is a cleaner display but breaks `reorderZIndex`'s flat-array
  model and forces a within-siblings-vs-cross-group drag decision — deferred to
  its own epic, to be picked up only if the badge proves hard to follow.
- Panel keeps sorting on **raw `data.zIndex`** (the value drag edits); a
  "renders above its parent" ⚠ marker flags rows where React Flow's forced
  order disagrees.

## Tasks
- [x] **`remapForPaste`** (`clipboard.ts`) — parent in payload → remap
  `parentId` via `idMap`, keep the child's relative position, no centroid
  offset; parent not in payload → strip `parentId`, treat as a normal
  top-level paste. Centroid now computed over top-level-in-payload nodes only.
  `pasteFromClipboard` wraps the merged array in `sortNodesForHierarchy`.
- [x] **`attachContainedNodes`** (`Canvas.tsx`) — candidate filter now also
  rejects an ancestor of the container (parent-cycle guard, mirrors
  `onNodeDragStop`'s `isDescendantOf`) and any candidate whose bounds *enclose*
  the container.
- [x] **Load-time heal** — new `healHierarchy` in `Canvas.tsx`, called by
  `fromDiagramFile` before `sortNodesForHierarchy`: drops an unresolvable
  `parentId`, cuts the entry link of any parent cycle. Returns `hierarchyNotes`
  → new session-only `hierarchyLoadNotes` state → `displayedDiagnostics`.
- [x] **Diagnostics** — `hierarchyAnalysis` memo: outgrown-child advisory
  (standing, from the live node set) + the load-time heal notes, both folded
  into `displayedDiagnostics`.
- [x] **Layers panel** — `LayerRow` gains `parentLabel` / `parentId` /
  `rendersAboveParent`; a clickable `in: <container>` badge (points the panel
  at the parent row) with a ⚠ when the raw and effective order disagree. New
  `.layer-row-parent*` CSS. Flat list + raw-zIndex sort unchanged.
- [x] **"Detach from parent" context-menu item** (shape / container / text,
  shown only when the node has a `parentId`) — new `detachFromParent` in
  `Canvas.tsx` / `DiagramContext`, clears `parentId` and rebases position to
  absolute. Decision 6 in ADR 0075. Same change removed "Fill…"/"Border…" from
  the node context menu — no capability lost, the Property panel's Fill/Border
  sections already cover colour + opacity + width.
- [x] `typecheck` + `lint` clean (0 errors; pre-existing `bendPoints` / `points`
  warnings in `LabeledEdge` unchanged).
- [x] `docs/file-format.md` — `zIndex` field note qualified (sibling-only;
  parent-above-child is a React Flow invariant); `parentId` field note gains
  the load-time healing behaviour.
- [ ] **USER — live test (Electron):**
  - Open the "Project Overview" diagram → the ~18 dangling `parentId`s are
    dropped, a Diagnostics note says how many; the outgrown-child warning names
    Container A / Container B.
  - Select Container B → "Attach contained shapes" → no node jumps to
    the origin.
  - Copy a shape *out* of a container (without the container), paste → lands at
    the viewport centre, top-level, no dangling parent. Copy a container *with*
    its children, paste → nesting preserved, group lands at centre.
  - Layers panel → nested rows show `in: X`; clicking the badge points at the
    parent; the inverted pair shows ⚠. **✅ live-confirmed by the user
    2026-08-30 — "works so well."**
  - Right-click a shape/container/text that's inside a container → "Detach from
    parent" appears, and using it pops the node out without moving it visually;
    the item is absent on a top-level node. "Fill…"/"Border…" are gone from the
    shape + container menus.
- [x] Flip Status to Done, update `PROGRESS.md`. `x`-prefix / `completed/` move
  deferred to the completed-epics reorg.

## Follow-up logged
- Indented-tree Layers panel (with a real design pass on drag semantics) — only
  if the badge proves insufficient. Not yet a numbered epic.
- **Delete the orphaned colour-picker popup** — `openColorPicker` /
  `colorPicker` state / escape handling / `<ColorPickerPopup>` render in
  `Canvas.tsx`, the `ColorPickerPopup` component, and its `main.css` rules are
  all unreachable now that "Fill…"/"Border…" are off the context menu (nothing
  else opens it — the Property panel has its own colour fields). ~60 lines
  across ~4 files. Left for a dedicated cleanup pass per the user, not this PR.

## Notes
- No `.chd` format change — consistency of existing fields + load-time healing.
- `healHierarchy` runs only on load; every in-session `parentId` write is
  guarded (`onNodeDragStop`, `attachContainedNodes`, `remapForPaste`).
