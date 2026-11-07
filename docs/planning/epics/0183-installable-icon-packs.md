# 0183: Installable icon packs

## Status
Not Started. Logged 2026-11-07; replaces the closed epics 0019 (vendor icon packs), 0098 (configurable asset folders) and 0104 (central custom-icon library). The main choices below are made; the design pass settles what is under "To settle", then an ADR, before code.

## Goal
Let a person install icon sets (AWS, Azure, a company's own) once per machine, pick from them in any diagram, and be told when a diagram needs a pack this machine lacks. The app ships no vendor icons: the person supplies the files, so redistribution terms are not the app's question. The built-in Tabler set becomes a pack of the same kind.

## Decided
- **Where:** a folder in the per-user data folder next to the saved preferences, one folder per pack: `icon-packs/<Pack>/<Subset>/<icon>.svg`. Not the install folder: that is read-only on a Windows machine-wide install and in a Linux AppImage, and an update replaces it.
- **Install:** a menu item; the person picks a folder, each subfolder becomes a subset in the picker, the SVGs are copied. Making the folders by hand works as well. Remove is a menu item too.
- **Metadata:** a file in the pack folder and one in each subset folder: a name (the folder name if absent), a description, and a text saying what to do when the pack is missing. If a pack has none, install writes a default listing the icon names. Per-icon meanings (user, person, human) are an optional addition to try; roll it back if it strains search, file size or the work of keeping it.
- **A pack is known by its name.** Two packs with the same name are the same pack; a renamed folder with a metadata name keeps working.
- **Used packs in the diagram:** when an icon from a pack is used, the pack's name and its "if missing" text are copied into a list in the `.chd`; the entry goes when no icon from that pack is left. Written from the icons actually in the diagram each time it is saved, so it cannot go stale.
- **Missing pack:** one diagnostics error naming the pack and showing that text. An app that does not know installed icons shows no icon, and the newer-file warning applies ([ADR 0118](../../decisions/0118-saved-with-version-marker.md)). An app that knows them but lacks the pack behaves as any other machine without it.
- **Picker:** collapsible sections per pack and subset, built for thousands of icons.
- **Not in scope:** the extension; the CLI beyond what is under "To settle".

## To settle
- **Reference form.** `{source: 'installed', pack, path}`; the path is untrusted and stays inside the pack ([ADR 0115](../../decisions/0115-paths-stored-in-diagrams-are-untrusted.md)). Additive: `docs/file-format.md`, the validator and the skill's field reference. An existing `{source: 'builtin', id}` must keep working ([ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md)): the skill teaches it and assistants write it, so it is best read as an alias for the Tabler pack, not migrated away.
- **Safe rendering.** Installed icons render as `<img>` from a data URL and never inline, so an SVG cannot run a script; that stays the safety boundary. Removing scripts, event attributes, `foreignObject`, external references and animation when installing is good hygiene on top. Removing everything that is not a shape is too much: Azure-style icons rely on gradients, clip paths and masks, and the Tabler set on strokes.
- **Colour.** An `<img>` cannot follow the theme, and Tabler's icons do today (inline, `currentColor`). Moving Tabler into a pack as it is would turn them dark on the dark theme. Option: the pack's metadata says `monochrome`, and the app draws such an icon as a mask in the text colour (still an `<img>`-safe image); multicolour packs keep their own colours.
- **The command-line export** draws built-in icons from a bundled folder (`env.iconDir`) and has no per-user folder to read. Either it keeps reading the bundled Tabler copy, or it finds the per-user folder per OS without Electron; an installed icon it cannot find is drawn as a neutral placeholder with a warning, not a failure.
- **Tabler as a pack: copy or read in place.** Installing 5,000 files on first start is slow on a machine with antivirus, and an app update would have to decide whether to overwrite a pack the person has edited. Reading the bundled pack from the app's resources as a second, read-only pack folder gives the same layout and metadata, no copy, and updates for free; the cost is that it cannot be edited or removed. Decide with the person's reason for "install on their behalf" in view: one treatment of every pack, and a worked example for pack authors, which both options give.
- **Tests and fixtures** that open diagrams with built-in icons need the pack present in the test environment.
- **Reinstalling** over an existing pack adds new icons and keeps an edited metadata file.
- **Size.** Read the list once, load icons as they scroll into view, search names (and meanings, if kept) before rendering anything.
- **Existing custom icons** stay in the diagram's `assets/` folder as now.

## Tasks
- [ ] Design pass and ADR: reference form, rendering and colour, used-packs list, bundled Tabler
- [ ] Pack folder, install and remove from the menu, default metadata file
- [ ] `IconRef` `installed`, schema, file-format doc, validator, skill field reference
- [ ] Picker: collapsible sections, search, scales to thousands
- [ ] Diagnostics error for a missing pack
- [ ] Tabler as a pack, `builtin` kept as an alias, the command-line export still drawing it
- [ ] Example diagram using a small pack made for the purpose ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md))

## Notes
The licensing problem that blocked vendor packs ([docs/licensing.md](../../licensing.md)) goes away because the app distributes nothing; the maintainer's outreach to the vendors is no longer on the path.
