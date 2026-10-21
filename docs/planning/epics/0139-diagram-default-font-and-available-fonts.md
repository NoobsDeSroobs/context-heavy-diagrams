# 0139: A diagram-wide default font, and which fonts are available

## Status
Not Started — logged 2026-10-17 from a design conversation. Nothing here is decided; the sketch and questions are starting points.

## Goal
Let an author choose a font **once per diagram** instead of per element, and make choosing a font easy by offering a sensible set: fonts that ship with the app, and (optionally) the fonts installed on the computer.

## What exists today (checked 2026-10-17)
- **Per element:** every entity, container, text node and edge label has its own font, set under Font → Name in the property panel (stored as `fontFamily`, a raw CSS font-family string).
- **A palette of quick-picks:** View → Style Palette keeps a named list of fonts. The active palette's fonts appear in each element's font dropdown. The palette is an app-level preference, **not** saved in the diagram.
- **No diagram-wide default.** An element with no font of its own uses the app's built-in stack (`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …`).
- **The app bundles no fonts.** Inter is named first but not included, so each computer draws whatever it has (Segoe UI on Windows, something else on Linux). The same diagram therefore already looks different on different machines, and so do PNG exports.
- **The browser can list installed fonts.** `window.queryLocalFonts()` exists in this Electron and returned 494 font faces on the author's Windows machine, with no prompt. Not tried on Linux or macOS.
- **Stored fonts a palette lacks** are now shown in the dropdown under "In use, not in your palette" (done 2026-10-17), so the field always shows what is stored.

## Design questions
1. **Scope of the default.** One font for everything in the diagram, or one per kind (entities and containers, text, edge labels)? One is simpler and covers the common wish; the existing per-type "Set as default style" already handles new elements.
2. **Where it is stored.** A diagram setting in the `.chd` (a new optional top-level field), falling back to a personal default in Preferences, then to the built-in one — the same three-step pattern as the gravity presets ([ADR 0052](../../decisions/0052-settings-ownership-tiers.md)). It changes the file format, so `docs/file-format.md` must be updated, and it should follow the file version warning in the open-source release work so older apps meet it safely.
3. **What it applies to.** Labels of entities, containers, text nodes and edges, the legend, and PNG export. Probably not the app's own interface, and undecided for the Markdown notes.
4. **How the panel shows it.** The built-in look is data ([ADR 0117](../../decisions/0117-built-in-style-defaults-are-data.md)), so the diagram default becomes one more layer in the chain element → diagram → personal → built-in, and an unset element shows the font it actually inherits.
5. **Which fonts to offer** (see below).
6. **Font stacks vs names.** A font stored by name only works where it is installed. Storing a stack with fallbacks (`Georgia, 'Times New Roman', serif`) degrades gracefully; the palette already accepts stacks. Should picking from a list write a stack automatically, and with which generic fallback?
7. **Telling the author when it will differ elsewhere.** A Diagnostics warning when a diagram uses a font that is not available on this computer.

## Where the fonts could come from
| Source | For | Against |
|---|---|---|
| **Ship a curated set** (open-licensed fonts such as Inter, Roboto, Open Sans, Source Sans, IBM Plex, a few serif and monospace faces) | Identical on every OS, so diagrams and PNG exports look the same everywhere; no dependency on what is installed | Adds megabytes to the installer; each font's license and notice must be shipped (SIL Open Font License fonts are fine to bundle with GPL software, to be confirmed per font); proprietary fonts people expect (Segoe UI, Arial, Calibri, Helvetica) cannot be bundled |
| **List the installed fonts** through `queryLocalFonts` | No dependency, works offline, covers whatever the author actually uses | A diagram using one may look different on another machine; a long list needs search and grouping by family; behaviour on Linux and macOS is untested |
| **The style palette** (today) | Already works; the author curates it | Per user, not per diagram; starts empty |
| **The four generic families** (today) | Always resolve to something | They are categories, not fonts |

**Leaning (not decided):** do both. Ship a small curated set as the dependable group that the app can guarantee, and offer an "Installed on this computer" group, clearly marked as possibly missing elsewhere. This also settles the portability problem the bundled set solves for the app's own default look.

## Tasks
- [ ] Decide the questions above, in particular scope and where the default is stored
- [ ] ADR for the chosen design; update `docs/file-format.md` and the AI instructions if a field is added
- [ ] Add the diagram-wide default font, shown in the Diagram settings panel, with the three-step fallback
- [ ] Extend the effective-style chain (ADR 0117) with the diagram layer and show it in the property panel
- [ ] Choose and ship the curated fonts (license check per font, notices file, size budget, subset to the scripts the app needs)
- [ ] "Installed on this computer" group via `queryLocalFonts`, loaded lazily, searchable, grouped by family; verify on Linux and macOS
- [ ] Decide stack vs name when picking from a list
- [ ] Optional: Diagnostics warning for a font that is unavailable here

## Related
[ADR 0117](../../decisions/0117-built-in-style-defaults-are-data.md) (defaults as data), [ADR 0052](../../decisions/0052-settings-ownership-tiers.md) (tiers and the fallback pattern), [ADR 0034](../../decisions/0034-theme-adaptive-color-value-flip.md), and the open-source release epic's items on third-party notices and the file version warning ([epic 0137](../completed-epics.md#0137-open-source-release)).
