# 0030: Custom style palettes & default element styles

## Status
Done (2026-08-22)

## Goal
Two related, naturally-sequenced features on top of epic 0003's property panel and pickers:

1. **User/organization-owned style palettes** — a saved set of colors and fonts (not just the single-color-at-a-time fields that exist today), surfaced as a distinct group inside the existing color fields (Fill/Border/Font color, in both the property panel and the Fill…/Border… context-menu popups) and the Font Family dropdown. The stated motivation: "company palettes" — a team's brand colors and approved fonts, reusable across diagrams.
2. **Default styles for newly-created elements** — shapes/containers/text/edges currently spawn with no `style` at all (today's fully-hardcoded look, per ADR 0014). This asks for a configurable default `NodeStyle`/`EdgeStyle` applied at creation time instead.

## Decisions made
Full reasoning in [ADR 0048](../../../decisions/0048-style-palette-and-defaults.md), resolving every open question the epic originally left unresolved:
- **One active palette**, not several merged ones — importing a file replaces it outright, confirmed in-panel first (not `window.confirm()` — see epic 0055's known-issue).
- **Storage**: `AppSettings.stylePalette`/`AppSettings.defaultStyles` in `localStorage`, consistent with every other global setting today; not jumping ahead of epic 0054.
- **Editing**: a new dock panel (`StylePalettePanel.tsx`), reusing epic 0055's `AllowedValuesEditor` list-editor shape directly (buttonless add, remove button) rather than a new pattern.
- **Scope**: colors and fonts only — line-style/marker presets stay ADR 0010's separate built-in-only catalog, as that ADR itself anticipated needing to decide.
- **Surface area**: `ColorField` itself gains an optional palette-swatches row, automatically covering both the property panel and the Fill…/Border… popups since they already share that component; Font Family dropdown gets palette fonts appended.
- **Defaults**: one style per element type, no named presets/themes. No second style-editing UI — style an element via the existing property panel, then a new "Set as default style" button copies its current style into the setting. Edge already covered by epic 0061's `defaultEdgeStyle`, not duplicated. Explicit action only, never "last used becomes default."
- **Naming**: "Style Palette."

## Tasks
- [x] `settings.ts`: `PaletteColor` type, `stylePalette`/`defaultStyles` fields.
- [x] `src/main/stylePalette.ts` — export/import IPC via real native save/open dialogs (not a browser-download hack).
- [x] `ColorField` (`panels/fields.tsx`) — optional `paletteColors` prop, quick-pick swatch row.
- [x] `DiagramContext` — `paletteColors`/`paletteFonts`, read by `PropertyPanel.tsx` and `ColorPickerPopup.tsx`.
- [x] `PropertyPanel.tsx`/`DiagramDock.tsx` — "Set as default style" button (single shape/container/text selection only).
- [x] `Canvas.tsx` — new elements seed `data.style` from the matching default; Container keeps its existing hardcoded fallback until a real default is set.
- [x] `StylePalettePanel.tsx` (new) — colors/fonts list editors, Import/Export, per-type defaults summary with Clear buttons; joins the existing 5-way mutually-exclusive dock panel family.
- [x] `npm run typecheck` clean; `npm run lint` shows the same 4 pre-existing errors (epic 0028), zero new ones.

## Notes
**Same day, after initial build**: the user asked whether "background colour" was missing — confirmed a real gap (canvas background was entirely React Flow's own light/dark theme default, no app-level override anywhere) and added `canvasBackgroundColor` as a small extension: a global, optional color (falls back to today's theme default when unset), edited via a new "Canvas background" section in `StylePalettePanel` reusing `ColorField`. See [ADR 0048](../../../decisions/0048-style-palette-and-defaults.md)'s addendum.

**Live-tested immediately, real bug found and fixed**: the user tried changing the color and nothing happened. First implementation set plain `style={{backgroundColor}}` on `<ReactFlow>`, which lands on the right element but is invisible — React Flow's actual paint comes from `<Background>`'s own SVG reading the CSS custom property `--xy-background-color`, not a literal style property. Fixed to set that custom property directly. Full writeup in [docs/known-issues.md](../../../known-issues.md).

Not independently verified in the running app — same Electron-only-`window.api` limitation as recent epics. Worth a look: add a few palette colors/fonts, confirm they show up as swatches in the property panel *and* the right-click Fill…/Border… popups; style a shape and use "Set as default style," then add a new shape and confirm it starts with that look; export the palette to a file and re-import it (into an empty palette, and into a non-empty one to see the in-panel replace confirmation).
