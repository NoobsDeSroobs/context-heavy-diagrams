# 0187: The React Flow label in the corner of the canvas

## Status
Not Started. Logged 2026-11-13. The maintainer decides; nothing is changed yet.

## Goal
Decide what to do about the small "React Flow" link React Flow draws in the bottom right corner of the canvas, and do it.

## Facts
- The canvas component sets no `proOptions`, so React Flow's default attribution shows.
- React Flow is MIT licensed and listed with its licence text in `THIRD-PARTY-NOTICES.md` (`@xyflow/react`, `@xyflow/system`), so the credit the licence requires is already given.
- React Flow's own page on removing the attribution asks that it is removed only by people subscribed to React Flow Pro (checked 2026-11-13). It does not say what the MIT licence alone allows; read the licence text before relying on either reading.
- Hiding it is, as far as known, one prop on the canvas (`proOptions={{ hideAttribution: true }}`); confirm against the installed version.

## Options
- **Keep it.** Nothing to do.
- **Hide it and credit React Flow elsewhere** (the About dialog, the README). Needs the licensing decision above.
- **Subscribe to React Flow Pro and hide it.** The route they ask for.
- **Restyle it** (smaller, lower contrast) without removing it.

## Tasks
- [ ] Decide which option
- [ ] Check whether the label appears in any export, and in the packaged app on Linux and Windows
- [ ] Make the change, and the credit if the label is hidden (an ADR if hiding it, since it is a licensing choice)
