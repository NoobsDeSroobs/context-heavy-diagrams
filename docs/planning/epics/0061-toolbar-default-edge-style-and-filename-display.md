# 0061: Toolbar polish — visible default-edge-style control, filename instead of full path

## Status
Not Started — not yet scoped. Raised by the user (2026-08-22), explicitly for a future batch UI-polish pass, not now. Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037/0038/0048/0055/0056/0057/0058/0059/0060 before their own design passes.

## Goal
Two small, related toolbar tweaks, both in the same top-toolbar strip (`Canvas.tsx`'s `.toolbar` — `MenuBar`, saved-flash indicator, current-file display, theme toggle, in that order today):

1. **A visible, always-present default-edge-style control.** `<ReactFlow defaultEdgeOptions={{ type: 'labeled', markerEnd: {...} }}>` already exists — what a newly-drawn edge looks like is real, existing behavior, just hardcoded with no UI at all today, not a user-adjustable setting and not shown anywhere. The user's own suggestion: surface it as something always visible in the toolbar, "maybe next to the file name" — closer to how drawing tools persistently show a "current pen style" indicator than a setting buried in a dialog you have to open to even see the current value.
2. **Show only the filename, not the full path**, in the toolbar's current-file display (`Canvas.tsx`: `{currentPath && <span className="toolbar-path">{currentPath}</span>}` — today this renders the raw absolute path verbatim, e.g. `D:\GitHub\...\meridian-rail-landscape.chd`, not just `meridian-rail-landscape.chd`).

## Relevant existing behavior
- Toolbar layout and its history: `ADR 0039` (epic 0049, the top menu bar) — `Canvas.tsx`'s toolbar row already dropped every File/Edit/View button when the menu bar landed, keeping only the saved-flash indicator, current-file-path display, and theme toggle, "none of which fit the File/Edit/View split."
- `defaultEdgeOptions` is passed directly to `<ReactFlow>`, not read from `settings.ts` — unlike `edgeStraightSegmentLength`/`selectedEdgeHighlightColor` (epic 0047/0042), which *are* real global settings, just not toolbar-visible either (Settings panel only).

## Real open questions (deliberately not resolved here)
- What exactly is adjustable in a "default edge style" control — just line style/color, or the full set (markers, width, dash pattern)? Does it belong in `settings.ts` as a proper global setting (like the two above), with the toolbar control just being a shortcut to it, or is it toolbar-only state?
- Full path vs. filename-only — does the full path stay available on hover (a `title` tooltip) for when it's actually needed, or is it gone entirely?
- Whether "always visible in the toolbar" extends past these two specific asks to a broader toolbar-visibility review, or stays scoped to just these two.

## Notes
Not scheduled into any current batch — flagged here so it isn't lost, not because it's next up. The user framed this explicitly as a future "batch improvement session," suggesting it may get grouped with other small UI-polish items rather than tackled alone.
