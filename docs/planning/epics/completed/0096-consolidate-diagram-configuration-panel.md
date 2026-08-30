# 0096: Consolidate diagram-level Configuration panels into DiagramConfigPanel

## Status
Done (2026-08-27), on `epic/0096-consolidate-diagram-configuration-panel`, pending live test/merge. See [ADR 0071](../../../decisions/0071-consolidate-diagram-configuration-panel.md).

## What shipped
- `RequiredTagsPanel` → `RequiredTagsSection`, `GravityPresetsPanel` → `GravityPresetsSection` — body-only, chrome stripped. Both now render as stacked `CollapsibleSection`s inside `DiagramConfigPanel`, below the max-connection-points field.
- Each former panel's toolbar actions (Copy to children / Set-my-default / Clear-my-default / Reset) moved to a button row at the top of their section body.
- `Canvas.tsx`: dropped `requiredTagsPanelOpen` + `gravityPresetsPanelOpen` (state, toggles, ~16 mutual-exclusion lines, 2 Escape branches, 2 effect deps); mutual-exclusion family 10 → 8. View menu: 3 items → 1 ("Diagram configuration").
- Exclusions held as proposed: Highlights/Legend (floating popups by design), Diagnostics/Layers/AlignDistribute (no owned config), Settings/StylePalette (per-app).
- Naming: the panels were renamed in the same session (the user pushed for it rather than deferring) — "Diagram settings" (`DiagramSettingsPanel`) and "Preferences" (`PreferencesPanel`), glossary + code + UI in sync. See [epic 0100](0100-rename-configuration-to-diagram-settings-and-settings-to-preferences.md) / [ADR 0052](../../../decisions/0052-settings-ownership-tiers.md)'s 2026-08-27 addendum.
- `typecheck` + `lint` clean (0 errors). Not live-tested (Electron-only renderer, per the standing note).

## Original proposed scope (kept for reference)

## Goal
[Epic 0073](0073-max-connection-points-diagram-override.md) built a new `DiagramConfigPanel` (`src/renderer/src/components/DiagramConfigPanel.tsx`) as the first home for a *pure* diagram-level Configuration value with no existing panel to live in. While scoping where that panel should live, the user's own instruction was: "New small panel is fine, but then we should also move the other things that makes sense to put there." This epic is that consolidation — folding the existing standalone panels that hold diagram-level Configuration data into `DiagramConfigPanel` as sections, rather than leaving them as separate top-level toggles.

## Proposed scope
Reasoned out (not yet confirmed with the user) from which existing panels are genuinely diagram-level Configuration data with no other reason to stay separate:

- **`RequiredTagsPanel`** — good fit. Plain `UtilityDock` panel, no other UX reason to stay standalone.
- **`GravityPresetsPanel`** — good fit, same reasoning. Already gained a User-default tier in epic 0072/ADR 0066; that UI (Set/Clear my default) needs to survive the move.
- **`LegendPanel` and `HighlightsPanel` — proposed EXCLUSION, not inclusion.** Both were deliberately moved *out* of `UtilityDock` into floating popups anchored near the bottom-left `<Controls>` cluster (see `fix/highlights-free-tags-and-toggle`'s own history, referenced in both panels' current file comments) — an explicit, documented UX decision for quick access while actively working with highlights/legend, not an oversight. Re-consolidating them into this panel would reverse that decision without being asked to reconsider it specifically. If the user actually wants them included too, that's a real question to ask before touching either.
- **`DiagnosticsPanel`, `LayerPanel`, `AlignDistributePanel`, `SettingsPanel`, `StylePalettePanel`** — proposed exclusion. Diagnostics is computed/session state, not stored Configuration; Layer/AlignDistribute are action/view surfaces with no owned data; Settings and StylePalette are per-app (Settings-tier per [ADR 0052](../../../decisions/0052-settings-ownership-tiers.md)/the glossary), not per-diagram — moving them in would blur exactly the distinction that glossary work just established.

## What's actually involved
Each of `RequiredTagsPanel`/`GravityPresetsPanel` is a fully self-contained component today (own toolbar, title, close button) rendered directly in `UtilityDock`, toggled by its own boolean state in `Canvas.tsx` that's part of an ~8-member mutual-exclusion family (Details/RequiredTags/Diagnostics/Settings/StylePalette/GravityPresets/AlignDistribute/LayerPanel/DiagramConfig, every toggle function closes all the others). Folding two of them in means:
- Splitting each panel's outer chrome (title/close button) from its body content, or adding an `embedded` mode that suppresses the chrome when rendered inside `DiagramConfigPanel`'s own sections.
- Removing their standalone toggle state/functions from the mutual-exclusion family (shrinking it back down), and removing their own `View` menu items (folded into "Diagram configuration" instead, or kept as deep-links that open the panel with that section expanded — not decided).
- Deciding the internal layout: stacked `CollapsibleSection`s (existing pattern, `panels/fields.tsx`) vs. tabs vs. something else, once there are 3+ sections in one panel.
- Preserving every existing action each panel currently exposes in its own toolbar (RequiredTags' "Copy to children," GravityPresets' "Set as my default"/"Clear my default"/"Reset to defaults") — these need a new home once the per-panel toolbar goes away.

## Notes
Split off epic 0073 on 2026-08-27 rather than attempted as part of that epic — it's a real UI-architecture refactor touching a lot of interlinked toggle state across `Canvas.tsx`, bigger than the feature (`maxConnectionPointsPerSide`) that motivated building `DiagramConfigPanel` in the first place. See [ADR 0067](../../../decisions/0067-max-connection-points-diagram-override.md) for the reasoning.
