# 0135: Remove the placeholder anchor node — an edge dropped in empty space spawns an Entity

## Status
Not Started — logged 2026-10-15 from a user ask (raised while working on [epic 0133](0133-ai-onboarding.md)). Needs a short design pass (open questions below) and an ADR superseding [ADR 0015](../../decisions/0015-anchor-placeholder-node.md) before implementation.

## Goal
Remove the `anchor` placeholder node as a user-facing feature. Dropping a new edge — or an existing edge's endpoint ([epic 0033](completed/0033-edge-reconnection.md)) — on empty canvas now creates a real **Entity** at the drop point, instead of a tiny unlabeled 14px `AnchorNode` plus a "Entity / Container?" popup. One fewer node type to explain, render, style-exclude, lock-exclude and document; and no state where a diagram contains an unresolved dangling thing.

## Why
[ADR 0015](../../decisions/0015-anchor-placeholder-node.md) introduced the anchor so a dropped edge had *something* to point at while the user chose a type, or to "leave the edge in space." In practice the placeholder is a special case threaded through the codebase (≈25 touch points: `Canvas.tsx`, `AnchorNode.tsx`, `MultiConnectionLine`, `styleBrush`, `LayerPanel`, locking/metadata rules, file-format docs) for a state the user is now saying they don't want.

## Tasks
- [ ] Design pass + ADR (supersedes ADR 0015; revisit [ADR 0021](../../decisions/0021-connection-point-removal-blocked.md)'s note that an anchor could re-target an edge on point removal)
- [ ] New-edge drop on empty canvas ([`Canvas.tsx` ~3160](../../../src/renderer/src/Canvas.tsx)) creates an Entity (default size/style from `defaultStyles.entity`), no popup
- [ ] Edge-endpoint reconnect drop on empty canvas ([`Canvas.tsx` ~3229](../../../src/renderer/src/Canvas.tsx)) does the same
- [ ] Multi-connection-line drop path (`MultiConnectionLine.tsx`, [ADR 0059](../../decisions/0059-multi-connection-line.md)) — decide per-edge behaviour: one Entity for the whole drop, not one per line
- [ ] Remove `resolveAnchorNode`, the type-choice popup for this path, `AnchorNode.tsx`, its CSS, and the `anchor` special cases (`styleBrush`, `LayerPanel`, handle-type checks, `diagram.ts` comments)
- [ ] Load compatibility — see open question 1
- [ ] Update `docs/file-format.md` (Node `type` row), `src/shared/aiInstructions.ts` and the `chd-diagrams` skill, architecture overview, glossary if it mentions anchors
- [ ] Tests: the `styleBrush` anchor case; add coverage for whatever load-time handling is chosen
- [ ] Live-test (Electron): drop new edge, drop reconnected endpoint, multi-select drop, undo is one step

## Open questions
1. **Existing files with `"anchor"` nodes** ([ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md): old files must keep loading). Options: (a) keep a minimal render-only path for legacy anchors forever; (b) migrate on load into small Entities (`normalizeLegacyFields`, as done for `shape` → `entity` in [ADR 0101](../../decisions/0101-shape-to-entity-rename.md)) — preferred direction, keeps one code path, but changes appearance of any diagram that has anchors.
2. **Where exactly is the Entity placed, and how big?** Centered on the drop point or top-left at it; default Entity size, or a smaller one. Likely centered so the arrow visibly lands on the box's nearest connection point.
3. **Is there any way left to get a Container from a drop?** Today's popup offered Entity or Container. Dropping the choice is the ask; check whether an "convert type" / right-click path already exists, or whether that is a small follow-up.
4. **Escape / cancel mid-drop** previously left the anchor; with no popup there is nothing to dismiss — confirm undo (one step) is the cancel path.
5. **Label focus:** should the new Entity enter label-edit mode immediately, as most diagram tools do?

## Notes
- Cross-platform: pure renderer logic; nothing OS-specific.
- Related backlog: [epic 0065](later/0065-bus-relay-node.md) (bus/relay node) is the other "a point edges attach to" idea — keep the two decisions consistent.
