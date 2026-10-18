# 0071: Diagram-level panels consolidate into one DiagramSettingsPanel

## Status
Accepted (2026-08-27)

> Terminology: this ADR was written while the per-diagram tier was still called "Configuration" and the panel "DiagramConfigPanel". [ADR 0052](0052-settings-ownership-tiers.md)'s 2026-08-27 addendum renamed the tier to "Diagram settings" and the panel to `DiagramSettingsPanel` — done in the same session. The text below uses the new names.

## Context

[ADR 0067](0067-max-connection-points-diagram-override.md) built `DiagramSettingsPanel` as the first home for a *pure* diagram-level value (`maxConnectionPointsPerSide`) that had no existing panel to live in. The user's instruction while scoping that: "New small panel is fine, but then we should also move the other things that makes sense to put there."

At that point three separate `UtilityDock` panels held diagram-level (per-diagram) state:
- `RequiredTagsPanel` — the `requiredTags` template
- `GravityPresetsPanel` — the `gravityPresets` catalog (+ its User-default tier, [ADR 0066](0066-gravity-presets-user-default.md))
- `DiagramSettingsPanel` — just `maxConnectionPointsPerSide`

Each was a fully self-contained component (own toolbar, title, close button) with its own boolean toggle state in `Canvas.tsx`, part of a ~10-member mutual-exclusion family where every toggle names every sibling. Three separate top-level View-menu entries for what is conceptually one thing ("this diagram's own settings") — and adding `DiagramSettingsPanel` made it three where there had been two.

## Decision

**`RequiredTagsPanel` and `GravityPresetsPanel` fold into `DiagramSettingsPanel` as collapsible sections.** The panel now has one toolbar (title + close) and a body of:
1. Max connection points per side — a single field, ungrouped, at the top (a collapsible header for one row is overkill)
2. **Required tags** — a `CollapsibleSection` wrapping the former panel's body
3. **Line bend presets** — a `CollapsibleSection`, `defaultOpen={false}`

**Layout: stacked `CollapsibleSection`s, not tabs.** It's the existing pattern (`panels/fields.tsx`, already used in the Property Panel and *inside* `RequiredTagsPanel` for per-tag allowed-values), gives free session-persisted open/closed state per section, and adds no new interaction. Tabs would be novel for this app and lose the "see required tags and bend presets at once" option.

**Each former panel's toolbar actions move into its section body**, as a small button row right under the section's hint text — "Copy to children" for Required tags; "Set as my default" / "Clear my default" / "Reset to defaults" for Line bend presets. Placing them next to the data they act on reads better than the old far-right-of-a-shared-toolbar position.

**Mechanically:** `RequiredTagsPanel` → `RequiredTagsSection`, `GravityPresetsPanel` → `GravityPresetsSection` — body-only components (no outer panel `<div>`, no toolbar, no `onClose`); the enclosing `CollapsibleSection` provides the title/expand chrome and `DiagramSettingsPanel` provides the shell and close button. `Canvas.tsx` loses `requiredTagsPanelOpen` and `gravityPresetsPanelOpen` (state, toggles, every mutual-exclusion line, the Escape-key branches, the effect deps) and the two View-menu items; the family shrinks from 10 to 8.

**View menu: 3 items → 1** ("Diagram settings"). No deep-links that open the panel with one section pre-expanded — the sections remember their own state, and it's a small panel.

**What does NOT fold in:**
- **`LegendPanel` / `HighlightsPanel`** — deliberately moved *out* of `UtilityDock` into floating popups anchored near the bottom-left `<Controls>` cluster, for quick access while actively working with highlights/legend. Re-consolidating them would reverse that decision without being asked to.
- **`DiagnosticsPanel`, `LayerPanel`, `AlignDistributePanel`** — Views/actions with no owned state ([ADR 0052](0052-settings-ownership-tiers.md)'s "not a tier").
- **`PreferencesPanel`, `StylePalettePanel`** — per-app (Preferences tier), not per-diagram. Folding them in would blur exactly the tier distinction the glossary established.

## Alternatives considered

- **Tabs instead of stacked sections** — rejected; new interaction pattern, and one-section-at-a-time hides the others.
- **Keep the three panels, just relabel** — doesn't address the real cost (three menu entries, three toggle states, three self-contained components for one concept).
- **Also fold in Highlights/Legend** — rejected; reverses a deliberate, documented UX decision. If the user wants it, it's a separate question to raise specifically.
- **Refactor the whole ~8-member mutual-exclusion boilerplate into one `openExclusivePanel(name)` helper** while here — deferred. It's a separate, larger change touching every panel with its own risk; this change already removes two members and leaves the pattern smaller. The repetition is deliberate and low-risk (each toggle names every sibling explicitly), noted in `Canvas.tsx`'s own comment.

## Consequences

- Files: `RequiredTagsPanel.tsx` → `RequiredTagsSection.tsx`, `GravityPresetsPanel.tsx` → `GravityPresetsSection.tsx` (body-only); `DiagramSettingsPanel.tsx` becomes the container, taking the union of the three panels' props. `Canvas.tsx` shrinks (two fewer panel states + all their wiring); one View-menu item instead of three.
- `main.css`: new `.diagram-settings-panel` / `.diagram-settings-section-actions` rules; the embedded `CollapsibleSection`s bleed to the panel edges so their dividers read full-width.
- No `.chd` / file-format impact — this is UI structure only; every stored field (`requiredTags`, `gravityPresets`, `maxConnectionPointsPerSide`) is untouched.
- **Naming.** Done in the same session — the per-diagram panel is "Diagram settings" (`DiagramSettingsPanel`), the per-app one "Preferences" (`PreferencesPanel`), glossary + code + UI in sync. See [ADR 0052](0052-settings-ownership-tiers.md)'s 2026-08-27 addendum for the full sweep.
