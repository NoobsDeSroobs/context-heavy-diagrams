# 0024: Propagating required tags down the link tree

## Status
Accepted

## Context
Epic 0034 (unified tag and metadata system) gives each diagram its own `requiredTags` template, but nothing propagates one diagram's template to its linked children — a complex view built from many linked sub-diagrams means redefining the same required tags by hand in every single one. Raised directly by the user while testing epic 0024 (multi-window), scoped as its own small epic (0035) rather than folded into either 0024 or 0034, since it's really its own feature with its own real design questions.

Three things needed deciding, not just "add a button":
1. When a child already has its own required tags, does copying overwrite them or merge?
2. Does "copy to children" mean direct children only, or the whole link subtree?
3. Links aren't confined to a diagram's own folder — ADR 0005 explicitly calls out that a link can point at "something entirely outside its own folder, repo, or ownership... e.g. a rough diagram of an externally-maintained integrated service." Should propagation follow a link like that?

## Decision
- **Merge, not overwrite.** The copied set is the parent's `requiredTags` plus any of the child's own entries whose key isn't already in the parent's set (parent wins on a key collision). A child's genuinely diagram-specific required tags — beyond whatever shared template the parent is pushing down — survive a copy instead of being silently destroyed.
- **Recurse the whole link subtree**, not just direct children — one click on the root diagram propagates arbitrarily deep, matching the actual motivating case (a complex view built from many nested sub-diagrams). The renderer previews the walk first (read-only) and shows the user how many diagrams will be touched before anything is written, given a single click can now touch many files at once.
- **Never cross outside the diagram's own colocation folder.** The walk is bounded to descendants of the *root* diagram's own colocation folder specifically — `<dir>/<basename>/`, the same same-named sibling folder its children/assets/details already colocate in per ADR 0005/0006 — not merely its containing directory. A plain sibling `.chd` sitting directly next to the root diagram (not nested inside that colocation folder) counts as external, same as a link to somewhere else on disk entirely. A link that resolves outside that tree is treated as external and skipped, not followed and not written to, no matter how deep in the subtree it's discovered. This directly preserves the "a diagram can freely link to something it doesn't own" property from ADR 0005: propagation must never reach into a diagram this one doesn't actually own just because something, somewhere in the chain, happened to link to it — and the colocation-folder boundary is the precise, already-established definition of what this diagram actually owns, not just "shares a folder with."

## Alternatives considered
- **Full overwrite of a child's `requiredTags`.** Simpler, but destroys any tag a child added on its own with no warning — a real, silent data-loss risk once propagation reaches many files unattended.
- **Direct children only.** Smaller blast radius per click, but doesn't solve the actual stated problem ("every sub-diagram in a complex view") — would need repeating the action once per level, once per diagram.
- **No folder boundary at all (follow every link, however far it strays).** Rejected outright — this is the one alternative that isn't just a smaller/simpler version of the decision, it's actively wrong: it would let a click on one diagram silently rewrite a completely unrelated, possibly not-even-yours file, which is exactly the failure mode ADR 0005 designed the "links point anywhere, ownership isn't implied" property to allow for in the first place.

## Consequences
- The recursive walk needs cycle protection (a `visited` set keyed by normalized absolute path) even though links are only supposed to point downward (ADR 0005) — a hand-edited file could still create a cycle, and two different branches can legitimately link to the same shared child, which should only be updated once.
- Every level past the first is read fresh from disk during the walk, not from any in-memory/open-window state — the operation works on diagrams that aren't currently open in any window, which is the common case for a subtree of many linked diagrams.
- The boundary check means moving a "logically internal" child outside the root diagram's own folder (or vice versa) changes whether it participates in propagation — an acceptable, easily-understood consequence of a purely path-based rule, consistent with everything else about links being content/path-based rather than metadata-flagged (ADR 0005).
- No merge/overwrite conflict UI — a key collision is resolved silently (parent wins) rather than surfaced for a per-key decision. Acceptable for v1 given the summary shown after the operation lists exactly which diagrams were touched; revisit only if silent parent-wins turns out to surprise people in practice.

**Caught during the user's own testing, not during design**: the first implementation anchored the boundary at the root diagram's containing directory (`dirname(rootPath)`) rather than its colocation folder — which meant a plain sibling `.chd` sitting right next to the root diagram was wrongly treated as "under" it and got written to. Fixed by anchoring at `colocationDirFor(rootPath)` instead, matching `linkedDiagramDirFor` in `links.ts`. The decision text above already describes the corrected (intended) rule.
