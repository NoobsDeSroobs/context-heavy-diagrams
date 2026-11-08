# 0184: Adjustable width for the diagnostics and changes panels

## Status
Built (2026-11-08), awaiting a look in the app. Logged 2026-11-07. ADR: [0158](../../decisions/0158-side-panel-width-and-the-minimap-are-preferences.md).

## Goal
The diagnostics panel and the changes (review) panel have a fixed width. Let a person drag their edge to make them narrower, so more of the canvas shows, or wider, to read long messages.

## Tasks
- [x] A drag handle on the panels' inner edge; the width is kept in the preferences and applied on the next start
- [x] A minimum and a maximum width, and a double-click that restores the default (and arrow keys)
- [x] The review (compare) window's list has the same handle through a shared hook; its width is kept for the life of the window, because that window cannot write preferences
- [x] Check the other side panels for the same need, and share the handle if they have it: all of them sit in one dock, so the handle is on the dock
- [ ] Look at it in the app, in both themes, with the window narrow
