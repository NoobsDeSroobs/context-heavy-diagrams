# 0157: Menus are grouped by a rule, and the glossary is in Help

## Status
Accepted (2026-11-08). Extends [ADR 0039](0039-top-menu-bar.md) (the menu bar), [ADR 0100](0100-command-palette-reuses-the-menu-bar.md) (the palette) and [ADR 0103](0103-ai-menu-and-feature-preference.md) (the AI menu).

## Context
The menus grew one entry at a time. File listed **New** and **New diagram metamodel…** apart, and **Export as PNG…** beside **Export as SVG…**; View ran twelve entries together; no menu marked which entries belong together. A person who met a term in the app, such as diagram metamodel or edge direction set, had nowhere to look it up.

## Decision
1. **A line goes where the kind of entry changes,** and a menu whose entries are all one kind has none. File: open and create, then save and export, then the open file (Reload, Close). Edit: undo, then the clipboard, then arrange. View: the palette, the panels, the display toggle, then settings. Help: reference, then About. The AI menu has one kind of entry (ways to get an assistant going) and no line.
2. **Entries that differ by one word are one entry with a submenu.** **New** has **Diagram** and **Diagram metamodel…**; **Export** has **PNG…** and **SVG…**. An export format is not a choice inside the dialog, because the dialog asks the same questions for every format and each format added later is one more entry. The shortcut stays on the leaf (Ctrl+N on **Diagram**).
3. **The palette lists the leaves of a submenu,** titled `Parent: leaf` (`New: Diagram`), so merging entries never removes anything from it. A submenu marked `notInPalette` is skipped: Recent Diagrams, whose entries are files.
4. **Help → Glossary…** is a window with a filter box, in the manner of Keyboard shortcuts. Its one source is `docs/architecture/glossary.md`, compiled into the app:
   - each `##` heading is a term;
   - the text under it up to its `### For developers` subheading is the plain definition and is all that ships; the code-level detail (type names, ADR links, where it is stored) stays under that heading, which is visible on GitHub and cannot be deleted unnoticed the way a comment can;
   - a test fails for a term with no plain definition, for a link or an ADR number in a plain definition, and for a missing entry among the terms the app shows (diagram metamodel, edge direction set, notes, layers and the three settings tiers);
   - the filter looks in names and in text, names first.

## Alternatives considered
- **Export as one entry with the format in the dialog.** One click fewer to start, but the dialog gets a format picker that changes nothing else, and every later format adds a choice there.
- **A glossary kept as data in the code,** or a second file for the app. Two sources drift; the existing file was already the better-written one.
- **Full-text search with an index.** The glossary is a few dozen short entries; a substring filter is enough and works offline without a dependency.
- **A hidden comment to mark the developer part.** Invisible on GitHub and easy to delete by accident.
- **Lines in every menu regardless of size.** A line in a three-entry menu marks nothing.

## Consequences
- **New** and **Export** take one more pointer move than before. Ctrl+N and the palette (`New: Diagram`, `Export: PNG…`) are unchanged for people who use the keyboard.
- Adding a term means writing its plain part first; the developer part is optional.
- The glossary window cannot show a link, so one term names another by name.
