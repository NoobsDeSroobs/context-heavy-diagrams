# 0183: Installable icon packs

## Status
Not Started. Logged 2026-11-07; replaces the closed epics 0019 (vendor icon packs), 0098 (configurable asset folders) and 0104 (central custom-icon library). The main choices below are made; the design pass settles what is under "To settle", then an ADR, before code.

## Goal
Let a person install icon sets (AWS, Azure, a company's own) once per machine, pick from them in any diagram, and be told when a diagram needs a pack this machine lacks. The app ships no vendor icons: the person supplies the files, so redistribution terms are not the app's question. The built-in Tabler set becomes a pack of the same kind.

## Decided
- **Where:** a folder in the per-user data folder next to the saved preferences, one folder per pack: `icon-packs/<Pack>/<Subset>/<icon>.svg`. Not the install folder: it is read-only on a machine-wide Windows install and in a Linux AppImage, and an update replaces it. Packs are copied in whole.
- **One install manager** handles install, removal and export of packs, as its own step: a window over the canvas that blocks until the work is done or cancelled. The menu item opens it. Making the folders by hand still works, but the manager is the way, so a scattered set of folders is not what people end up with.
- **Install:** the person picks a folder; each subfolder becomes a subset in the picker. Files are written to a staging folder and moved into place only when everything is copied, so cancelling or failing leaves nothing half-installed.
- **Metadata:** a file in the pack folder and one in each subset folder: a name (the folder name if absent), a description, and a text saying what to do when the pack is missing. If a pack has none, install writes a default listing the icon names. Per-icon meanings (user, person, human) are an optional addition to try; roll it back if it strains search, file size or the work of keeping it.
- **A pack is known by its name.** Two packs with the same name are the same pack; a renamed folder with a metadata name keeps working.
- **Used packs in the diagram:** when an icon from a pack is used, the pack's name and its "if missing" text are copied into a list in the `.chd`; the entry goes when no icon from that pack is left. Written from the icons actually in the diagram each time it is saved, so it cannot go stale.
- **Missing pack:** one diagnostics error naming the pack and showing that text. An app that does not know installed icons shows no icon, and the newer-file warning applies ([ADR 0118](../../decisions/0118-saved-with-version-marker.md)). An app that knows them but lacks the pack behaves as any other machine without it.
- **Icons stay SVG until exported as pixels**, drawn in the page and not as images, so they follow the light and dark theme and can take a line and fill colour chosen by the person.
- **The built-in Tabler set is installed by the same code,** as a full copy, and is a pack like any other: the same folders, the same metadata, an example for people who make packs.
- **Picker:** collapsible sections per pack and subset, built for thousands of icons.
- **Not in scope:** the extension; the CLI beyond what is under "To settle".

## To settle
- **Reference form.** `{source: 'installed', pack, path}`; the path is untrusted and stays inside the pack ([ADR 0115](../../decisions/0115-paths-stored-in-diagrams-are-untrusted.md)). Additive: `docs/file-format.md`, the validator and the skill's field reference. An existing `{source: 'builtin', id}` must keep working ([ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md)): the skill teaches it and assistants write it, so it is best read as an alias for the Tabler pack, not migrated away.
- **The sanitiser is now the safety boundary.** An inline SVG can run a script, load a resource and restyle the page, which an image never could. So every icon is cleaned on every read, not once at install (a hand-placed file never went through install): an allowlist of elements and attributes, with scripts, event attributes, `foreignObject`, external references (the app is offline, [ADR 0113](../../decisions/0113-enforced-offline-behaviour.md)), `@import` and animation removed. A vetted library (DOMPurify's SVG profile) over our own parser; a new dependency, so `npm run notices`. Gradients, clip paths, masks and strokes stay: vendor icons need them.
- **Icons must not touch each other.** Inline SVGs share one document: two icons that both use `id="a"` for a gradient or the class `cls-1` (most exported packs do) paint each other. The cleaner gives every icon its own prefix on ids, classes and the references to them, or turns `<style>` rules into attributes. The same goes for an SVG export that embeds several icons.
- **Colour.** A monochrome icon (strokes and fills that are `currentColor` or one colour) follows the theme and takes the person's colours. A multicolour icon keeps its own: there is no honest way to recolour a dozen fills, and a "fill colour" for one would flatten it. The pack's metadata says which kind a pack holds; it can be per subset. Whether a colour is chosen per element, per slot or both.
- **Custom icons in the diagram's `assets/` folder** are drawn as images today. Whether an SVG there goes through the same cleaner and gets the same colours, or stays as it is.
- **Cost.** Thousands of inline SVGs in the picker would stall it, so it draws only what is in view; hundreds of icons on a canvas parse once each and are cached by icon and colour.
- **Installing the bundled set.** The installer can only do this on Windows: the per-user NSIS installer has the user's folder, but an AppImage has no install step, a `.deb` installs as root, and the code would be a second implementation next to the menu's. So: the installer ships the Tabler set as a payload; the first start of the app (and the first start after an update that brings a newer one) runs the same install code on it, in the same manager window with a progress bar. A pack the person removed is offered again by the manager, not put back silently, and an installed pack is not overwritten by an update without asking, since its metadata may have been edited. The payload is one archive, not 5,000 loose files, to keep the installer small and the unpacking fast.
- **Remove and export.** Removal moves the pack to the system trash where there is one, or to a hidden folder in the packs folder, so an accident can be undone. It says that diagrams using the pack will show a diagnostics error; the app cannot know which diagrams, as they are separate files. Export writes a pack as a zip a colleague installs through the same manager; a zip reader is a new dependency, or the manager takes folders only at first.
- **The command-line export** draws built-in icons from a bundled folder today and has no per-user folder to read. It keeps reading the bundled Tabler copy; an installed icon it cannot find is drawn as a neutral placeholder with a warning, not a failure.
- **Tests and fixtures** that open diagrams with built-in icons need the pack present in the test environment.
- **File names.** Two icons that differ only by case are one file on Windows and two on Linux; install reports a clash instead of overwriting.
- **Reinstalling** over an existing pack adds new icons and keeps an edited metadata file.

## Tasks
- [ ] Design pass and ADR: reference form, sanitiser and isolation, colour, used-packs list, installing the bundled set
- [ ] Icon cleaner (allowlist, per-icon prefix) with tests on hostile and on real vendor SVGs
- [ ] Install manager window: install, remove, export; staging, cancel, progress; default metadata file
- [ ] `IconRef` `installed`, schema, file-format doc, validator, skill field reference
- [ ] Picker: collapsible sections, search, scales to thousands
- [ ] Theme and person-chosen colours for monochrome icons
- [ ] Diagnostics error for a missing pack
- [ ] Tabler as a pack installed on first start, `builtin` kept as an alias, the command-line export still drawing it
- [ ] Example diagram using a small pack made for the purpose ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md))

## Notes
The licensing problem that blocked vendor packs ([docs/licensing.md](../../licensing.md)) goes away because the app distributes nothing; the maintainer's outreach to the vendors is no longer on the path.
