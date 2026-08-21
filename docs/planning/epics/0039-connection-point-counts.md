# 0039: Per-side connection point counts

## Status
Not Started — not yet scoped. Raised by the user (2026-08-20), the same day epic 0013's "Add connection point here" bug was found and fixed during epic 0022's gallery testing — trying that flow with the fix in place surfaced a real usability problem (see Decided) that prompted this. Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037/0038.

## Decided
**Augments, doesn't replace, the existing click-to-add flow — both capabilities stay.** Confirmed by the user after trying click-to-add in practice: it isn't very accurate, since the point lands wherever the mouse happened to be rather than anywhere precise. That's exactly the case a count-per-side generator is meant to help with (fast, evenly-spaced, no fiddly clicking), but click-to-add still has real value for placing an individual point exactly where one specific edge needs to land — no reason to lose that. Whether click-to-add's own accuracy is worth separately improving (e.g. some kind of snapping or a numeric offset input) is a smaller, related idea, not scoped here.

## Goal
Alongside the existing right-click "Add connection point here" (which places one point near the click position), let the user configure a *count* of connection points per side — e.g. 4 on the right, 2 on the bottom, 1 on the top, 0 on the left — evenly spread along each side automatically, rather than placed one at a time by hand.

## Relevant existing behavior
Epic 0013's current model: `connectionPoints: [{ id, side, offset }]` per node (`docs/file-format.md`). Points are added one at a time via right-click → "Add connection point here" (nearest-side/offset computed from click position, `nearestConnectionPoint` in `src/renderer/src/nodes/connectionPoints.ts`), removed one at a time via right-click on the point itself. **No file-format change is required just to support a count-based generator** — an even-spread count-per-side UI would still only ever produce ordinary `ConnectionPoint` entries with computed offsets. That changes if the design later wants to persist "N evenly spaced on this side" as its own declarative concept rather than baking out the resulting offsets at generation time — see the open questions below.

## Initial reaction (for the design discussion, not a decision)
The current model's strength is *precision* — a point can be placed exactly where a specific edge needs to land (three points at three specific, unevenly-spaced heights matching three specific incoming connections, say). A pure count-per-side, evenly-spread model trades that away for speed of setup. A hybrid — count-per-side as a bulk-generate convenience, existing click-to-add/remove still available afterward to fine-tune individual points — could get both: fast for "I just want 4 on the right," no loss of precision for the exceptional case. If points stay draggable/removable after being generated, "evenly spread" only needs to be true *at generation time*, not an invariant the app continuously enforces afterward — worth being explicit about which of those two this is, since they're different amounts of work (compute once vs. maintain a constraint).

## Real open questions (deliberately not resolved here)
- **Where does the setting live?** Per-node, surfaced how — right-click menu, a property-panel field, a small form with one number input per side?
- **Regenerate behavior** — if a count changes after points already have edges attached, what happens to points that would be removed? Epic 0013 already blocks removing a single point with an edge attached; a bulk regenerate needs its own answer, likely more disruptive since one count change could conflict with several existing edges at once.
- **Evenly spread — exact spacing convention?** Points at the corners (offset 0 and 1) or inset from them? Does count=1 match the default 4 fixed points' own behavior (centered on the side, offset 0.5) as a special case?
- **Interaction with resize** — already handled for individual points today (percentage-based offset, not pixels, epic 0013) — a generated set should inherit that for free, worth confirming once built rather than assuming.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it's on the backlog and not lost, not because it's next up.
