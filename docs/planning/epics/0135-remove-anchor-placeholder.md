# 0135: Remove the placeholder anchor node — an edge dropped in empty space spawns an Entity

## Status
Implemented 2026-10-15 on `epic/0135-remove-anchor-placeholder`, [ADR 0107](../../decisions/0107-remove-anchor-placeholder-node.md) (supersedes [ADR 0015](../../decisions/0015-anchor-placeholder-node.md)). `typecheck`/`lint`/`npm test` clean (124 tests). **Not yet live-tested** (Electron renderer) — see the last task.

## Goal
Remove the `anchor` placeholder node as a user-facing feature. Dropping a new edge — or an existing edge's endpoint ([epic 0033](completed/0033-edge-reconnection.md)) — on empty canvas now creates a real **Entity** at the drop point, instead of a tiny unlabeled 14px `AnchorNode` plus a "Entity / Container?" popup. One fewer node type to explain, render, style-exclude, lock-exclude and document; and no state where a diagram contains an unresolved dangling thing.

## Why
[ADR 0015](../../decisions/0015-anchor-placeholder-node.md) introduced the anchor so a dropped edge had *something* to point at while the user chose a type, or to "leave the edge in space." In practice the placeholder is a special case threaded through the codebase (≈25 touch points: `Canvas.tsx`, `AnchorNode.tsx`, `MultiConnectionLine`, `styleBrush`, `LayerPanel`, locking/metadata rules, file-format docs) for a state the user is now saying they don't want.

## Tasks
- [x] Design pass + ADR (supersedes ADR 0015; revisit [ADR 0021](../../decisions/0021-connection-point-removal-blocked.md)'s note that an anchor could re-target an edge on point removal)
- [x] New-edge drop on empty canvas ([`Canvas.tsx` ~3160](../../../src/renderer/src/Canvas.tsx)) creates an Entity (default size/style from `defaultStyles.entity`, centered on the drop, reparented into a container under it), no popup, label opens in edit mode
- [x] Edge-endpoint reconnect drop on empty canvas ([`Canvas.tsx` ~3229](../../../src/renderer/src/Canvas.tsx)) does the same
- [x] Multi-connection-line drop path (`MultiConnectionLine.tsx`, [ADR 0059](../../decisions/0059-multi-connection-line.md)) — an empty-canvas drop only ever wired the single dragged edge (the multi-edge fan-out lives in `onConnect`), so nothing to change beyond dropping `anchor` from the connectable-type check
- [x] Remove `resolveAnchorNode`, the type-choice popup for this path, `AnchorNode.tsx`, its CSS, and the `anchor` special cases (`styleBrush`, `LayerPanel`, handle-type checks, `diagram.ts` comments)
- [x] Load compatibility → decided against migrating: deliberate breaking change, the two examples fixed by hand — see open question 1
- [x] Update `docs/file-format.md` (Node `type` row), `src/shared/aiInstructions.ts` and the `chd-diagrams` skill, architecture overview, glossary if it mentions anchors
- [x] Tests: the `styleBrush` anchor case; add coverage for whatever load-time handling is chosen
- [ ] **Live-test (user)** (Electron): drop new edge, drop reconnected endpoint, multi-select drop, undo is one step

## Open questions
1. **Existing files with `"anchor"` nodes** ([ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md): old files must keep loading). Options: (a) keep a minimal render-only path for legacy anchors forever; (b) migrate on load into small Entities (`normalizeLegacyFields`, as done for `shape` → `entity` in [ADR 0101](../../decisions/0101-shape-to-entity-rename.md)) — preferred direction, keeps one code path, but changes appearance of any diagram that has anchors.
2. **Where exactly is the Entity placed, and how big?** Centered on the drop point or top-left at it; default Entity size, or a smaller one. Likely centered so the arrow visibly lands on the box's nearest connection point.
3. **Is there any way left to get a Container from a drop?** Today's popup offered Entity or Container. Dropping the choice is the ask; check whether an "convert type" / right-click path already exists, or whether that is a small follow-up.
4. **Escape / cancel mid-drop** previously left the anchor; with no popup there is nothing to dismiss — confirm undo (one step) is the cancel path.
5. **Label focus:** should the new Entity enter label-edit mode immediately, as most diagram tools do?

## Decisions (ADR 0107)
1. **Breaking change, no migration** — a first version migrated anchors to Entities on load; removed as unneeded complexity since only the two gallery examples ever had one. Those were fixed by hand.
2. New Entity is centered on the drop point, default size and style.
3. No Container from this gesture; palette/toolbar still create containers. In-place "convert type" is a possible small follow-up.
4. Undo (one step) is the cancel path.
5. The new Entity opens in label-edit mode (transient `pendingLabelEditId` in `Canvas.tsx`, not stored in data).

## Notes
- Edge attaches to the new Entity's `left` point regardless of where the drag came from (as it did on the anchor). Picking the side facing the source is possible polish.
- Examples fixed by hand: `c4-container.chd` (interop-gateway → anchor → ext-rail-interop collapsed to the direct edge) and `meridian-rail-landscape.chd` (Shift Scheduling → anchor → Crew Rostering collapsed to one arrowed edge; the two-edge shape suggested that intent).
- `resources/ai/skills/chd-diagrams/references/field-reference.md` (and SKILL.md) still say `"shape"` rather than `"entity"` — drift left over from epic 0076, not touched here.
- Cross-platform: pure renderer logic; nothing OS-specific.
- Related backlog: [epic 0065](later/0065-bus-relay-node.md) (bus/relay node) is the other "a point edges attach to" idea — keep the two decisions consistent.
