# 0063: Dim/focus mode — de-emphasize non-matching elements

## Status
Not Started — not yet scoped. Raised by the user (2026-08-22) alongside [epic 0062](0062-search-and-highlight-matches.md), same motivation (navigating the 70-node Meridian Rail landscape). **Explicitly told to log this for later, not build it now.**

## Goal
A toggleable mode where elements *not* currently matched (by an active highlight and/or a search query, see epic 0062) are visually de-emphasized — most likely reduced opacity — rather than the current behavior, where matches only ever get color added on top with no corresponding change to everything else. The point is subtracting visual noise at scale, not just adding emphasis.

The user explicitly wants this as **a setting**, not a permanent behavior change — exact home in the UI not decided (candidates: the existing global Settings panel, epic 0047/ADR 0032's precedent; a toggle inside the Highlights popup itself; something new). Flagged as undecided, not to be assumed.

## Real open questions (deliberately not resolved here)
- **What counts as "matching" for dim purposes** — the currently toggled-on highlight set (epics 0026/0036), a live search result (epic 0062), or both uniformly? If both, does enabling one while the other is inactive still dim correctly (i.e. does "matching set" need a single unified definition both features write into)?
- **Does dimming apply to edges as well as nodes?** Today's highlight system's node/edge treatment should be checked before assuming symmetry.
- **Interacts with existing highlight coloring** — does dim mode replace the current color-on-match treatment, or layer on top of it (dim non-matches AND keep coloring matches)?
- **Per-highlight-group or global** — one dim toggle for the whole diagram, or could different highlight groups reasonably want different dim behavior?
- **Where the setting lives** — see Goal above; also worth checking whether it should default on or off, and whether it persists per-diagram or per-app-user (compare `settings.ts`'s existing global settings vs. anything diagram-local).

## Notes
Not scheduled into any current batch — flagged here so it isn't lost, not because it's next up. Closely related to epic 0062 (search) and the existing highlight system (epics 0026/0036) — whoever scopes this should read both first, since "what's the active matching set" is a shared concept across all three.
