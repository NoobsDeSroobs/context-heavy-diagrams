# 0080: Mode-aware top menu bar

## Status
Done (2026-08-31), merged to `master` (PR #82). Not live-tested (Electron renderer). See [ADR 0079](../../../decisions/0079-mode-aware-menu-bar.md).

## What shipped
- **Mechanism**: `Canvas.tsx` builds `fileMenu`/`editMenu`/`viewMenu`/`helpMenu` as named locals and assembles the array per persona (`isDiagramPersona ? [file,edit,view,help] : [file,view,help]`). `MenuBar` stays persona-unaware — no per-item flag, no filtering in the shared component.
- **Matrix persona menu bar**: File without "Export as PNG" (the one File difference — a matrix-PNG export may come but isn't built); **no Edit menu**; View = **Preferences only**; Help = About. File basics (New/Open/Recent/Save/Save As/Reload/Close) are identical across personas per the user's call — a `.chd` is one file behind both views.
- **Toolbar**: the default-edge-style swatch is hidden in matrix mode (nothing there draws edges).
- **`handlePersonaChange`** (replaces the bare `setPersona` on the toolbar `<select>`): switching to matrix closes the diagram-only utility-dock panels (Details/Diagnostics/Layers/Style Palette/Align-Distribute/Diagram settings/References) + the edge-style picker, so nothing stale floats over a view whose menu can't reopen it. Preferences stays (global, valid in both).
- **No "Matrix" menu yet** — added when epic 0079 gives the matrix real persisted state (calculation modes, threat-catalog management, matrix styling). The composed-list mechanism absorbs that without a rework.
- **Out of scope**: whether the utility dock itself should be hidden in matrix mode — an epic-0079-era question about the matrix persona's full chrome.
- `typecheck`/`lint` clean (0 errors). Not live-tested (Electron renderer).

## Goal
The top menu bar (`MenuBar`/`Canvas.tsx`'s `menus` array, epic 0049) currently shows the same File/Edit/View/Help regardless of which persona (Diagram / Security Matrix) is active. Some items make no sense in matrix mode — default edge style, Layers, Required tags — and, going the other way, the matrix view will likely want its own menu items (calculation-mode settings, threat catalog management) that make no sense in diagram mode. Show what's relevant to the active persona, not a fixed menu regardless of view.

## Relevant existing behavior
- `MenuBar`, `Canvas.tsx`'s `menus` array (epic 0049/top menu bar) — the thing that needs to become persona-aware.
- The persona toggle itself: a toolbar `<select>` (Diagram / Security Matrix) in `Canvas.tsx`, swapping `ThreatMatrixView` in for `canvas-view-body` (epic 0060, fifth round).
- `ThreatMatrixManagePanel.tsx` currently exposes add/remove threat/service controls as a floating dock panel, not menu items — worth deciding whether matrix-specific menu items duplicate or replace some of what that panel already does.

## Open questions — resolved with the user 2026-08-31
- **Per-persona menu contents**: hide (don't rebuild). Matrix = diagram menus minus Edit, minus the diagram-only View panels, minus Export-as-PNG. See the table in [ADR 0079](../../../decisions/0079-mode-aware-menu-bar.md).
- **File/Edit across personas**: File basics identical ("open, close, etc. should be the same on both sides"); Edit hidden in matrix. Export as PNG dropped in matrix for now (matrix-PNG export "could make sense", isn't built).
- **Mechanism**: composed named menu locals assembled per persona in `Canvas.tsx`; `MenuBar` stays persona-unaware. Not a per-item flag.
- **Matrix-specific menu items** (calculation modes, manage matrix, matrix styling): deferred to epic 0079, when the matrix has real persisted state. The prototype's own controls stay in `ThreatMatrixView`'s inline row for now.

## Notes
Logged the same day epic 0060 closed. Independent of epics 0079/0081 (different subsystem, no data dependency) — picked up before them at the user's request (sequence 0086 → 0095 → 0080). Implemented before epic 0079, so the matrix side is "hide what doesn't apply" only; the matrix menu gets repopulated once 0079 gives it something to act on.
