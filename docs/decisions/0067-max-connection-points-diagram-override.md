# 0067: Max connection points diagram override — UI placement and over-limit handling

## Status
Decided and implemented (2026-08-27).

## Context

This moves `maxConnectionPointsPerSide` from Settings-only to a per-diagram override falling back to the Settings value — the second concrete instance of [ADR 0052](0052-settings-ownership-tiers.md)'s three-tier pattern (after [ADR 0066](0066-gravity-presets-user-default.md)'s gravity presets). A real gap turned up: every prior diagram-level Configuration value (`requiredTags`, `highlights`, `legend`, `gravityPresets`) already had its own panel to live in; this is the first one with no natural home.

## Decision

**New `DiagramSettingsPanel`, in `UtilityDock` alongside the existing panel family** (Details/RequiredTags/Diagnostics/Settings/StylePalette/GravityPresets/AlignDistribute/LayerPanel — mutually exclusive, opening one closes the rest). Scoped to just `maxConnectionPointsPerSide` for now, not a consolidation of the other diagram-level panels into it — that consolidation is a separate follow-up, split out rather than attempted here.

**Over-limit handling: leave existing elements alone.** Lowering the diagram's max below what an element already has doesn't clamp or remove its extra points — the limit only stops *adding* more. Matches this app's standing "never silently destroy data" convention (ADR 0029), and avoids a worse failure mode: a diagram override is `AppPreferences`-adjacent data that different people opening the same file could each have set differently before this feature existed anywhere — auto-clamping on open would make opening the file itself a mutating, potentially destructive action.

**Resolution is a plain nullish-coalesce, not a three-tier function like gravity presets.** `diagramMaxConnectionPointsPerSide ?? settings.maxConnectionPointsPerSide` — `AppPreferences.maxConnectionPointsPerSide` is a required field with its own `DEFAULT_PREFERENCES` entry (`12`), so the "Built-in default" tier is already baked into Settings itself; there's no third, separate built-in-constant tier to splice in the way `DEFAULT_GRAVITY_PRESETS` was for gravity presets (which is genuinely a distinct third tier since `AppPreferences.gravityPresetsUserDefault` is optional with no built-in value of its own).

## Alternatives considered

- **A View-menu item opening a small prompt/dialog for just this one value** — rejected; doesn't scale if more pure diagram-level (per-diagram) values show up (likely, given this is explicitly the second instance of the three-tier pattern and a third — named style palettes — is already logged).
- **Folding `RequiredTagsPanel`/`GravityPresetsPanel` into the new panel immediately** — the user's own first instinct ("we should also move the other things that makes sense to put there"). Not attempted here: both existing panels are fully self-contained components with their own toolbar/title/close button, and removing that requires touching all ~8 mutually-exclusive toggle functions' close-lists plus each panel's own internal structure — a real UI-architecture refactor bigger than this feature, not a drive-by. Split into its own follow-up.
- **Clamping over-limit elements on open or on lowering the diagram max** — rejected per the Decision above.

## Consequences

- `DiagramFile.maxConnectionPointsPerSide?: number` — additive, no `.chd` version bump (ADR 0029), `docs/file-format.md` updated.
- `DiagramSettingsPanel` is deliberately built as a small, single-purpose panel today, but is meant to be the eventual host for other diagram-level values (the panel-consolidation follow-up, and whatever the named-style-palettes work produces) — worth keeping that in mind if its shape needs revisiting once more sections land.
