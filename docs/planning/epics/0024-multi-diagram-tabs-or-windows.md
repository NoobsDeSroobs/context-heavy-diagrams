# 0024: Multi-diagram tabs or windows

## Status
Not Started — not yet scoped

## Goal
A way to have more than one diagram open and visible at once — most concretely, a parent and a linked child, without round-tripping through breadcrumb back-navigation to see both. Came up while testing epic 0009: a real, legitimate idea, but deliberately not adopted there, since the actual bug reported at the time (a newly-created link never surviving navigation) had a small, complete fix that didn't need it — see [epic 0009](0009-linked-diagram-navigation.md)'s Notes.

Two shapes worth weighing when this starts: tabs within one window vs. separate `BrowserWindow`s per diagram. Genuinely undecided — not scoped yet.

## Tasks
(Not broken down — revisit when this epic starts.)

## Notes
Epic 0006 (undo/redo) references this: for now, the undo stack is scoped per-diagram and resets on any navigation. Once tabs/windows exist, it should instead persist per-tab for that tab's whole lifetime (closing a tab is the natural point to discard its history, not navigating within it). That's this epic's problem to solve, not 0006's.
