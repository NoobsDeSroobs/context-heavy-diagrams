# 0073: Max connection points per side — move to a diagram override, falling back to the user's Settings default

## Status
Done (2026-08-27), on `batch/2026-08-27-backlog-cleanup`, pending live test/merge. See [ADR 0067](../../decisions/0067-max-connection-points-diagram-override.md). `typecheck`/`lint` clean (0 errors project-wide).

## What shipped
New `DiagramFile.maxConnectionPointsPerSide?: number`, resolved as `diagramValue ?? settings.maxConnectionPointsPerSide` everywhere it's read (`DiagramContext`, `DiagramDock`'s prop to `PropertyPanel`). New `DiagramConfigPanel` — the first home for a pure diagram-level Configuration value, in `UtilityDock` alongside the existing panel family (mutually exclusive with all ~8 others, a "Diagram configuration" View-menu item). Lowering the override below what an element already has never clamps it — the limit only stops adding more points, matching this app's standing "never destroy data" convention. `docs/file-format.md` updated, no `.chd` version bump (additive field, ADR 0029).

Consolidating the existing `RequiredTagsPanel`/`GravityPresetsPanel` into this same panel — the user's own follow-up ask once "new small panel" was settled — split off into [epic 0096](0096-consolidate-diagram-configuration-panel.md): real UI-architecture work (splitting each panel's own chrome from its content, shrinking the 8-member mutual-exclusion family) bigger than this epic's actual feature.

## Goal
`maxConnectionPointsPerSide` (epic 0039) is currently Settings-only — one value, per person, applied everywhere. Per [ADR 0052](../../decisions/0052-settings-ownership-tiers.md), this is a real constraint on what a diagram can contain (how many connection points an element may carry), not just a display preference: two collaborators with different personal limits could produce a diagram one of them can't fully edit. Add a **Diagram override** (a new `DiagramFile` field) that, when present, is the actual limit for that diagram — falling back to the existing Settings value (now the **User default**) when the diagram doesn't specify one.

## Real open questions — resolved, see ADR 0067
- Field name/shape — `DiagramFile.maxConnectionPointsPerSide?: number`, optional, absent means use the Settings default.
- Where this gets edited — new `DiagramConfigPanel`, in `UtilityDock`.
- Over-limit handling — left alone until edited, never auto-clamped.
- `.chd` schema version — no bump, additive field; `docs/file-format.md` updated.

## Notes
Depends on [epic 0054](0054-os-conventional-settings-storage.md) landing first (or at least its `AppSettings` shape being stable) — the Settings half of this (the User default) shouldn't be redesigned mid-migration.
