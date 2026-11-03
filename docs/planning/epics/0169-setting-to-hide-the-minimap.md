# 0169: A setting to hide the minimap

## Status
Not Started. Logged 2026-11-04; for later.

## Goal
Let people who prefer a clear canvas switch the minimap off. It is always shown today (`<MiniMap />` in `Canvas.tsx`).

## Tasks
- [ ] Decide where the setting lives: an app preference or a View menu toggle that remembers its state
- [ ] Add the field to the preferences schema, merged over its default wherever preferences are received
- [ ] Hide the minimap when off; keep it on by default
- [ ] Mention it in the getting-started guide next to the other View options

## Notes
The minimap is a per-person display choice, not part of the diagram, so nothing is stored in the `.chd` file.
