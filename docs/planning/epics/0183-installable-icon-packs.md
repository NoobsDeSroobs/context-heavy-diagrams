# 0183: Installable icon packs

## Status
Not Started. Logged 2026-11-07; replaces the closed epics 0019 (vendor icon packs), 0098 (configurable asset folders) and 0104 (central custom-icon library). Needs a design pass and an ADR before code.

## Goal
Let a person install icon sets (AWS, Azure, a company's own) once per machine, pick from them in any diagram, and be told when a diagram needs a pack this machine lacks. The app ships no vendor icons: the person supplies the files, so redistribution terms are not the app's question.

## The shape (the maintainer's proposal)
- **Where:** a folder beside the saved preferences, one folder per pack: `icon-packs/<Pack>/<Subset>/<icon>.svg`. A menu item installs a pack; making the folders by hand works as well.
- **Install:** the person picks a folder; each subfolder becomes a subset in the picker. The SVGs are copied in.
- **Metadata:** a file in the pack folder and one per subset. If none comes with the pack, install writes a default listing the icon names, a text to show when the pack is missing, and room for a description of the pack and of each subset. The app reads it to search and describe the icons.
- **Diagrams:** an icon refers to a pack, subset and file. A diagram that uses a pack the machine lacks gets a diagnostics error naming the pack.
- **Picker:** collapsible sections per pack and subset, built to hold thousands of icons.
- **Not in scope:** the CLI and the extension do not handle icons.

## Questions to settle first
- **Identity.** A pack is known by its folder name. Two people's "AWS" can hold different icons, and a rename breaks every diagram. A pack id in its metadata, with the folder name only a label, would survive renames.
- **Reference form.** An `IconRef` of `source: 'installed'` with pack and path ([ADR 0006](../../decisions/0006-icon-storage-model.md)); the path is untrusted and stays inside the pack ([ADR 0115](../../decisions/0115-paths-stored-in-diagrams-are-untrusted.md)). An additive file-format change: `docs/file-format.md`, and how an older app shows an icon source it does not know ([ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md)).
- **Missing.** A missing pack is one diagnostics error with the pack's name and its "where to get it" text; an icon missing from a present pack is a separate, lesser problem. The diagram itself could record the packs it uses (name, and where to get it) so a machine with no copy of the pack can still say what is needed.
- **Rendering.** Custom icons render as `<img>` from a data URL, never inlined, so a script in an SVG cannot run. Installed packs would too, which means no `currentColor`: a dark icon on a dark theme stays dark. Whether the picker offers a backing plate or a tint.
- **Exports and `chd export`.** The editor's exports embed what they draw. The command-line export has no pack folder to read: it should draw a neutral placeholder and say so, not fail.
- **Metadata cost.** Icon names and a short list of meanings per icon (user, person, human) help search and are never sent to an assistant, so the cost is the file's size and the work of writing it. Install should list names only and never invent meanings; a person or an assistant can add them. Whether one file per pack with subsets inside it is simpler than one per subset.
- **Reinstalling.** Installing over an existing pack should add new icons and keep a hand-edited metadata file, not overwrite it. Removing a pack is a menu item too.
- **Size.** A vendor pack has hundreds or thousands of SVGs; read the list once, load icons as they scroll into view, and search names and meanings before anything is rendered.
- **Existing custom icons** keep working as they do, in the diagram's own `assets/` folder. Whether the picker can offer to move one into a pack is a later question.

## Tasks
- [ ] Design pass and ADR: identity, reference form, missing-pack behaviour, rendering
- [ ] Pack folder, install and remove from the menu, default metadata file
- [ ] `IconRef` `installed`, schema, file-format doc, validator and older-app behaviour
- [ ] Picker: sections, search over names and meanings, scales to thousands
- [ ] Diagnostics error for a missing pack
- [ ] Example diagram using a small pack made for the purpose ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md))

## Notes
The licensing problem that blocked vendor packs ([docs/licensing.md](../../licensing.md)) goes away because the app distributes nothing; the maintainer's outreach to the vendors is no longer on the path.
