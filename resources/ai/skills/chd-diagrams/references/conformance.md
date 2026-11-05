# Checking a diagram against a metamodel

A **diagram metamodel** is the complete set of rules one kind of diagram or architecture follows (hexagonal, data-flow diagram, a team's own house rules): which kinds of element exist, what an arrow means, and how they may be combined. A diagram is checked against one metamodel; two are never combined. `chd check` applies a metamodel to a diagram and reports where the diagram breaks the rules. A metamodel is a separate file, never part of the diagram, and a check never changes the diagram.

```bash
chd check path/to/diagram.chd --metamodel hexagonal
chd check path/to/diagram.chd --metamodel rules/house.chdmeta --json
chd check --help        # lists the built-in metamodels
```

A draft can be checked before it is written: `chd check - --metamodel hexagonal` reads the diagram from standard input (the Claude Desktop extension's `check_diagram` takes it as `content`).

`--metamodel` takes a built-in name or the path to a `.chdmeta` file. (Older versions called these a "profile": `--profile`, `.chdprofile.json` and `profileVersion` are still read, and are not written.) Exit code 0: the diagram conforms (warnings and information are listed but do not fail it). 1: a diagram has an error. 2: the command or the metamodel cannot be used (the message says why).

## Read the metamodel before preparing a diagram

Open the metamodel file (built-in ones are in the app's `resources/metamodels/`) and read its `description`: it says exactly what a diagram needs. Two things are always needed:

- **An edge direction set named after what the arrows mean.** A metamodel with `edges.meaning` of `dependsOn` needs a set named `Depends On`; `flowsTo` needs `Flows To` (case and spaces do not matter). In the diagram file that is a top-level `edgeDirectionSets: [{ "id": "...", "name": "Depends On" }]` plus `activeEdgeDirectionSetId` with the same id; with one set the edges' own `source` and `target` are that reading. Without it the check reports `edge-set` and cannot run the rules that need a direction.
- **Roles, as tags.** Metamodels recognise an element by a tag, usually `role`: `"metadata": { "role": { "value": "adapter-in" } }` on the node. Values are compared ignoring case and spaces, and exactly otherwise: `port` is not `support`.

## Reading the result

Each finding names the rule (`id`), a severity and the elements. `error` breaks a rule of the style; `warning` breaks a best practice; `info` is worth knowing. "Not evaluated" lists rules that could not run because the edge set is missing. A finding is a statement about the diagram, not necessarily a mistake in it: **report what the check found and let the person decide.** Do not retag elements, add or remove edges, or move things into containers just to make a check pass, unless that is what they asked for.

## Writing a metamodel

Only when asked. Be clear about what you are making:

- **The person's rules, written down.** Where do the rules come from: a named style (hexagonal, C4), a team standard, an architecture decision? Write what they say. Do not infer rules from the diagram in front of you: a metamodel fitted to a diagram passes it by construction and tells nobody anything.
- **Only what the format can say.** A rule can forbid or require an edge between kinds of element, require an element to be inside or outside a container, require a label or a tag, and cap how many elements a role has. A layer order is one `forbiddenEdge` for each forbidden pair, as in the example below. A style with several kinds of diagram, such as the levels of C4, is one metamodel for each. The format cannot see a dependency cycle (a rule looks at one edge at a time), rules across linked diagrams, exceptions for a deliberate case, or the code a diagram describes. When one of the person's rules cannot be written, say which and leave it out; do not approximate it with a rule that means something else.

A metamodel is a JSON file named `<name>.chdmeta`. Ask the person for the three decisions that are theirs, then write the file:

1. **What does an arrow mean, and must there be any?** `edges.meaning` is `dependsOn` (A depends on B), `flowsTo` (something flows from A to B) or `irrelevant`; `edges.presence` is `required`, `optional` or `forbidden`. There is no default, and `"none"` (as in the app's template) is invalid.
2. **How is each kind of element recognised?** Usually a tag such as `role` or `layer`, sometimes the element's `type` (`entity`, `container`, `text`) or being inside a container of another role. Each kind of element is a named **role**.
3. **Which rules?** Only the ones the person states. Do not invent rules for a style you are guessing at.

Where to save it: next to the diagrams (for example `rules/`), so it is in version control and CI can run it. In the app, a metamodel in the metamodels folder (Preferences) also shows up in the Diagnostics panel. Writing over an existing metamodel follows the same stale-edit rule as a diagram (`chd hash` first). In the Claude Desktop extension, `create_file` and `update_file` write a `.chdmeta` file the same way, refuse one that is not valid, and `check_diagram` tests it.

**Top level:** `metamodelVersion` (always `1`), `name`, `description` (say how a diagram must be prepared: which tags, which edge set), `edges`, `roles` (may be `{}`), `rules` (may be `[]`). An unknown key anywhere is an error.

**A role** is `{ "description"?, "match": { ... } }`. `match` has at least one of (all must hold): `type`, `tag: { "key", "value"? }` (`value` is a string or a list meaning any of them), `insideRole`. Role names are letters, digits, `-` and `_`. An element matching no role is ignored.

**A rule** has `id` (unique), `kind`, optional `severity` (`error` default, `warning`, `info`) and optional `message`. Wherever a rule takes a role, `"*"` means any entity, container or text node.

| `kind` | Fields | Finds |
|---|---|---|
| `forbiddenEdge` | `from`, `to` | an edge from a `from` element to a `to` element |
| `requiredEdge` | `each`, `edge` (`outgoing`, `incoming`, `either`), `with` | an `each` element with no such edge to a `with` element |
| `containment` | `each`, and one of `mustBeInside` / `mustNotBeInside` | an `each` element on the wrong side of a container with that role |
| `requiredProperty` | `each` (a role, or `"@edges"`), `property` (`"label"` or `{ "tag": "key" }`) | an element or edge without it |
| `maxElements` | `of`, `max` (whole number, 1 or more) | the diagram holding more than `max` elements of that role |

`forbiddenEdge` and `requiredEdge` need a direction, so they are not allowed with `irrelevant` or `forbidden`. `edges.presence` of `forbidden` (no edges at all) goes only with `edges.meaning` of `irrelevant`. `containment` takes exactly one of `mustBeInside` and `mustNotBeInside`, and that one names a real role, not `"*"`. Roles may use `insideRole` of each other, but not in a loop; `*` and names starting with `@` are reserved. Tag keys, values and role names are compared ignoring case and spaces, and exactly otherwise.

A complete, valid example:

```json
{
  "metamodelVersion": 1,
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

**Test it before handing it over.** The format is checked for you, not by you: `chd validate rules/house.chdmeta` (the extension's `validate_metamodel`) lists every problem in a metamodel file, `chd check` refuses an invalid one (exit 2, with each problem named), and in the Claude Desktop extension `create_file` and `update_file` do the same on every write. So write the file, read the problems, fix them, and repeat; you do not need to verify the format by hand. Then run it against a diagram. A metamodel that finds nothing may simply match no element (a misspelt tag): run it on a diagram you know breaks a rule, or on a copy you break on purpose, and see that the rule fires. Then run it on the real diagram and report what it finds, as above. (`docs/metamodel-format.md` in the project's repository is the full specification, if you can read it; this page has what you need to write one.)
