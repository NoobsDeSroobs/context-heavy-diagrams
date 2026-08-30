# 0074: Multiple named style palettes, with an active-palette selector

## Status
Done (2026-08-27) — on `batch/2026-08-27-backlog-cleanup-2`, pending live test/merge. Full reasoning in [ADR 0068](../../../decisions/0068-multiple-named-style-palettes.md).

## Goal
The style palette (epic 0030/ADR 0048) stays Settings-only per [ADR 0052](../../../decisions/0052-settings-ownership-tiers.md) — no diagram-local copy, since a shape's actual color is already captured at the Properties level. What's missing: today there's exactly one active palette, and importing a file *replaces* it outright (`settings.ts`'s own comment: "One active palette, not several merged ones"). The user wants to keep several named palettes around at once — e.g. "Company," "GDPR," "Client" — and switch which one is active via a dropdown, rather than overwrite-on-import. Sharing a palette with someone else already works today (`stylePalette:exportToFile`/`importFromFile`) and doesn't need to change — this epic is purely about managing several of them locally.

## Decisions made
Settled with the user before building — see [ADR 0068](../../../decisions/0068-multiple-named-style-palettes.md):
- **Scope: colors + fonts only.** `canvasBackgroundColor` / per-type `defaultStyles` stay single global values, not per-palette. This is about "get the colours right while authoring," not swappable diagram themes.
- **Data shape:** `AppSettings.stylePalettes: NamedStylePalette[]` (`{ id, name, colors, fonts }`) + `activeStylePaletteId: string | null`, replacing the singular `stylePalette`. Resolved live via `effectiveStylePalette()`.
- **Import adds a new named palette** (name from the file name, editable after), never overwrites. Export file format unchanged (bare `{ colors, fonts }`).
- **Active-palette selector at the top of `StylePalettePanel`** — a `<select>` + inline rename + New / Duplicate / Delete. Not the menu bar (no submenu support).
- **Both "New" (empty) and "Duplicate" (copies active).** Delete disabled at one palette; deleting a non-empty palette confirms in-panel first.
- **Migration** via a new shared `normalizeAppSettings()` run at every settings-receive boundary — folds a pre-0074 `stylePalette` into one "Default" palette, idempotently.

## Tasks
- [x] `src/shared/settings.ts`: `NamedStylePalette` type; reshape `AppSettings`; `normalizeAppSettings()`; `effectiveStylePalette()`.
- [x] `src/main/appSettings.ts` + `src/renderer/src/settings.ts`: all four merge sites use `normalizeAppSettings()`.
- [x] `src/main/stylePalette.ts` + preload (`.ts`/`.d.ts`): `importStylePalette()` returns `{ name, content }`.
- [x] `StylePalettePanel.tsx`: palette picker UI; import-adds-new; export-active; delete-confirm; editors bound to the active palette.
- [x] `Canvas.tsx`: `activeStylePalette` memo → `DiagramContext` `paletteColors`/`paletteFonts`; panel wired to `updateSettings`.
- [x] `assets/main.css`: `.style-palette-picker` styles.
- [x] `npm run typecheck` clean; `npm run lint` 0 errors (no new non-CRLF warnings).

## Notes
Depended on [epic 0054](0054-os-conventional-settings-storage.md)'s `AppSettings` shape being stable — it is (0054 merged). Followed the same live-resolution shape as [ADR 0066](../../../decisions/0066-gravity-presets-user-default.md) (epic 0072).

**Not independently verified in the running app** — same Electron-only-`window.api` limitation. Worth a look: add colors/fonts to the Default palette and confirm they appear as swatches in the property panel + Fill…/Border… popups; create a 2nd palette, switch active, confirm the swatches change everywhere live; duplicate it; delete one (with and without content — the latter should prompt); export a palette and re-import it (should appear as a new entry named after the file). Upgrade path: an existing `settings.json` with a populated `stylePalette` should come back as a "Default" palette with those same colors/fonts, active.
