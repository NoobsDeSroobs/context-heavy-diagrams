# 0072: Gravity presets — add a User default tier

## Status
Done (2026-08-27), on `batch/2026-08-27-backlog-cleanup`, pending live test/merge. See [ADR 0066](../../../decisions/0066-gravity-presets-user-default.md). `typecheck`/`lint` clean (0 errors project-wide).

## What shipped
New `AppSettings.gravityPresetsUserDefault?: GravityPreset[]`. `effectiveGravityPresets()` (`lineGravityPresets.ts`) now resolves Diagram override → User default → Built-in default, computed live every render rather than snapshotted at load — so changing your personal default applies immediately to any already-open diagram with no override of its own. `GravityPresetsPanel` gained two new, symmetric buttons: "Set as my default" (saves the currently-shown list to Settings) and "Clear my default" (removes it) — alongside the existing "Reset to defaults," which now falls back to your default (if set) rather than jumping straight to the built-in four.

## Goal
Gravity presets ([epic 0064](0064-simple-curved-freeform-line.md)/[ADR 0050](../../../decisions/0050-freeform-line-as-node-type.md)) already resolve **Diagram override** (`DiagramFile.gravityPresets`) → **Built-in default** (`DEFAULT_GRAVITY_PRESETS` in `lineGravityPresets.ts`), but there's no **User default** in between — no way to set your own preferred preset list that applies across every diagram that doesn't specify its own. Add that middle tier, per [ADR 0052](../../../decisions/0052-settings-ownership-tiers.md)'s fallback pattern.

## Real open questions — resolved, see ADR 0066
- Where this gets edited — a "Set as my default"/"Clear my default" pair directly on the existing `GravityPresetsPanel`, not a separate section.
- Resolution order — `effectiveGravityPresets()` now takes the Settings value as an explicit second argument.
- Retroactive application — yes, live, for any already-open diagram with no override of its own (a consequence of computing resolution every render rather than snapshotting it).

## Notes
Depends on [epic 0054](0054-os-conventional-settings-storage.md) landing first (or at least its `AppSettings` shape being stable) — no reason to add a new Settings field mid-migration.
