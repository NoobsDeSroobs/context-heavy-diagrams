# 0075: Container hierarchy integrity and visibility

## Status
Accepted (2026-08-30)

## Context

A user's "Project Overview" diagram surfaced three bugs that share one
root theme — a node's `parentId` (the container-nesting link, ADR 0012) drifting
out of sync with what the user sees, then failing in an opaque way. All three are
recorded in [docs/known-issues.md](../known-issues.md); the epic is
[0103](../planning/epics/0103-container-hierarchy-integrity.md).

1. **Clicking a container selects a larger container that visually encloses it.**
   In the file, the big outer box was a *child* of the small inner one. React
   Flow forces a child's effective z-index to `parentZ + 1` regardless of the
   explicit value (`@xyflow/system` `calculateChildXYZ`:
   `z: parentZ >= childZ ? parentZ + 1 : childZ`) — so the child won the
   hit-test, while this app's Layers panel (reads raw `data.zIndex`) showed the
   parent on top. Nothing reconciled the two or told the user.
2. **"Attach contained shapes" flung a node to the canvas origin.**
   `attachContainedNodes` filtered candidates by `!n.parentId` but never checked
   whether a candidate was an *ancestor* of the target container. Attaching an
   ancestor makes a parent cycle → React Flow reads an unpositioned parent's
   `positionAbsolute` as `{0,0}` → the node collapses to the origin. The
   drag-to-reparent path (`onNodeDragStop`) already guards this with an
   `isDescendantOf` check; `attachContainedNodes` was never given the equivalent.
3. **Pasted children of a container carried a dangling `parentId`.**
   `remapForPaste` spread `...n` and never touched `parentId`. Copy a shape out
   of a container without the container (or into another diagram) → the pasted
   node points at a container that isn't there. Also the confirmed root cause of
   the older Open issue "pasting a child-of-a-container lands far off screen."

The user also asked that the Layers panel show these parent/child relationships,
so they can be spotted and understood rather than only surfacing as mystery
misbehaviour.

## Decision

### 1. `remapForPaste` handles `parentId` explicitly

- **Parent is in the payload** (the container was copied too): remap `parentId`
  through the same `idMap` already built for node ids. Keep the child's
  `position` untouched — it is parent-relative and stays valid relative to the
  remapped parent. The child is *not* given the centroid-recenter offset; only
  top-level pasted nodes are.
- **Parent is not in the payload** (orphaned child, or cross-diagram paste):
  strip `parentId`. The node becomes top-level and does get the centroid-recenter
  offset like any other top-level pasted node.
- The paste centroid is now computed over **top-level-within-payload nodes only**,
  so mixing a container's small parent-relative child coordinates into the
  average no longer skews where the group lands.
- The merged node array is run through `sortNodesForHierarchy` on paste (it
  wasn't before), matching every other node-mutation path.

### 2. `attachContainedNodes` gets the ancestry + enclosure guards

Reuse the `isDescendantOf(candidateId, containerId)` shape from `onNodeDragStop`:
a candidate that is an ancestor of the container can never become its child.
Additionally skip a candidate whose bounds **enclose** the container — a box
bigger than its would-be parent shouldn't be swallowed by it (this is exactly the
inverted-nesting shape that caused bug 1).

### 3. Load-time healing — silent, with a Diagnostics note

`fromDiagramFile` heals a corrupt hierarchy before handing nodes to React Flow,
consistent with the existing silent `sortNodesForHierarchy` / `backfillZIndex`
defensive passes and the backward-compatible-loading rule (ADR 0029). No `.chd`
version bump.

- **Dangling `parentId`** (points at a node not in the file): dropped. The
  node's `position` numbers are kept and reinterpreted as absolute (the real
  parent is gone; nothing better is recoverable).
- **Parent cycle**: the link at the cycle's entry node is cut.
- Each class of repair adds one line to the Diagnostics panel
  (`"Removed N node reference(s) to a container that isn't in this file."` /
  `"Broke N circular container nesting relationship(s)."`). Session-only, same
  as the required-tags backfill notices — recomputed per load, never written to
  the file, never a growing log.

The heal only runs on **load**, not on every edit — an in-session edit can't
produce a dangling or cyclic `parentId` (the guards in decisions 1 and 2, plus
the existing `onNodeDragStop` guard, are the complete set of ways `parentId` is
written).

### 4. Outgrown child — warn only, no auto-fix

When a child's absolute bounds extend outside its parent's bounds, add a
Diagnostics advisory naming both nodes. Do **not** auto-un-parent it: the user
may have a slightly-overflowing child on purpose, and silently rewriting the
hierarchy on load is more surprising than a warning. No quick-fix button in this
epic — the existing detach affordances (drag out, delete container) already
cover the manual fix; a one-click fix can be added later if the warning alone
proves insufficient.

The advisory is a *standing* check (like the empty-legend advisory), computed in
`displayedDiagnostics` from the live node set, not the load-time `diagnostics`
state.

### 5. Layers panel — flat list, `parentId` shown as a badge

The list stays a **flat, raw-`data.zIndex`-ordered** list. Raw `data.zIndex` is
the layer the drag-to-restack gesture actually edits, so the panel keeps showing
that.

- Each row whose node has a parent gets an `in: <parent label>` badge. Clicking
  the badge points the panel at the parent row (reuses the existing
  point-at-on-canvas mechanism), so the relationship is navigable.
- A row whose child is forced above it by React Flow's `parentZ + 1` rule — i.e.
  the raw order and the effective (clickable) order disagree — gets a small
  "renders above its parent" marker. The full explanation is the outgrown-child
  Diagnostics advisory from decision 4.

An **indented tree** was the user's first instinct and is the richer display,
but it breaks the panel's "one flat descending array" model: `reorderZIndex`
and all the drop-slot geometry assume a flat list, and a tree forces a decision
on within-siblings vs. cross-group drag (and whether cross-group drag reparents —
a separate feature). Deferred to its own epic with its own design pass on drag
semantics, to be picked up only if the badge proves hard to follow on a
deeply-nested diagram. The badge is a smaller *complete* thing, not a broken
compromise.

### 6. A "Detach from parent" context-menu item; "Fill…"/"Border…" removed

Decision 4 leaves an outgrown (or otherwise unwanted) child fixable only by
dragging it clear of its container or deleting the container. Added a **"Detach
from parent"** item to the shape / container / text-node right-click menu, shown
only when that node has a `parentId`. It clears `parentId` and rebases the
node's `position` from parent-relative to absolute so it doesn't jump — the
one-click inverse of drag-out / "Attach contained shapes" (`detachFromParent`
in `Canvas.tsx`, on `DiagramContext`).

The node context menu was already long, so **"Fill…" and "Border…" were removed**
from it at the same time (`ShapeNode` / `ContainerNode`). Colour is fully
editable in the Property panel's style section; the menu popups were a
convenience duplicate, and structural actions (detach, attach, connection
points) are a better fit for a right-click menu than styling. The
`openColorPicker` / `ColorPickerPopup` wiring in `Canvas.tsx` is now
unreachable — left in place for now (functional, no cost), flagged for removal.

## Alternatives considered

- **Heal silently with no note** (decision 3): rejected — a file that changes
  shape on next save with zero trace is the kind of thing that erodes trust in
  the tool. The note costs one line.
- **Heal only via a Diagnostics quick-fix button, load as-is** (decision 3):
  rejected — leaves the diagram visibly broken (nodes at origin, wrong click
  targets) until the user finds and clicks the button. The corruption has no
  legitimate meaning to preserve.
- **Auto-un-parent an outgrown child on load** (decision 4): rejected as above —
  overrides possibly-deliberate hierarchy silently.
- **Make the Layers panel show effective (React-Flow-resolved) z-order**
  (decision 5): rejected — then the panel's displayed order and the order the
  drag gesture edits would diverge for nested nodes, which is a worse kind of
  lying than the current one. The "renders above its parent" marker closes the
  gap without that divergence.
- **Reconcile by forcing this app's z-model to win** (decision 1's root):
  not possible — `parentZ + 1` is applied inside `calculateChildXYZ`
  unconditionally, even under `zIndexMode: 'manual'`. "A child always renders
  above its parent" is a React Flow invariant this app documents and works with,
  not around.

## Consequences

- `docs/file-format.md`'s `zIndex` field note ("compared directly against every
  other node's zIndex regardless of type … no separate rule") is now qualified:
  true for *sibling* nodes, but React Flow forces a child above its parent
  regardless of the stored values. `parentId` field note gains the load-time
  healing behaviour (dangling dropped, cycles broken).
- `remapForPaste`'s signature is unchanged; its behaviour for a payload that
  contains a container and its children now round-trips the nesting.
- No `.chd` format change. Existing corrupt files self-heal on next open + save.
- The empty-legend advisory established the "standing check folded into
  `displayedDiagnostics`" pattern; the outgrown-child advisory is the second use.
- The node right-click menu loses "Fill…"/"Border…" and gains a conditional
  "Detach from parent". `Canvas.tsx`'s colour-popup state / `openColorPicker` /
  `<ColorPickerPopup>` render are now dead code pending a follow-up removal.
