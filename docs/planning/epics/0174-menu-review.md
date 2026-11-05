# 0174: A review of the menus, and a glossary in Help

## Status
Not Started. Logged 2026-11-05; for later.

## Goal
The menus have grown one entry at a time. Related entries sit apart, the groups are not marked, and a person who meets a term in the app has nowhere to look it up. Go through every menu once, group what belongs together, and add a searchable glossary.

## Ideas so far
- **New** becomes a submenu: **Diagram** and **Diagram metamodel** (today **New** and **New diagram metamodel…** are separate entries in File).
- **Export** is one entry, with the format as a submenu or as a choice in the export dialog, instead of **Export as PNG…** and **Export as SVG…** side by side. Which of the two is better depends on whether the dialog has other options to show.
- **A line between groups** in every menu, so related entries are marked off from the others. The menu bar already supports submenus and a separator before an entry (`separatorBefore`); what is missing is using them consistently.
- **Help → Glossary,** where the terms the app uses (diagram metamodel, edge direction set, notes, layers, the three settings tiers) are explained and can be searched.
- **Anything else that can be combined,** found by walking File, Edit, View and Help (and the AI entries) one at a time.

## Questions to settle first
- Export: submenu or dialog option.
- The glossary has one source, `docs/architecture/glossary.md`, which the build reads and ships in the app (a `?raw` import or a copy step, whichever suits the electron-vite setup). The open part is the content: it is written for people working on the code, with type names, ADR links and relative links that mean nothing in the app. Likely shape: each term is a section; the text before its `For developers` heading is the plain definition and is all the build ships, and the developer detail (type names, ADR links, where it is stored) stays under the heading. A visible heading, not a hidden comment, so it shows on GitHub and is not deleted unnoticed. A test fails when a term has no plain part, or when the shipped text holds a relative link. Terms the app shows but the file lacks (diagram metamodel is added; edge direction set, notes, layers) get an entry.
- Search in the glossary: a filter box over the terms, or a full-text search; offline either way.
- Keyboard shortcuts and the command palette follow the menu: an entry that moves or merges keeps its shortcut.

## Tasks
- [ ] Walk every menu and write down the grouping and the merges
- [ ] Decide export (submenu or dialog) and glossary (source, search)
- [ ] An ADR for the menu structure, with the rule for when a group gets its own line
- [ ] Apply the grouping, the **New** submenu and the **Export** change, with separators
- [ ] Help → Glossary, with search
- [ ] Update `docs/getting-started.md` and the screenshots in the README if a menu they show changed

## Notes
Raised while naming the diagram metamodel: a user who meets that word needs somewhere to look it up.
