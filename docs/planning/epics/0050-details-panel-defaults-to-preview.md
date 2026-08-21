# 0050: Details panel defaults to preview, not edit

## Status
Done

## Goal
Opening a node's details panel (epic 0008) should show the rendered Markdown preview first, not the raw editable textarea — matching how the panel is actually used most of the time (reading an existing note), not how it's used the first time it's written.

## Tasks
- [x] `DetailsPanel.tsx`: `useState<Mode>('edit')` → `useState<Mode>('preview')`. One line; the toggle button and both render branches were already correct, they just started on the wrong side.
- [x] `npm run typecheck` clean.

## Notes
Raised by the user (2026-08-20) alongside epic 0022's gallery work — most of that work involved reading, not writing, details content, which is presumably what surfaced this as an annoyance. Not independently verified in the running app.

An empty details panel now opens straight into an empty preview (no placeholder text prompting "click Edit to add notes") — not changed here since the user's ask was the plain default, not a conditional one. Worth a look later if that turns out to read as broken rather than just empty.
