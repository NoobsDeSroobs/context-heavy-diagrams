# 0012: Containers are connectable and not rotatable, deletion promotes children, and the hierarchy is kept honest

## Status
Accepted. Merges 0012 (the container node) and 0075 (container hierarchy integrity and visibility) into one decision, reworded 2026-11-26. It keeps the lowest number of the group.

## Context
[The project brief](../project-brief.md) says shapes and containers must be resizable and rotatable. React Flow computes where an edge attaches against a node's unrotated bounding box, so rotating a connectable node makes edges visibly misattach, a structural bug and not a cosmetic one; that is why text can rotate but never connect. A container plausibly needs edges attached to it directly, an external system joining a "VPC" or a "security zone" as a whole. The brief's anti-goal is grouping that makes individual elements hard to edit afterwards, and cascading deletion is the sharper form of it.

A real diagram then showed that a node's `parentId` can drift out of sync with what the person sees and fail in an opaque way: a larger container that visually encloses a smaller one but is its child, so a click selects the wrong one; an ancestor attached into its own descendant, a parent cycle, which collapses the node to the canvas origin; and a pasted child pointing at a container that is not there.

## Decision
**A container is connectable and not rotatable, deleting one promotes its children, and the hierarchy is kept in sync with what is drawn.**

- **Connectable, not rotatable.** A container is in the same category as an entity and not as text. This is a deliberate deviation from the brief's wording: rotatable and connectable would need handle positions transformed into the node's rotated frame, real work not worth doing for a first version. It is revisited only if not rotating a container is reported as a real limit.
- **Deletion promotes, never cascades.** Deleting a container moves its direct children to the container's own parent (or the top level) and removes only the container. Children keep their data. A container has its own removal path for this, apart from the generic delete.
- **Nesting is allowed to any depth,** since React Flow's `parentId` supports it and restricting it would be code to prevent what already works. `parentId` is stored; the clamping of a child to its parent (`extent`) is derived, not stored. A parent must come before its children in the node list, and every path that changes `parentId` keeps that order.
- **No path may write a `parentId` that is wrong.** A node cannot become a child of its own descendant, nor of a container smaller than itself that it encloses. A paste remaps `parentId` through the same id map as the nodes when the parent is pasted too and keeps the child's parent-relative position; when the parent is not in the paste (a copy out of a container, or into another diagram) it drops `parentId` and the node becomes top level. The paste centroid counts only top-level nodes, so small parent-relative coordinates do not skew where the group lands.
- **A corrupt hierarchy is healed on load, silently, with a note.** A `parentId` that names a node not in the file is dropped, keeping the position as absolute; a cycle is cut at its entry node. Each kind of repair adds one line to Diagnostics, for the session only. It heals only on load, since no edit can produce either. No format version change is needed, and the repair counts as a change to save ([0040](0040-unsaved-work-and-outside-changes-are-never-lost-or-silently-overwritten.md)).
- **A child that outgrew its parent is warned about, not fixed.** A child whose bounds extend outside its parent's gets a standing Diagnostics advisory naming both. It is never re-parented automatically, since the person may have it overflowing on purpose and silently rewriting the hierarchy is more surprising than a warning. The one-click fix is **Detach from parent** in the right-click menu, which clears `parentId` and rebases the position so the node does not jump.
- **React Flow draws a child above its parent, always,** whatever the stored z-index says: an invariant this app documents and works with, not around. The layers panel stays a flat list in the order that the drag gesture edits, shows `in: <parent>` on a row with a parent (and navigates to it), and marks a child that renders above its parent. An indented tree was rejected for now because it breaks the flat-list model of drag-to-restack.

## Alternatives considered
- **Rotatable and not connectable,** like text. A container that can never have an edge is a real gap for boundary and zone objects.
- **Cascade-delete the children.** It conflicts with the brief's anti-goal and risks losing data.
- **Heal silently with no note,** or **heal only through a button.** The first leaves a file that changed shape with no trace; the second leaves the diagram visibly broken until someone clicks.
- **Auto-un-parent an outgrown child on load.** It overrides a possibly deliberate hierarchy.
- **Make the layers panel show the effective z-order.** It would then disagree with the order the drag gesture edits, a worse kind of lying than the marker.

## Consequences
- A container is a third node component beside entity and text, a valid React Flow parent, and reparenting converts a node's position between absolute and parent-relative coordinates.
- `docs/file-format.md` records `parentId` and its healing, and qualifies the z-index note: it holds between siblings, but a child is always drawn above its parent.
- Existing corrupt files heal on the next open and save.
- The layers panel is a smaller complete thing and not a broken compromise; a tree is a separate piece of work with its own design pass on drag semantics.
