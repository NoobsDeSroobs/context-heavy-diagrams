# 0043: Per-element lock

## Status
Accepted

## Context
Raised by the user (2026-08-22) while testing the Meridian Rail landscape: "as complexity increases accidental selections and relocation becomes more likely and more annoying." The app already has a *global* lock (React Flow's own built-in `<Controls>` interactivity toggle, entirely internal to the library — nothing in `Canvas.tsx` wires it explicitly), which locks every element at once. The ask here is the complementary per-element case: lock specific shapes/containers/text individually, leaving the rest of the diagram editable.

## Decision
- **Scope: blocks drag, resize, rotate, and accidental delete — not a read-only mode.** Style edits, tags, connection points, label, details all stay editable through the property panel while locked. The user asked directly whether full read-only would be *easier* to build; it's actually the opposite — transform-only touches a handful of well-contained spots (React Flow's own native `draggable`/`deletable` per-node overrides, plus this app's own resize/rotate handle rendering), where full read-only would mean threading a locked-check into every property-panel field, every context-menu item, and every picker individually. Simpler and matches what the user actually needed: "stop mouse-based transformation... maintain the ability to highlight objects in the canvas."
- **Still selectable.** Only drag/resize/rotate/delete are blocked — clicking a locked element still selects it (property panel inspection, highlight matching) normally, matching how locking works in most design tools (Figma, PowerPoint, etc.).
- **Independent per element, no container-to-child cascade.** Locking a container doesn't touch its children's own lock state — matches how every other per-node property in this app already works, no hidden side effects. Multi-selecting several elements and toggling the property panel's checkbox applies the same lock state to all of them at once (ordinary bulk-edit behavior, not cascade).
- **Edges excluded entirely** — no position of their own to accidentally relocate, per the user's own explicit scoping.
- **Visual indicator**: a small grey lock glyph, centered horizontally, straddling the element's own top edge (half above, half below) — per the user's own placement spec.

## Alternatives considered
- **Full read-only lock.** Rejected — see Decision; more implementation surface for a stricter behavior than was actually asked for.
- **Fully inert (unselectable) while locked.** Rejected — the user explicitly wants to keep highlighting/inspecting a locked element; only the accidental-modification gestures are the actual pain point.
- **Locking a container cascades to its children.** Rejected for now — kept independent, consistent with the rest of the per-node property model. The user flagged that a *future* "groups" feature (a persisted set of elements acting as one resource, not yet designed or built — distinct from containers, which already exist) should cascade lock to its members once it exists; noted here for whenever that gets designed, not acted on now.

## Consequences
- New `DiagramNode.locked?: boolean` field (`shared/diagram.ts`, `docs/file-format.md`) — additive, absent means unlocked, same backward-compatible pattern as every other optional node field (ADR 0029).
- Stored as `data.locked` internally (same "data.X internally, top-level file field externally" pattern as `rotation`/`zIndex`), converted to React Flow's native `draggable`/`deletable` node overrides at the point nodes are actually handed to `<ReactFlow nodes={...}>` (`Canvas.tsx`'s `zIndexedNodes`) — `selectable` deliberately left untouched.
- Resize (`NodeResizer isVisible`) and rotate (TextNode's own drag handle) are custom to this app, not native React Flow — each gated on `selected && !locked` directly in `ShapeNode`/`ContainerNode`/`TextNode`.
- New shared `LockBadge.tsx` component (inline SVG, not a builtin icon-slot asset — this is a system indicator, not user content) reused by all three node types rather than duplicated.
- Property panel gets a new "Locked" checkbox (tri-state for mixed selections) inside `NodeStyleFields`, the function already shared by shape/container/text — no per-type duplication needed since all three route through it.
