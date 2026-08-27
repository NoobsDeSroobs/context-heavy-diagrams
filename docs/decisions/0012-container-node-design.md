# 0012: Container node — connectable, not rotatable; deletion promotes children

## Status
Accepted

## Context
[The project brief](../project-brief.md:12) states "shapes and containers must be resizable and rotatable." [ADR 0004](0004-shape-text-node-split.md) split nodes into `ShapeNode` (resizable, connectable, never rotates) and `TextNode` (resizable, rotatable, never connectable) specifically because React Flow computes edge-attachment (`Handle`) positions against a node's *unrotated* bounding box — rotating a connectable node makes edges visually misattach, a structural bug, not a cosmetic one. That ADR's Consequences section presumed containers would be "non-rotatable like `ShapeNode`... for the same structural reason," quietly overriding the brief's literal wording without it being raised as a real decision at the time.

Implementing containers is where that presumption actually has to be confirmed or reversed, because a container plausibly needs edges attached to it directly (e.g. an external system connecting to a "VPC" or "security zone" container as a whole, not to one of its children) — unlike `TextNode`, which never needed connectivity in the first place.

Separately: deleting a container needs a defined behavior for what happens to the nodes inside it. The brief's stated failure mode to avoid is "grouping mechanisms that make it hard to edit individual elements independently afterward" — cascading deletion is the sharper version of that same problem (losing children's data entirely, not just making them hard to edit).

## Decision
**Container is connectable, not rotatable** — same structural category as `ShapeNode`, not `TextNode`. Confirmed directly with the user rather than left as an unstated presumption. This is a deliberate deviation from the brief's literal "resizable and rotatable" wording for containers specifically: the alternative (rotatable *and* connectable) requires transforming handle positions into the node's own rotated local frame for correct edge attachment — real, previously-deferred work (see ADR 0004's Alternatives), not a small addition, and not worth it for a first version. Revisit only if not being able to rotate a container is reported as an actual limitation in practice.

**Container deletion promotes children, doesn't cascade.** Deleting a container reparents its direct children to the container's own parent (or top-level, if the container wasn't itself nested) and removes only the container node itself. Children survive with their data intact — consistent with the brief's "don't make grouping hard to undo/edit around" principle, and safer against accidental data loss than cascade-delete.

**Nesting containers inside containers is allowed**, not restricted to one level. React Flow's `parentId` model supports arbitrary depth natively — restricting it would mean adding validation code to prevent something the underlying mechanism already handles correctly, more work than just allowing it. Not explicitly requested, but the cheaper default given the primitive in use.

**Schema**: `DiagramNode` gains an optional `parentId?: string`, referencing another node's `id`. Empty/absent means top-level (no container). Maps directly to React Flow's own `Node.parentId`; `extent: 'parent'` (clamping a child's drag/resize to its container's bounds) is derived at runtime from `parentId`'s presence, not stored — same reasoning as connection points' default-4 points not being explicitly stored.

## Alternatives considered
- **Rotatable, not connectable** (matches `TextNode`'s category instead): rejected — a container that can never have an edge attached to it is a real capability gap for IT architecture diagrams specifically (boundary/zone objects are exactly the kind of thing an edge often needs to terminate at).
- **Both rotatable and connectable**: rejected for now — real, deferred technical work (rotated handle-position math), not proportionate to a first version. Not ruled out permanently.
- **Cascade-delete children with their container**: rejected — directly conflicts with the brief's stated anti-goal around grouping mechanisms losing/complicating access to individual elements.

## Consequences
- `ContainerNode` is a third node component alongside `ShapeNode`/`TextNode`, structurally closer to `ShapeNode` (resizable, `Handle`s, no rotation) but visually distinct (border/title-bar container look, not a filled shape) and must render as a valid React Flow parent for other nodes.
- `nodeTypes` gains a `container` entry.
- Any node's `onNodeDragStop` handling needs new logic: detect drag-into/out-of a container via intersection with container bounds, update `parentId` and convert the dragged node's `position` between absolute and parent-relative coordinate spaces accordingly. React Flow requires a parent node to appear before its children in the `nodes` array — reparenting must preserve that ordering invariant, not just patch `parentId` in place.
- Container deletion needs its own removal path (not the generic multi-select delete-all-selected path) so children get reparented rather than removed alongside their container.
- `docs/file-format.md` needs a `parentId` entry once this ships, matching the existing per-field table format.
