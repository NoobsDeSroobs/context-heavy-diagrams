# 0157: Conformance checks beyond the first version

## Status
Not Started, parked. Collects what was discussed while scoping [epic 0138](../0138-architecture-conformance-checks.md) and deliberately left out of its first version (hexagonal and the data-flow diagram, one diagram at a time).

## Goal
Grow the conformance checker from "one diagram against one profile" to the architecture styles and workflows that need more.

## Ideas and challenges

### C4, which has levels
- C4 levels nest strictly: a context diagram zooms into a container diagram, that into a component diagram. A container does not link to sub-containers.
- Two ways to know a diagram's level: a tag the author sets (checkable with required tags), or its depth in the link tree from the root (context, containers, components), which cannot be mislabelled and suits people who do not know C4 well. Using both is the strongest: the tag states the intent, the depth verifies it, and a mismatch is a violation.
- A profile per level ("C4 context", "C4 container", "C4 component") is the cheaper first step, with the level declared in the diagram's free-form `metadata` bag, so no file-format change.
- Depth needs a crawl over linked diagrams (the rollup and deep-search crawls exist). The root must be the context diagram; a file reached by links at two depths is ambiguous and should be a violation.
- C4 has no arrow meaning, so it needs the `irrelevant` edge meaning and a "must have property" rule (every relationship has a label).

### Strict and supplementary diagrams
- Strict diagrams follow a notation's rules exactly (the C4 core levels). Supplementary ones (system landscape, dynamic, deployment) do not fit the depth model and need their own profiles or an explicit "not level-checked" marker.
- Open: how a profile says which kind of diagram it applies to, and what to report for a diagram that fits no profile.

### More rule kinds
- Layered architectures: a whole-graph check (no cycles, dependencies only downward), or a layer ranking.
- Waivers: a justified exception recorded on the element (a tag or metadata with a reason), so a deliberate violation is visible rather than silenced.
- Rules across linked diagrams: rules that see through links, not only within one diagram.

### More styles to try
Zero-trust or network zones (relates to cross-container edge detection, [epic 0088](0088-cross-container-edge-detection.md)); ArchiMate's table of allowed relationships ([epic 0148](../0148-archimate-flavoured-vocabulary-kit.md)).

### Profiles and where they live
- Shared house rules that live outside every repository and must reach CI. The CLI is offline ([ADR 0113](../../../decisions/0113-enforced-offline-behaviour.md)), so delivery is a CI step (a rules repository fetched on demand, or a zip kept in step with the pipeline definition); v1 assumes that.
- A configurable rules location, and what multiple repositories mean for it. Per-repository house rules may be unnecessary, since a standard is usually universal.
- A way for a diagram to name its profile (a pointer in the diagram or its metadata), so a check needs no argument. This touches the file format and treats the stored path as untrusted ([ADR 0115](../../../decisions/0115-paths-stored-in-diagrams-are-untrusted.md)).
- A search path of rules folders (an environment variable), if `--profile <file>` proves too clumsy.
- For people who live in a terminal: `chd check` taking a profile from stdin, or by name from a profiles folder. CI has no standard profiles folder (the pipeline provides the rules), so this is only a convenience.
- Diagnostics: remembering the chosen profile per diagram, and counting findings in the View menu's Diagnostics number.
- Accepted aliases for the edge set name a profile requires (a diagram's "Data flow" for `flowsTo`), if renaming sets proves too much to ask.

### Other shapes
- A tests-as-code library on the same evaluator, for ArchUnit-style tests in a user's repository.
- Exporting the diagram as a plain graph so an existing policy engine (OPA/Rego) can check it.
- An AI-assisted way to draft a profile from a description. If an AI writes a profile file, the stale-edit rule applies ([ADR 0109](../../../decisions/0109-stale-edit-check-for-every-ai-write-path.md)).
- A highlight mode on the canvas for violating edges.
- More edge meanings than `dependsOn` and `flowsTo`.

## Tasks
- [ ] Decide which of the above to take first once the first version has been used on real diagrams
