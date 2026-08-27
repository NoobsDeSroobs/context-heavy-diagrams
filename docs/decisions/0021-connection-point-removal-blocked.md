# 0021: Removing a connection point with an edge attached is blocked, not disconnected

## Status
Accepted

## Context
Custom connection points beyond a `ShapeNode`/`ContainerNode`'s 4 defaults are removable by right-clicking the point directly. That raised a question flagged as genuinely open back in the original resize/rotate scoping: if the point being removed has an edge attached to it, what happens to that edge?

## Decision
**Removal is blocked outright** (a clear alert shown to the user) whenever the point being removed has an edge attached — never "disconnect and dangle." This isn't a UX preference so much as a direct consequence of the data model: React Flow's `Edge` type requires both `source` and `target` to be valid node ids at all times. There is no representation in that model for a half-connected or dangling edge, so silently leaving one behind isn't actually an option without a structural workaround. Default (non-custom) points aren't removable at all in the first place — they're never represented in `connectionPoints`, so there's nothing to attach a remove action to for them.

## Alternatives considered
- **Disconnect and leave the edge dangling** (visually anchored at the point's last position, or hidden): rejected — not representable without inventing a new "edge with no real target" concept, real structural work with its own knock-on effects (rendering, hit-testing, persistence) for a case (removing a point that's actively in use) that's arguably rare and already has a clear, honest alternative: tell the user to remove the edge first.
- **Auto-delete the attached edge along with the point**: not seriously considered — silently destroying user data (an edge, which may carry a real label) as a side effect of an unrelated action is a worse failure mode than just blocking with a clear message.

## Consequences
- The block is a hard rule, not a confirmation dialog — the user must disconnect (delete or re-target) the edge first, then remove the point.
- **Conceptual tension with [ADR 0015](0015-anchor-placeholder-node.md), not yet resolved**: that ADR solves an *adjacent* dangling-edge problem — a newly-dragged edge with no resolved target — by backing it with a real placeholder node (`AnchorNode`) rather than inventing a "no target" edge representation. The same trick could, in principle, apply here too: instead of blocking removal, re-target the edge to a freshly-spawned `AnchorNode` at the point's last position. That was not considered at the time this decision was made (`AnchorNode` didn't exist yet), and isn't being retroactively adopted here — flagged as a real, deliberate option to weigh next time this specific interaction gets revisited, not decided as a side effect of writing this ADR after the fact.
