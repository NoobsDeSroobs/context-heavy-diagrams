# 0146: JSON Canvas export

## Status
Not Started. Logged 2026-10-21 from the [comparison with other tools](../../comparison.md). Sparse on purpose: to be reviewed and discussed before any decision to build it.

## Goal
Export a diagram to the open [JSON Canvas](https://jsoncanvas.org/) format so it can be opened in Obsidian and other apps that read it. Possibly import in the other direction later.

## Why
Obsidian Canvas is the closest tool in feel, and its format is open and small. An export is a cheap way to reach people who keep their notes in Obsidian, next to a diagram's own Markdown notes.

## Open questions (to check against the specification)
- **Mapping.** Entities to text cards, containers to groups, and each element's Markdown note to a file card pointing at the note, which fits well. JSON Canvas has far fewer styling options than this tool, so the export is lossy by nature; what is dropped has to be stated.
- **Edges.** Which sides and ends map; routing, bend points and marker kinds do not.
- **Linked diagrams.** Whether a link becomes a file card, or nested canvases.
- **Direction.** Export only at first.

## Related
[Epic 0144](0144-svg-and-command-line-export.md) (the first export to build; this is its small sibling), [epic 0052](later/0052-drawio-import-export.md).
