# 0107: Remove the anchor placeholder node — an edge dropped on empty canvas spawns an Entity

## Status
Accepted (2026-10-15). Supersedes [ADR 0015](0015-anchor-placeholder-node.md).

## Context
ADR 0015 added `AnchorNode`, a 14px unlabeled placeholder, so that an edge
dragged (or re-dragged by its endpoint) onto empty canvas had a real node to
point at while a popup asked "Entity / Container?". Dismissing the popup left
the anchor behind as a persisted, dangling node.

The user no longer wants that state. A diagram should never contain an
unresolved placeholder, and the placeholder had become a special case threaded
through the renderer: the node-type registry, the connectable-type checks (in
`Canvas.tsx` and `MultiConnectionLine.tsx`), `styleBrush`, the layer panel,
the lock/metadata rules, CSS, and the format docs.

## Decision
- **Dropping an edge on empty canvas creates an Entity**, with no popup. This
  covers both triggers: a brand-new edge dragged from a handle, and an existing
  edge's endpoint reconnected onto empty canvas. The old `spawnAnchorAt` becomes
  `spawnEntityAt`.
- **Placement and size:** the Entity is centered on the drop point, default
  Entity size, default Entity style, seeded required-tag metadata and a fresh
  `zIndex` — exactly what a palette drop produces. The edge attaches to the
  Entity's left connection point, as it did on the anchor.
- **Label focus:** the new Entity enters label-edit mode immediately, with its
  default text selected. This is a small piece of transient renderer state in
  `Canvas.tsx` (a "pending label edit" node id, read via `DiagramContext`), not
  stored in the node's data, so it never reaches the file or the undo history.
- **Undo is the cancel path.** The Entity and the edge are created in one undo
  step; there is nothing to dismiss.
- **Containers are no longer offered by this gesture.** A drop always yields an
  Entity. Getting a container still works via the palette and the toolbar.
- **Deliberate breaking change — no load-time migration.** This is an
  exception to [ADR 0029](0029-backward-compatible-loading-is-a-standing-rule.md)'s
  standing rule, taken on purpose: the only files known to contain anchors were
  the two gallery examples, which were edited by hand (each anchor and its two
  edges collapsed into one direct edge). A migration in `normalizeLegacyFields`
  was written first and then removed as complexity for a case that no longer
  exists. A file that still contains an `"anchor"` node is not supported: the
  type is unregistered, so React Flow falls back to its default node for it.
  No `version` bump.
- **Multi-connection-line:** unchanged in scope. An empty-canvas drop only ever
  wired the single edge from the handle actually dragged (the multi-edge fan-out
  lives in `onConnect`, which needs a real target). The preview line component
  just stops treating `anchor` as a connectable type.

## Alternatives considered
- **Keep a render-only path for legacy anchors forever.** Rejected: it preserves
  exactly the special case this change exists to remove, for a state the user
  does not want.
- **Migrate anchors into Entities on load** (the approach first implemented,
  mirroring the shape → entity rename). Rejected after the fact: with almost no
  anchor-bearing files left in existence, the extra load-time code was not worth
  carrying.
- **Keep the popup but default to Entity.** Rejected: the popup is the friction
  being removed.
- **Don't auto-enter label editing.** Rejected: nearly every diagramming tool
  does it, and an unlabeled-looking default "Entity" box is easy to leave behind.
- **A truly free-floating edge endpoint** (the other alternative ADR 0015
  rejected). Still rejected for the same reason: it needs a second code path
  for every reader of an edge's endpoints.

## Consequences
- One fewer node type. `nodeTypes` is back to `entity`, `text`, `container`,
  `line`. `AnchorNode.tsx` and its CSS are deleted.
- Existing diagrams with anchors stop being supported (see the breaking-change
  decision above). The two gallery examples that had one
  (`meridian-rail-landscape.chd`, `c4-container.chd`) were fixed by hand.
- [ADR 0021](0021-connection-point-removal-blocked.md)'s note that an anchor
  could re-target an edge when a connection point is removed no longer applies;
  point removal stays blocked while an edge is attached.
- A bus/relay node (`later/0065`) was framed as an upgrade of the anchor. That
  idea now starts from a clean slate and must be a new node type.
- No in-place "convert Entity to Container" action exists yet. If dropping an
  edge and wanting a container turns out to matter, that is a small separate
  follow-up.
