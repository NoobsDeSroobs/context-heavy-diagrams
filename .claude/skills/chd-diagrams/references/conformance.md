# Checking a diagram against an architecture style

A **conformance profile** holds the rules of one architectural style (hexagonal, data-flow diagram, a team's own house rules). `chd check` applies a profile to a diagram and reports where the diagram breaks the rules. A profile is a separate file, never part of the diagram, and a check never changes the diagram.

```bash
chd check path/to/diagram.chd --profile hexagonal
chd check path/to/diagram.chd --profile rules/house.chdprofile.json --json
chd check --help        # lists the built-in profiles
```

`--profile` takes a built-in name or the path to a `.chdprofile.json` file. Exit code 0: the diagram conforms (warnings and information are listed but do not fail it). 1: a diagram has an error. 2: the command or the profile cannot be used (the message says why).

## Read the profile before preparing a diagram

Open the profile file (built-in ones are in the app's `resources/profiles/`) and read its `description`: it says exactly what a diagram needs. Two things are always needed:

- **An edge direction set named after what the arrows mean.** A profile with `edges.meaning` of `dependsOn` needs a set named `Depends On`; `flowsTo` needs `Flows To` (case and spaces do not matter). In the diagram file that is a top-level `edgeDirectionSets: [{ "id": "...", "name": "Depends On" }]` plus `activeEdgeDirectionSetId` with the same id; with one set the edges' own `source` and `target` are that reading. Without it the check reports `edge-set` and cannot run the rules that need a direction.
- **Roles, as tags.** Profiles recognise an element by a tag, usually `role`: `"metadata": { "role": { "value": "adapter-in" } }` on the node. Values are compared ignoring case and spaces, and exactly otherwise: `port` is not `support`.

## Reading the result

Each finding names the rule (`id`), a severity and the elements. `error` breaks a rule of the style; `warning` breaks a best practice; `info` is worth knowing. "Not evaluated" lists rules that could not run because the edge set is missing. A finding is a statement about the diagram, not necessarily a mistake in it: **report what the check found and let the person decide.** Do not retag elements, add or remove edges, or move things into containers just to make a check pass, unless that is what they asked for.

## Writing a profile

Only when asked. Start from `resources/profiles/template.chdprofile.json` (the app's **File → New conformance profile…** copies it into the user's profiles folder) and work through it from the top. `edges.meaning` and `edges.presence` start as `"none"`, which is not valid: they are the author's decision, so ask rather than choose. An unknown key is an error. The full format is `docs/conformance-profile-format.md` in the project's repository. A profile file written by an assistant follows the same stale-edit rule as a diagram: run `chd hash` before overwriting an existing one.
