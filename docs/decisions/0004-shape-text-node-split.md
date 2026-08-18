# 0004: Split custom nodes into ShapeNode (connectable) and TextNode (rotatable)

## Status
Accepted

## Context
Epic [0002](../planning/epics/0002-resize-and-rotate.md) needs resize, rotate, and (folded in after epic 0001 testing) multiple connection points, all via a custom node component. React Flow computes edge-attachment points and resize-drag math against a node's *unrotated* bounding box — it has no built-in concept of rotation. Combining "has connection points" with "is rotatable" on the same node means edges would visually misattach whenever that node is rotated, since the math underneath doesn't rotate with the CSS transform.

## Decision
Two node types, not one general-purpose node:
- **`ShapeNode`**: resizable (`NodeResizer`), multiple connection points (`Handle`s, loose connection mode), **never rotatable**.
- **`TextNode`**: resizable, rotatable via a drag handle + CSS transform, **no connection points at all**.

Rotatable nodes never have edges attached, so the edge-misattachment failure mode described above can't occur — not mitigated, structurally impossible. The one residual risk (resize-drag math not accounting for the node's own rotation) is accepted as a v1 limitation, now scoped down to `TextNode` only.

No `'default'` type kept for backward compatibility with `examples/hello-world/diagram.json` — explicit user call: break it now while it's cheap, rather than carry a legacy type alias that could quietly cause future feature/styling divergence. The example gets regenerated with `type: "shape"` once `ShapeNode` exists.

**Schema** (additive to v1 per ADR 0003): `DiagramNode` gains optional `size: { width: number; height: number }` (mirrors React Flow's native `width`/`height`, which `NodeResizer` writes to directly — mapped in `toDiagramFile`/`fromDiagramFile`) and optional `rotation: number` (degrees; no native React Flow slot, so lives in `data.rotation` at runtime and gets hoisted to a top-level field on save, matching the brief's draft schema).

## Alternatives considered
- **One node type, rotation allowed with connection points**: rejected — this is the option that reintroduces the edge-misattachment problem the whole split exists to avoid.
- **Solve the rotation math properly now** (transform mouse/handle coordinates into the node's local rotated frame for both resize and edge attachment): real fix, but nontrivial, and no longer needed for the edge case at all since rotatable nodes can't have edges. Only remaining candidate use is `TextNode` resize-while-rotated, which isn't worth the complexity until it's actually reported as annoying in practice.
- **Keeping `'default'` as an alias for backward compat**: rejected per explicit direction — early-stage flexibility valued over free backward compatibility right now.

## Consequences
- `nodeTypes` on `<ReactFlow>` becomes `{ shape: ShapeNode, text: TextNode }` — no `default` entry.
- `examples/hello-world/diagram.json` needs regenerating (was `type: "default"`).
- Containers (epic 0004) will likely want a third node shape eventually, but that's out of scope here — presumed non-rotatable like `ShapeNode` when it's built, for the same structural reason.
- Alignment guides / snap-to-grid or snap-to-shape (requested during this discussion, not in the original brief) is tracked as its own backlog item — see [epic 0011](../planning/epics/0011-alignment-and-snapping.md) — not bundled into this epic.
