# 0080: Mode-aware top menu bar

## Status
Not Started — not yet scoped. Split off epic 0060 on its closure (2026-08-25), deferred there at the fifth/sixth rounds ("we can modify the main menu bar later once things start to solidify" — it has, now that the mechanism is decided).

## Goal
The top menu bar (`MenuBar`/`Canvas.tsx`'s `menus` array, epic 0049) currently shows the same File/Edit/View/Help regardless of which persona (Diagram / Security Matrix) is active. Some items make no sense in matrix mode — default edge style, Layers, Required tags — and, going the other way, the matrix view will likely want its own menu items (calculation-mode settings, threat catalog management) that make no sense in diagram mode. Show what's relevant to the active persona, not a fixed menu regardless of view.

## Relevant existing behavior
- `MenuBar`, `Canvas.tsx`'s `menus` array (epic 0049/top menu bar) — the thing that needs to become persona-aware.
- The persona toggle itself: a toolbar `<select>` (Diagram / Security Matrix) in `Canvas.tsx`, swapping `ThreatMatrixView` in for `canvas-view-body` (epic 0060, fifth round).
- `ThreatMatrixManagePanel.tsx` currently exposes add/remove threat/service controls as a floating dock panel, not menu items — worth deciding whether matrix-specific menu items duplicate or replace some of what that panel already does.

## Real open questions (deliberately not resolved here)
- **Exact per-persona menu contents** — which of today's File/Edit/View/Help items hide in matrix mode, and what (if anything) the matrix persona adds. Not specified yet beyond the three examples already named (default edge style, Layers, Required tags don't apply in matrix mode).
- **Whether File/Edit stay identical across personas** (open/save/undo presumably still apply to the diagram file regardless of which view is showing) or diverge too.
- **Mechanism** — a `menus` array keyed by current persona, versus filtering the existing array by a per-item "relevant personas" flag. Depends on how much menu content ends up actually diverging.

## Notes
Not scheduled into any current batch — logged the same day epic 0060 closed. Independent of epics 0079/0081 (different subsystem, no data dependency) — could be picked up in any order relative to them.
