# 0072: Gravity presets — add a User default tier

## Status
Not Started — not yet scoped. Raised 2026-08-23 alongside [ADR 0052](../../decisions/0052-settings-ownership-tiers.md), while mid-implementation of epic 0054.

## Goal
Gravity presets ([epic 0064](0064-simple-curved-freeform-line.md)/[ADR 0050](../../decisions/0050-freeform-line-as-node-type.md)) already resolve **Diagram override** (`DiagramFile.gravityPresets`) → **Built-in default** (`DEFAULT_GRAVITY_PRESETS` in `lineGravityPresets.ts`), but there's no **User default** in between — no way to set your own preferred preset list that applies across every diagram that doesn't specify its own. Add that middle tier, per [ADR 0052](../../decisions/0052-settings-ownership-tiers.md)'s fallback pattern.

## Real open questions (deliberately not resolved here)
- Where this gets edited — likely a new `AppSettings` field (a `GravityPreset[]`) plus a UI entry point (a "Set as my default" action on the existing `GravityPresetsPanel`? A separate section there?), not designed.
- Resolution order in code: `effectiveGravityPresets()` (`lineGravityPresets.ts`) currently takes just the diagram's own list and falls back to the built-in four — needs a third input (the user's Settings default) spliced into the middle of that chain.
- Whether setting your own default retroactively affects diagrams you already have open, or only new ones going forward.

## Notes
Depends on [epic 0054](0054-os-conventional-settings-storage.md) landing first (or at least its `AppSettings` shape being stable) — no reason to add a new Settings field mid-migration.
