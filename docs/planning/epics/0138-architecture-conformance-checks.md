# 0138: Architecture conformance checks ("does this diagram follow the architecture it claims?")

## Status
In Progress, design phase (2026-10-23). The first version is scoped under "Decided so far"; the sketch and the questions further down are the original notes, partly superseded by it.

## Goal
Let a diagram be checked against a named architectural style or rule set — for example hexagonal (ports and adapters), layered/onion, or a project's own house rules — and report violations the way the Diagnostics panel reports other problems. In other words, architectural fitness functions for diagrams.

## Original note (the user, 2026-10-16, on the train)
"Write unit tests for diagrams. Some architectures have rules, like hexagonal architecture, and maybe ArchUnit or something can check for adherence to those rules?"

**On ArchUnit specifically:** it is a Java library that checks Java code (bytecode) against rules such as "classes in the domain package must not depend on the adapter package", written as readable assertions inside ordinary unit tests. It cannot read a `.chd`. What carries over is the *style*: rules as small, readable, runnable tests that fail a build. The same idea exists for other code (dependency-cruiser for JavaScript, for example), always for code, not diagrams.

## Decided so far (2026-10-23)
- **Shape:** a declarative profile (a rules file) evaluated by one pure function in `src/shared`, shown in a Conformance section of Diagnostics and run from `chd check`.
- **A profile is applied to a diagram, never stored in it.** Built-in profiles ship with the app and CLI; house rules live outside the diagram, in the repository or the installation. Where they are found, and how a team shares rules that live outside a repository with CI, is still open. The CLI stays offline, so it can only read local paths.
- **Edge meaning is declared, never guessed.** Every profile declares what an arrow means, with no default; an unset value makes the profile itself invalid. v1 knows `dependsOn` and `flowsTo`. The diagram must have an edge direction set whose name, with spaces removed and lower-cased, equals the declared meaning ("Depends On" matches `dependsOn`); the rules are then evaluated in that set's orientation. A diagram without that set (or with two that match) is non-compliant, a violation like any other.
- **Edges are declared in two required fields, with no defaults.** `meaning`: `dependsOn`, `flowsTo` or `irrelevant`. `presence`: `required`, `optional` or `forbidden`. The starting value of each is `none`, which is not valid: a profile that leaves either at `none` (or omits it) is rejected until its author picks a real value. `forbidden` requires `irrelevant`, and `dependsOn` or `flowsTo` cannot be `forbidden`. The edge set check applies only when the meaning is `dependsOn` or `flowsTo`.
- **A diagram missing the required edge set is reported as a violation ("Missing required edge set")**, so the result is never clean. The rules that need a direction cannot run and are listed as not evaluated; rules that do not need one still run.
- **v1 targets:** hexagonal (`dependsOn`) and the data-flow diagram (`flowsTo`), one diagram at a time. Rule kinds: forbidden edge, required edge, containment, "must have property" and a maximum element count. Findings have three severities: error (breaks a rule of the style), warning (best practice or hygiene) and info.
- **CLI (v1):** `chd check <file> --profile <file-or-built-in-name>`. Shared house rules that live outside a repository reach CI by the team's own means (a rules repository fetched by the pipeline, or a zip kept in step with the pipeline definition); the tool only reads local paths.
- **Everything else is parked** in [epic 0157](later/0157-conformance-checks-beyond-v1.md): C4 and levels, supplementary diagrams, layered and cycle rules, waivers, linked-diagram scope, profile pointers.

## Tasks
- [x] ADR for the profile format and the edge declaration ([ADR 0131](../../decisions/0131-conformance-profiles.md)); spec of the profile file ([conformance-profile-format.md](../../conformance-profile-format.md)); template and two draft profiles in `resources/profiles/`
- [ ] Profiles folder (a Preferences setting, default in the user-data folder) and a "New profile" command that copies the template there, failing if the file exists
- [x] Profile validation (the `none` sentinel, the consistency rules between `meaning` and `presence`)
- [x] Pure evaluator in `src/shared`: roles by exact tag, type and containment, the edge set lookup, forbidden edge, required edge, containment, must-have-property, maximum element count
- [x] Built-in profiles: hexagonal, data-flow diagram, with example diagrams that pass and that fail (`examples/conformance/`)
- [ ] Conformance section in Diagnostics (select and frame the offender)
- [x] `chd check` command with `--profile`, and its exit code for CI
- [ ] Tests over the example diagrams; docs and AI instructions

## Two shapes this could take (open)
- **Declarative profile:** a rules file (see the sketch below), evaluated by the app, the CLI and the Claude extension. Easiest for non-programmers; needs a rule language designed and documented.
- **Tests as code:** a small library that loads a `.chd` into a graph and lets people write ordinary tests in their own repository (`node --test`, ArchUnit-style assertions such as "no adapter depends on another adapter"). No rule language to design, extremely flexible, runs in any CI, and an AI assistant can write the tests. But it asks users to write JavaScript, and the app itself cannot show the result unless it runs the tests.
- They are not exclusive: the declarative profile could compile to the same evaluation functions the library exposes. Also possible: export the diagram as a plain graph (nodes, edges, tags) so any existing rule tool, such as a policy engine like OPA/Rego, can check it without this project owning a rule language at all.

## Why it might fit this tool
- Elements already carry the data rules need: tags and required tags with allowed values (a role such as `port`, `adapter`, `domain`), containers (boundaries, layers, zones), directed edges, and links between diagrams.
- The search facets (`tag:`, `has:`, `label:`) already form a small matcher language with one pure predicate, so a rule can be written in terms of "elements matching X" and "elements matching Y".
- The Diagnostics panel already lists problems and selects/frames the offending element on click.
- A rules file in plain text, versioned in git next to the diagrams, matches the tool's pitch. A command-line `chd check` could run in a repository's CI, and an AI assistant could read the violations and fix the diagram.

## Sketch (not decided)
- **A rule profile** is a small text file (JSON) with named roles and rules. Rule shapes that would cover a lot:
  - *Forbidden edge:* no edge from elements matching A to elements matching B.
  - *Required edge:* every element matching A has at least one edge to an element matching B (every port has an adapter).
  - *Containment:* elements matching A must (or must not) sit inside a container matching C.
  - *No cycles / downward only:* for layering, checked over the whole graph, not only direct edges.
- **Hexagonal as the first built-in profile** to prove the model: domain at the centre, ports on its boundary, adapters outside, dependencies pointing inward only.
- **Surfacing:** a "Conformance" section in Diagnostics (severity, rule name, click to select and frame), optionally a highlight mode for violating edges (compare the container-crossing idea in [epic 0088](later/0088-cross-container-edge-detection.md)).
- **Waivers:** a justified exception recorded on the element (a tag or metadata with a reason) so a deliberate violation is visible, not silenced.

## Questions to settle
1. **What does an edge mean?** In hexagonal architecture dependencies point inward, but a diagram drawn as call or data flow shows the domain calling outward to a driven adapter. A profile must say whether edge direction means "depends on" or "flows to", and mixed diagrams need a per-edge or per-edge-set answer. This is the biggest design risk; getting it wrong produces confidently wrong results.
2. **Where do roles come from?** Tags (flexible, but easy to forget to set), a dedicated "role" field, or inferred from container membership. Untagged elements need a defined result: ignored, a warning, or a violation.
3. **Where does the profile live?** Referenced from the diagram's settings, embedded in the `.chd`, or only passed to the CLI. Each choice affects the file format, so it should wait for the file/app version warning ([epic 0137](../completed-epics.md#0137-open-source-release), group 6) and must update `docs/file-format.md`.
4. **Scope across linked diagrams:** drill-down trees are a core feature. Should a rule see through links (the rollup and deep-search crawls already exist), or apply per diagram?
5. **Built-in profiles vs authored ones:** how many styles ship (hexagonal, layered, C4 levels, zero-trust zones?) and how users share their own. An AI-assisted way to draft a profile from a description is plausible; if an AI writes a profile file, the standing stale-edit rule applies.
6. **Honest limits:** this checks the diagram, not the code. A diagram can conform while the implementation does not. That is worth stating plainly so the feature does not give false confidence; code-level checking is a different tool category (ArchUnit, dependency-cruiser) and out of scope here.
7. **Language:** is the matcher/rule language the existing search syntax extended, or something separate? Reuse keeps it small, but search was not designed to express relations between two elements.

## Feasibility (first impression)
Medium-sized. The evaluation can be a pure function in `src/shared` over a parsed diagram plus a profile, in the style of `changesSinceSave.ts`: unit-testable, and reusable by the Diagnostics panel, the CLI and the Claude Desktop extension. The hard parts are the design questions above, not the code.

## Related
- [Epic 0088](later/0088-cross-container-edge-detection.md) — container-crossing edges, a likely building block.
- [Epic 0134](later/0134-self-describing-chd-files.md) — a `.chd` that tells an AI how to read it; a profile pointer could ride along.
- [ADR 0096](../../decisions/0096-search-facets-and-shared-match-predicate.md) — the shared match predicate rules could reuse.

## Notes
Raised by the user on 2026-10-16 while planning the open-source release. Not part of that release.
