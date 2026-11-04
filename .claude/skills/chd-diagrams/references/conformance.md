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

Only when asked. A profile is a JSON file named `<name>.chdprofile.json`. Ask the person for the three decisions that are theirs, then write the file:

1. **What does an arrow mean, and must there be any?** `edges.meaning` is `dependsOn` (A depends on B), `flowsTo` (something flows from A to B) or `irrelevant`; `edges.presence` is `required`, `optional` or `forbidden`. There is no default, and `"none"` (as in the app's template) is invalid.
2. **How is each kind of element recognised?** Usually a tag such as `role` or `layer`, sometimes the element's `type` (`entity`, `container`, `text`) or being inside a container of another role. Each kind of element is a named **role**.
3. **Which rules?** Only the ones the person states. Do not invent rules for a style you are guessing at.

Where to save it: next to the diagrams (for example `rules/`), so it is in version control and CI can run it. In the app, a profile in the profiles folder (Preferences) also shows up in the Diagnostics panel. Writing over an existing profile follows the same stale-edit rule as a diagram (`chd hash` first). In the Claude Desktop extension, `create_file` and `update_file` write a `.chdprofile.json` file the same way, refuse one that is not valid, and `check_diagram` tests it.

**Top level:** `profileVersion` (always `1`), `name`, `description` (say how a diagram must be prepared: which tags, which edge set), `edges`, `roles` (may be `{}`), `rules` (may be `[]`). An unknown key anywhere is an error.

**A role** is `{ "description"?, "match": { ... } }`. `match` has at least one of (all must hold): `type`, `tag: { "key", "value"? }` (`value` is a string or a list meaning any of them), `insideRole`. Role names are letters, digits, `-` and `_`. An element matching no role is ignored.

**A rule** has `id` (unique), `kind`, optional `severity` (`error` default, `warning`, `info`) and optional `message`. Wherever a rule takes a role, `"*"` means any entity, container or text node.

| `kind` | Fields | Finds |
|---|---|---|
| `forbiddenEdge` | `from`, `to` | an edge from a `from` element to a `to` element |
| `requiredEdge` | `each`, `edge` (`outgoing`, `incoming`, `either`), `with` | an `each` element with no such edge to a `with` element |
| `containment` | `each`, and one of `mustBeInside` / `mustNotBeInside` | an `each` element on the wrong side of a container with that role |
| `requiredProperty` | `each` (a role, or `"@edges"`), `property` (`"label"` or `{ "tag": "key" }`) | an element or edge without it |
| `maxElements` | `of`, `max` (whole number, 1 or more) | the diagram holding more than `max` elements of that role |

`forbiddenEdge` and `requiredEdge` need a direction, so they are not allowed with `irrelevant` or `forbidden`. Tag keys, values and role names are compared ignoring case and spaces, and exactly otherwise.

A complete, valid example:

```json
{
  "profileVersion": 1,
  "name": "Layered services",
  "description": "Dependencies go down the layers: ui, service, store. Prepare the diagram with an edge direction set named \"Depends On\" and a \"layer\" tag (ui, service or store) on every entity.",
  "edges": { "meaning": "dependsOn", "presence": "required" },
  "roles": {
    "anyEntity": { "match": { "type": "entity" } },
    "ui": { "match": { "tag": { "key": "layer", "value": "ui" } } },
    "service": { "match": { "tag": { "key": "layer", "value": "service" } } },
    "store": { "match": { "tag": { "key": "layer", "value": "store" } } }
  },
  "rules": [
    { "id": "ui-not-on-store", "kind": "forbiddenEdge", "from": "ui", "to": "store", "message": "The UI goes through a service, not straight to a store." },
    { "id": "store-not-on-upper", "kind": "forbiddenEdge", "from": "store", "to": "service", "message": "A store must not depend on a service." },
    { "id": "service-has-store", "kind": "requiredEdge", "each": "service", "edge": "outgoing", "with": "store", "severity": "warning", "message": "A service with no store is probably missing one." },
    { "id": "entity-has-layer", "kind": "requiredProperty", "each": "anyEntity", "property": { "tag": "layer" }, "severity": "warning", "message": "Set the \"layer\" tag so the element is checked." }
  ]
}
```

**Test it before handing it over.** `chd check` reads the profile first and refuses one that is invalid (exit 2, with each problem named), so run it against any diagram and fix the profile until it gets as far as checking. A profile that finds nothing may simply match no element (a misspelt tag): run it on a diagram you know breaks a rule, or on a copy you break on purpose, and see that the rule fires. Then run it on the real diagram and report what it finds, as above. The complete format is `docs/conformance-profile-format.md` in the project's repository.
