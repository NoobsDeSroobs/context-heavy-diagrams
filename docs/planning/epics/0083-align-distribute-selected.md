# 0083: Align/distribute selected elements

## Status
Done (2026-08-24), on `epic/0083-align-distribute-selected`, live-tested and confirmed working by the user, not yet merged.

## Goal
An Edit-menu action to arrange every selected element into an evenly-spaced column or row in one click, instead of manually dragging each one into position. Raised directly by the user.

## Tasks
- [x] Design the exact behavior (cross-axis reference, gap measurement) — see [ADR 0058](../../decisions/0058-align-and-distribute-selected.md)
- [x] `alignSelected` in `Canvas.tsx` — the geometry (absolute-position based, parent-relative-aware)
- [x] `AlignDistributePanel.tsx` — the gap field + two action buttons, in the existing dock-panel shell
- [x] Edit menu item ("Align / Distribute…", disabled under 2 selected)
- [x] Live-tested by the user with differently-sized shapes, both axes, multiple gap values — confirmed working

## Notes
Logged and built same-day, 2026-08-24, directly after epic 0032 (edge routing) merged — unrelated feature, own branch. See ADR 0058 for the two design decisions asked of the user before implementation (cross-axis snap reference, edge-to-edge vs anchor-to-anchor gap).
