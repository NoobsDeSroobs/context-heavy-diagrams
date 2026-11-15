# 0179: The React Flow link is hidden and the library is credited elsewhere

## Status
Accepted (2026-11-15)
Supersedes: none
Superseded by: none

## Context
React Flow draws a small "React Flow" link in the bottom right corner of the canvas unless `proOptions.hideAttribution` is set. Its licence is MIT, which asks that the copyright and permission notice travel with the software, not that a link is shown; both notices are in `THIRD-PARTY-NOTICES.md`. React Flow's own page on removing the attribution asks that only subscribers to React Flow Pro remove it (read 2026-11-13).

## Decision
- **Hide the link,** on the editing canvas and in the compare window (`HIDE_ATTRIBUTION` in `flowTypes.ts`).
- **Credit React Flow where an app credits what it is built with:** the About dialog names it, the third-party notices carry its licence text and the maintainer names it in the places the tool is presented.
- This is a choice made against what React Flow asks; the licence permits it. If that changes, or React Flow objects, it is undone by removing one constant.

## Alternatives considered
- **Keep it.** Nothing to do, and the label sits where the minimap toggle is and shows in every screenshot of the tool.
- **Subscribe to React Flow Pro.** The route they ask for; a recurring cost for a free, open-source project.
- **Restyle it** (smaller, lower contrast). Keeps the link and still takes the corner.

## Consequences
- The canvas corner is free.
- The credit lives in text a person has to open (About, notices), not on the canvas.
