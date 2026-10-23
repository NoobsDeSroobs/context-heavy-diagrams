# 0131: Conformance profiles: a rules file applied to a diagram

## Status
Accepted (2026-10-23).

## Context
A diagram can claim an architectural style (hexagonal, data-flow) and break its rules without anyone noticing. The tool already knows what the rules need: tags, containers, directed edges and named edge readings. What was missing is a way to write the rules down once and check any diagram against them, in the app and in CI.

## Decision
- **A profile is a JSON file applied to a diagram, never stored in one.** It has `edges`, `roles` and `rules`; the full format is in [conformance-profile-format.md](../conformance-profile-format.md), written to stand on its own so others can author profiles or build checkers.
- **The arrow meaning is declared, never guessed.** `edges.meaning` is `dependsOn`, `flowsTo` or `irrelevant` and `edges.presence` is `required`, `optional` or `forbidden`. Both start at `none` in the template, which is invalid, so a profile cannot be used until its author has chosen. Direction rules are rejected under `irrelevant` and `forbidden`.
- **A diagram states its meaning with an edge direction set** ([ADR 0081](0081-flippable-edge-direction-sets.md)) whose name equals the meaning with spaces removed and lower-cased (`Depends On` is `dependsOn`). The rules are evaluated in that set's orientation. A diagram without the set, or with two that match, has a violation; it is never silently checked in the wrong reading.
- **Roles are exact matches on type, tag and containment**, not the substring matching of the search box ([ADR 0096](0096-search-facets-and-shared-match-predicate.md)). Compared text is normalised (lower-cased, whitespace removed) and must then be equal, so `Data Store` equals `datastore` but a rule about `role=port` does not catch `support`. An element that matches no role is ignored.
- **Five rule kinds in the first version**: `forbiddenEdge`, `requiredEdge`, `containment`, `requiredProperty` and `maxElements`. Each finding names the rule, a severity and the elements concerned.
- **Three severities.** `error` breaks a rule of the style and fails the check, `warning` breaks a best practice or diagram hygiene, `info` is worth knowing (the diagram is getting large). Only errors fail the check.
- **A key the format does not know is an error**, so a typo cannot disable a rule. A profile that fails validation checks nothing.
- **Files and places.** A profile is `<name>.chdprofile.json`. The app ships a template and two profiles (hexagonal, data-flow diagram) in `resources/profiles/`. The user's own profiles live in a profiles folder, a Preferences setting that defaults to `profiles` in the app's user-data folder and can point anywhere, such as a folder in a repository. File → "New conformance profile…" and a button in Preferences open a save dialog that starts in that folder; the file name chosen becomes the profile's name, the template is copied under it, and nothing is overwritten if the file exists. Sharing rules that live outside every repository with CI is left to the team: the command line only reads local paths and stays offline ([ADR 0113](0113-enforced-offline-behaviour.md)).
- **The check is a pure function in `src/shared`**, used by the Diagnostics panel and by `chd check <file> --profile <file-or-built-in-name>`, whose exit code is non-zero when a finding has severity `error`.

## Alternatives considered
- **Rules as test code** (ArchUnit style). Flexible, but asks users to write JavaScript and shows nothing in the app. The pure function can serve a library later.
- **Reuse the search query language for roles.** Small, but it is substring-based and cannot say "inside a container with this role" or relate two elements.
- **Edge meaning as a default, flipped afterwards.** Many styles do not define what an arrow means; a default would give confidently wrong results.
- **The profile embedded in the `.chd` file.** Every diagram would carry its own copy of shared house rules, and it would change the file format.
- **One combined edge field** for meaning and presence. "Required but any meaning" and "forbidden" are about presence, not meaning, so they would be mixed up with it.

## Consequences
- No change to the `.chd` format: diagrams only need tags and an edge direction set.
- A diagram's author must prepare it (tags, the named edge set) for each profile; the profile's `description` says how.
- The edge set name is matched as text, so an existing set called "Data flow" has to be renamed to "Flows To" before the data-flow profile applies.
- Linked diagrams, levels (C4), layer ordering and waivers are not covered in the first version and are left for later.
