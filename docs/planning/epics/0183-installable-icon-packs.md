# 0183: Installable icon packs

## Status
In progress. Logged 2026-11-07; replaces the closed epics 0019 (vendor icon packs), 0098 (configurable asset folders) and 0104 (central custom-icon library). Design settled 2026-11-17 in [ADR 0188](../../decisions/0188-icons-come-from-installed-packs-drawn-as-cleaned-inline-svg.md); the first version is the core below. Release 0.12.0.

## Goal
Let a person install icon sets (a cloud vendor's, a company's own) once per machine, pick from them in any diagram, and be told when a diagram needs a pack this machine lacks. The app ships no vendor icons: the person supplies the files, so redistribution terms are not the app's question. The built-in Tabler set becomes a pack of the same kind.

## Settled
Everything about where packs live, the reference form, drawing and cleaning icons, Tabler on first start, one-off icons, diagnostics and the picker is in the ADR. The maintainer chose inline SVG over image-plus-mask, Tabler installed through the manager, and a `My icons` pack over keeping `custom` for new icons.

## Still to settle while building
- **The Tabler archive:** one file in the installer, unpacked by the manager; the format (zip needs a reader, a tar does not) and where the command-line export reads its bundled copy.
- **Slow canvases:** measure a large diagram with many installed icons before adding the `<img>` fallback for fixed-colour icons.
- **The CLI and tests** that open diagrams with built-in icons need the Tabler pack or its bundled copy.

## Tasks
- [x] Design pass and ADR 0188
- [x] Icon cleaner (allowlist, per-icon prefix and per-use counter) with tests on hostile and on real vendor SVGs
- [x] Pack format: `pack.json`, `subset.json`, their reading, the default files and the icon path check (`src/shared/icons/pack.ts`); `docs/icon-packs.md`
- [x] Install manager window: install (writes the default metadata files), remove, update; staging, cancel, progress; trash with fallback (`src/main/icons/packStore.ts` and `packManager.ts`, own bridge `src/preload/iconPacks.ts`, View > Icon packs)
- [x] `IconRef` `installed`, optional used-packs list: schema, `docs/file-format.md`, validator (the skill's `validate_chd.mjs`), skill field reference; every place that switched on the icon source now names `installed` (nothing draws one yet)
- [x] Picker: collapsible sections per pack and subset, search, lazy previews (`InstalledIconSections` inside `IconBrowser`, so the icon picker, the legend entry picker and the search-by-icon popup all have it; the legend picker now uses `IconBrowser` instead of its own copy)
- [x] Icons follow the text colour in both themes; colours fixed by a pack are kept (installed icons are read through `iconPacks:readIcon`, cleaned and drawn inline by `IconSlotView`; the canvas, the legend panel and the compare window draw them)
- [ ] Exports draw installed icons: SVG (a nested svg keeps the icon's own viewBox, ids isolated per icon), draw.io, the legend of an image export; the search-by-icon preview
- [ ] Diagnostics error for a missing pack, with a button to open the manager; write `iconPacks` on each save from the icons present and the installed list
- [ ] Tabler as a pack: archive in the installer, first-start question, `builtin` as an alias, the command-line export still drawing it
- [ ] `My icons`: adding a one-off icon asks for a pack; existing `custom` icons keep working
- [ ] Example diagram using a small pack made for the purpose ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md))

## Later
Zip export of a pack, per-icon meanings in search, recolouring by the person, the extension and command line listing and writing installed icons, fetching packs from a central repository, a hash to tell two machines' `My icons` apart.

## Notes
The licensing problem that blocked vendor packs ([docs/licensing.md](../../licensing.md)) goes away because the app distributes nothing; the maintainer's outreach to the vendors is no longer on the path.
