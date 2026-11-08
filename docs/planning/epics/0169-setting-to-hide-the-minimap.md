# 0169: A setting to hide the minimap

## Status
Built (2026-11-08), awaiting a look in the app. Logged 2026-11-04. ADR: [0158](../../decisions/0158-side-panel-width-and-the-minimap-are-preferences.md).

## Goal
Let people who prefer a clear canvas switch the minimap off. It is always shown today (`<MiniMap />` in `Canvas.tsx`).

## Tasks
- [x] Decide where the setting lives: a preference, reached by a corner button and View → Minimap
- [x] Add the field to the preferences schema, merged over its default wherever preferences are received
- [x] Hide the minimap when off; keep it on by default
- [x] Mention it in the getting-started guide next to the other View options

## Notes
The minimap is a per-person display choice, not part of the diagram, so nothing is stored in the `.chd` file.
