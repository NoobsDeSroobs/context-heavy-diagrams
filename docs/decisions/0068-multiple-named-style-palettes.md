# 0068: Multiple named style palettes

## Status
Decided and implemented (2026-08-27).

## Context

The last of the settings-tier trio from [ADR 0052](0052-settings-ownership-tiers.md). The style palette ([ADR 0048](0048-style-palette-and-defaults.md)) stays Settings-only — no diagram tier — but ADR 0048's "one active palette, not several merged ones; importing replaces it outright" turned out to be too tight: someone maintaining a "Company" set, a "GDPR" set and a "Client" set has to re-import a file every time they switch. The user wants several kept around at once with a quick active-palette switch.

The four questions ADR 0048 and the epic deliberately left open, resolved with the user before building:

## Decision

**1. Scope stays colors + fonts only.** A named palette is `{ id, name, colors, fonts }` — nothing else. `canvasBackgroundColor` and the per-type `defaultStyles` remain single global `AppSettings` values, *not* per-palette. The user's framing: this feature exists to "make creating diagrams with the correct colours easier," not to be a swappable theme system applied to a diagram. No concrete need for palette-scoped backgrounds/defaults was raised, and bundling them in would have reshaped three `AppSettings` fields instead of one. Revisitable if a real "diagram themes" use case shows up later.

**2. Data shape: `stylePalettes: NamedStylePalette[]` + `activeStylePaletteId: string | null`**, replacing `stylePalette: { colors, fonts }`. The `id` (not the name) is the active pointer's handle, so renaming a palette never loses its active status. `DEFAULT_SETTINGS` seeds one empty palette named "Default" (fixed id `palette-default`) so a fresh install's panel is immediately usable. Resolution is live, via `effectiveStylePalette(palettes, activeId)` — active palette → first palette (if the id is dangling) → empty set. Same live-not-snapshotted approach as `effectiveGravityPresets` ([ADR 0066](0066-gravity-presets-user-default.md)), and it takes the two fields rather than the whole `AppSettings` object for the same reason — a `useMemo` over it then lists exactly what it depends on.

**3. Import adds a new named palette**, rather than replacing the active one. Name seeded from the imported file's name (new: `stylePalette:importFromFile` now returns `{ name, content }`), editable inline afterwards. This is the whole point of the feature. The export **file format is unchanged** — still the bare `{ colors, fonts }` with no id/name — so palettes exported by any version stay interchangeable, and the "sharing = hand someone a file" model from ADR 0048 is untouched. Export writes the *active* palette.

**4. The active-palette selector lives at the top of `StylePalettePanel`** — a `<select>` above the Colors/Fonts sections, with an inline rename field and New / Duplicate / Delete buttons next to it. Not the top menu bar (the user's pick, and `MenuBar` has no submenu support anyway). It's a dock panel you have to open to switch, which is acceptable for now; promoting it to the always-visible toolbar is a cheap follow-up if it proves too buried.

**5. Both "New" (empty) and "Duplicate" (copies the active palette's colors/fonts).** Symmetric, matches the project's standing preference against one-way designs. Delete is disabled at one palette (a minimum-one constraint avoids an empty-state the editors can't act on); deleting a non-empty palette asks for in-panel confirmation first (never `window.confirm()` — the [known bug](../known-issues.md) where a native dialog left a sibling `<select>` unresponsive).

**6. Migration lives in one shared `normalizeAppSettings()`** called at every point a settings blob is received (main's file read, the renderer's file read, the cross-window broadcast, the legacy-`localStorage` migration) — replacing the four inline `{ ...DEFAULT_SETTINGS, ...parsed }` spreads. An older blob has `stylePalette: { colors, fonts }` and no `stylePalettes`; it's folded into one "Default" palette. Idempotent (an already-migrated blob has `stylePalettes` set, so the branch is skipped), so running it at four boundaries is safe. This also formalizes the standing "every `AppSettings` field must re-merge over defaults at every boundary" rule ([the `isolateOpacity` empty-input bug](../known-issues.md)) into a single named function.

## Alternatives considered

- **Keep replace-on-import, just allow several palettes** — rejected; switching would still mean re-importing, defeating the purpose.
- **Palette-scoped canvas background + default styles** — rejected for now; see Decision 1. Not requested, and triples the `AppSettings` reshape.
- **Active-palette selector in the toolbar** — deferred, not rejected; the panel dropdown is enough for v1 and doesn't spend permanent toolbar space on a feature not everyone uses.
- **`effectiveStylePalette(settings: AppSettings)`** — rejected in favour of the two-arg form so the `useMemo` deps are honest (ESLint flagged the whole-object version).

## Consequences

- `src/shared/settings.ts`: `NamedStylePalette` type; `AppSettings.stylePalette` → `stylePalettes` + `activeStylePaletteId`; new `normalizeAppSettings()` and `effectiveStylePalette()`; `LegacyStylePalette` kept only for the migration's input type.
- `src/main/appSettings.ts` and `src/renderer/src/settings.ts`: all four merge sites now call `normalizeAppSettings()`.
- `src/main/stylePalette.ts` + preload: `importStylePalette()` returns `{ name, content }` instead of `string`.
- `StylePalettePanel.tsx`: palette picker (select + rename + New/Duplicate/Delete), import-adds-new, export-active, delete-confirm; Colors/Fonts editors operate on the active palette.
- `Canvas.tsx`: `activeStylePalette` memo feeds `DiagramContext`'s `paletteColors`/`paletteFonts`; panel wired to `updateSettings({ stylePalettes, activeStylePaletteId })`.
- No `.chd` schema change — the palette has never lived in the diagram file, and the palette *export* file format is unchanged.
- The panel-consolidation follow-up (folding `RequiredTagsPanel`/`GravityPresetsPanel` into `DiagramConfigPanel`) is unaffected — `StylePalettePanel` is Settings, not diagram Configuration, and isn't part of that consolidation.
