# 0188: Icons come from installed packs, drawn as cleaned inline SVG

## Status
Accepted (2026-11-17). Trimmed 2026-11-26 to the decision; how a pack is laid out, installed and picked from is in [docs/icon-packs.md](../icon-packs.md). It adds the `installed` source that the first icon storage model left open, and keeps [0029](0029-backward-compatible-loading-is-a-standing-rule.md) and [0115](0115-paths-stored-in-diagrams-are-untrusted.md) as they are.

## Context
The app drew a bundled Tabler set inline and a diagram's own custom icons as `<img>`. People want the icon sets of their own world (a cloud vendor's, a company's) without the app shipping or licensing them, and a diagram that needs a set the machine lacks should say so. The icons are third-party files, so how they are drawn is a security question and a theming question at once.

## Decision
- **Icons come from packs the person installs, once per machine,** in a folder in the per-user data folder and not in the install folder, which is read-only on a machine-wide install and in an AppImage and is replaced by an update. The app ships no pack of its own besides Tabler, so it carries no one else's icons or licences. A pack is a folder of SVG files, known by its name.
- **A diagram refers to an icon by `{source: 'installed', pack, path}`,** with `path` resolved inside the pack's folder and kept there ([0115](0115-paths-stored-in-diagrams-are-untrusted.md)): exactly a subset and a file name, nothing that leaves it. `builtin` stays valid and means the Tabler pack's icon, and `custom` keeps opening as an `<img>`. The diagram may carry an optional list of the packs it uses, written by the app from the icons present at each save, so it cannot go stale; a file without it is valid.
- **Icons are drawn as inline SVG, cleaned every time they are read,** so each icon decides for itself how it is coloured: a shape-only icon draws in `currentColor` and takes the text colour in both themes, and one with colours its author fixed keeps them. Nothing has to say which is which. The cleaner is an allowlist from a vetted sanitiser library, run in the renderer: scripts, event attributes, `foreignObject`, external references (the app is offline, [0113](0113-enforced-offline-behaviour.md)), `@import` and animation are removed. A `<style>` element would restyle the page, so its rules are written into the style attribute of the elements they match, limited to properties that colour and draw. Cleaning happens at read time and not at install, because a hand-placed file never went through install. Ids are rewritten per use so inline icons in one document do not collide.
- **The sanitiser is the safety boundary** for installed icons, which [0112](0112-electron-hardening-sandbox-and-navigation.md) could so far leave to `<img>`.
- **Tabler is a pack like the others.** The manager writes the `@tabler/icons` outline set out as a pack; it is offered once on the first start, by a banner that can be left unanswered, and is available later from the manager. The built-in set is not a special case.
- **One manager installs, updates and removes packs, in a window of its own with a narrow bridge.** The editor windows can open it and list packs and cannot change one. The one exception is one-off icons: adding a single icon puts it in a pack named `Misc icons`, written by the main process and never replacing a file, so a person can keep one icon without making a pack. The cost is that a diagram no longer carries its icons: a colleague sees a missing-pack message that says what to do.
- **A missing pack is one Diagnostics error** naming the pack and showing its "if missing" text, with a button that opens the manager; a missing icon inside an installed pack is handled like any other missing file.
- **Not in the first version:** exporting a pack as a zip, meanings per icon in search, recolouring an icon, and listing or writing installed icons from the extension or the command line, which draws no installed icon.

## Alternatives considered
- **Draw installed icons as `<img>`, with a CSS mask for one-colour packs.** Isolated by construction, with no cleaner and no id rewriting. Rejected because an `<img>` takes no colour from the page, so the app would have to know how to draw each icon: a flag per pack or subset, or per icon in a folder that mixes shape-only and fixed-colour icons. Inline lets the icon say so itself. If it proves slow on very large diagrams, fixed-colour icons can move to an `<img>` from a data URL.
- **Keep Tabler bundled and show it as a read-only pack.** It keeps the built-in set a special case and the icons in two forms, while installing it through the manager teaches the way and lets a person remove what they do not use.
- **Keep `custom` as the way to add one-off icons.** It repeats each icon in every diagram's folder in the repository.
- **Identify an icon by a content hash as well as its name.** It would tell that two machines' `Misc icons` differ; left out until it is a real problem.

## Consequences
- The sanitiser becomes a dependency and the safety boundary; it is listed in the notices.
- A saved diagram gains an optional field and a new reference form; older apps read them as an unknown source and show no icon, and the newer-file warning applies ([0118](0118-saved-with-version-marker.md)).
- A pack's format is public, since people write it, and has its own page in `docs/`.
- A colleague opening a diagram needs the same packs; the Diagnostics message says how to get them.
