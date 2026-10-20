# 0140: Pick a legend line from an edge

## Status
In Progress — built and passing typecheck, lint and tests (2026-10-20); the live check in the app is open.

## Goal
Make adding a legend entry for an edge convention a click on that edge, instead of rebuilding its look from presets ([ADR 0123](../../decisions/0123-legend-line-picked-from-an-edge.md)).

## Tasks
- [x] ADR 0123
- [x] `legendLinePick.ts` (edge style → legend line) with unit tests
- [x] Canvas: pick mode, edge click, Esc, cursor and toolbar hint
- [x] Legend panel: "Line" waits for a pick; "Choose a preset…" fallback; draft preview
- [ ] Live check in the app, light and dark: pick a styled and an unstyled edge, Esc, Cancel, closing the panel while waiting, the preset fallback, an active style brush

## Notes
- Icon and Color entries are unchanged on purpose; see the ADR for why they get no picker.
