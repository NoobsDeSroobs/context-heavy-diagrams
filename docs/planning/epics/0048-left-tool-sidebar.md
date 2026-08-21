# 0048: Left-side tool sidebar

## Status
Not Started — not yet scoped. Raised by the user (2026-08-20) while reviewing the gallery diagrams. Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037-0047. Explicitly told not to build yet.

## Goal
A dedicated left-side sidebar for canvas-level tools — extending what's already there (zoom, fit-to-screen, lock-edits) with more, e.g. a toggle for the legend view (epic 0037) once that exists, "and things."

## Relevant existing behavior
"Zoom, fill screen, and lock edits" is React Flow's own built-in `<Controls />` component (`Canvas.tsx`, rendered with no `position` override — its default, bottom-left), sitting alongside a `<MiniMap />` in the same corner area. Everything else panel-like (Required tags, Diagnostics, Highlights) is currently a plain `<button>` in the single horizontal top toolbar together with the file actions (New/Open/Save/Save As/Reload/Undo/Redo) — there's no existing left-sidebar surface distinct from React Flow's own default corner widget.

## Real open questions (deliberately not resolved here)
- **What actually moves here vs. stays in the top toolbar / a future menu bar** (see [epic 0049](0049-top-menu-bar.md), raised in the same message) — the two ideas together suggest a real information-architecture pass (file-level actions to a top menu, per-diagram view toggles to a left sidebar) rather than two piecemeal changes decided independently. Worth designing both together even if built separately.
- **Relationship to React Flow's own `<Controls />`** — does this sidebar replace it with a custom-built equivalent (more control over styling/content, but reimplementing zoom/fit/lock), or extend it (simpler, but constrained by what `<Controls />` itself allows adding)?
- **Which existing toolbar buttons migrate** — Required tags / Diagnostics / Highlights are the obvious current candidates (already panel-toggle buttons, just living in the wrong place today), but this needs an explicit decision, not an assumption.
- **Relationship to epic 0037** (diagram legend) — that epic's own open questions include "where does it render when toggled on" and the toggle mechanism; this sidebar is a plausible answer to both, worth resolving together rather than epic 0037 inventing its own toggle location independently.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it's on the backlog and not lost, not because it's next up.
