# 0086: A missing/unrecognized field resolves to this app's own full default behavior, never a degraded fallback

## Status
Accepted

## Context
Raised directly by the user (2026-09-05) after a real bug: a hand-authored `.chd` edge with no `type` field — valid per the file format's own "absent means default" convention (`docs/file-format.md`) — silently rendered through React Flow's generic built-in edge component instead of this app's own `LabeledEdge`, because of how `type: e.type` (an explicit `undefined`, not a missing key) interacted with React Flow's own `defaultEdgeOptions` merge order (see `docs/known-issues.md`'s "A hand-authored edge with no `type` field..." entry for the full mechanism). The edge still drew, in the right place — it just silently lost styling, highlight support, and custom routing, with no error anywhere.

The user's framing generalized past that one bug: "The default behaviour when the generated diagram is wrong should be a fail safe state... That way everything works even if the generator and the app is mismatched in version or for any other reason." This app's file format is explicitly meant to be third-party-writable (`docs/file-format.md`'s own stated goal, reinforced by [the architecture overview](../architecture/overview.md)'s "the file format is documented as a standalone spec" principle) and explicitly backward/forward-compatible by design (a reader from an earlier point in the format's timeline can open a newer file; current code must open an old file missing newer fields without failing — `docs/file-format.md`'s Determinism & versioning section). That combination — many possible writers, of many possible versions, all producing files this app must open — means "the file doesn't look quite like what this exact build expects" isn't an edge case, it's a routine, expected situation.

## Decision
When resolving an absent or unrecognized value for a field this format documents as having a default, the app must resolve to **the same rendering/behavior path as its own correctly-specified default** — never a different, lesser, or more generic fallback path, even silently and even when nothing appears broken on the surface.

Concretely, two failure modes are both wrong, and this app should exhibit neither:
- **Fail loud** (throw/refuse to open) — already rejected by this project's existing backward-compatibility stance; not reconsidered here, just restated for completeness.
- **Fail quiet-but-different** (what the edge-`type` bug actually did) — resolve to *some* working state, but one that's missing real capability compared to the documented default, with no signal that anything is off. This is worse than failing loud in one specific way: a loud failure gets noticed and fixed; a quiet, capability-losing fallback can sit unnoticed indefinitely; exactly what happened here.

The only acceptable resolution for "field absent/unrecognized" is: behave *exactly* as if the documented default value had been explicitly written. Not approximately — exactly, via the same code path a correctly-specified file would take.

## Alternatives considered
- **Fail loud on any unrecognized field** — rejected, conflicts directly with this project's standing backward-compatibility principle and the explicit goal of tolerating third-party writers.
- **Leave silent-degrade as acceptable, just fix bugs as reported** — rejected: the whole point raised here is that a silent capability loss with no error is the hardest class of bug to *notice* in the first place, so treating it as "fine until reported" undersells how easy it is for it to go unreported for a long time (this exact bug likely predates this session's diagrams being the first hand-authored `.chd` files with edges to actually exercise the omitted-`type` path with real content that would reveal it).

## Consequences
- This is a standing lens for future bug triage, not a one-time fix: if something "silently doesn't work" with no console error, check whether it's actually resolving to a *different* code path than the documented default (as the edge-`type` bug did) before assuming it's a narrower, feature-specific bug.
- No code-wide audit was performed as part of writing this ADR — the one confirmed instance (edge `type`) is already fixed (`src/renderer/src/Canvas.tsx`'s `fromDiagramFile`, see `docs/known-issues.md`). This ADR exists so the *next* instance, whenever it's found, gets read against this principle rather than re-litigated from scratch.
- Doesn't change anything about how `.chd` files are *written* — the `chd-diagrams` skill's guidance to write fields like edge `type` explicitly anyway stands as defense-in-depth for older builds still carrying this bug, independent of this app's own fix.
