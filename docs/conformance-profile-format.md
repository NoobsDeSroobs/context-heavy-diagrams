# Conformance profile format

A **conformance profile** is a plain JSON file that describes the rules of one architectural style, such as hexagonal architecture or a data-flow diagram. A checker applies a profile to a diagram (`.chd`, see [file-format.md](file-format.md)) and lists where the diagram breaks the rules.

This page is the whole specification, written so that anyone can author a profile, or build a checker for one, without reading this project's code. A copy of the file to start from is [`resources/profiles/template.chdprofile.json`](../resources/profiles/template.chdprofile.json); two finished examples sit beside it.

A profile is **applied to** a diagram and is never stored inside one. A profile checks the diagram, not the code the diagram describes: a diagram can conform while the implementation does not.

## File

- UTF-8 JSON. The file name ends in `.chdprofile.json`, for example `hexagonal.chdprofile.json`.
- Every key is spelled exactly as below. **An unknown key is an error**, so that a typo cannot silently disable a rule.
- Names and values that are compared (tag keys, tag values, role names) are compared **exactly but ignoring case**. This is deliberately not the substring matching of the app's search box: `role=port` must not match `support`.

## Top level

```json
{
  "profileVersion": 1,
  "name": "Hexagonal architecture",
  "description": "Dependencies point inward: adapters depend on ports, the domain depends on nothing outside it.",
  "edges": { "meaning": "dependsOn", "presence": "required" },
  "roles": { },
  "rules": [ ]
}
```

| Field | Type | Meaning |
|---|---|---|
| `profileVersion` | `1` | Format version. Currently always `1`. |
| `name` | string | Shown in results. Required, not empty. |
| `description` | string | What the style is and how a diagram must be prepared (which tags to set). Optional but strongly recommended; shown to the person who chooses a profile. |
| `edges` | object | What the arrows mean and whether there must be any. See below. Required. |
| `roles` | object | Named kinds of element, by how to recognise them. Required, may be `{}`. |
| `rules` | array | The checks. Required, may be `[]`. |

## Edges

Every profile states what an arrow means in its style, so that a checker never has to guess. There is **no default**: both fields start as `"none"` in the template, which is **not valid**, and a profile is rejected until its author has chosen a real value.

```json
"edges": { "meaning": "dependsOn", "presence": "required" }
```

| `meaning` | The arrow from A to B says |
|---|---|
| `dependsOn` | A depends on B. |
| `flowsTo` | Something (data, a request, control) flows from A to B. |
| `irrelevant` | Nothing the profile checks depends on the arrow's direction. |

| `presence` | |
|---|---|
| `required` | The diagram must contain at least one edge. |
| `optional` | Edges may be present or absent. |
| `forbidden` | The diagram must contain no edges at all. |

Consistency (a profile that breaks these is invalid):

- `forbidden` requires `irrelevant`.
- `dependsOn` and `flowsTo` cannot be combined with `forbidden`.
- With `irrelevant` or `forbidden`, the rules `forbiddenEdge` and `requiredEdge` are not allowed, because they need a direction. With `forbidden`, a `requiredProperty` rule on `@edges` is not allowed either.

**How a diagram states its arrow meaning.** With `dependsOn` or `flowsTo`, the diagram must have an *edge direction set* (see [Edge direction sets](file-format.md#edge-direction-sets)) whose name matches the meaning once spaces are removed and the text is lower-cased: a set named `Depends On`, `depends on` or `DependsOn` matches `dependsOn`. The rules are then evaluated in that set's orientation (`from` is the end that is the set's `source`). If the diagram has no matching set, or more than one, that is a violation of the profile (`edge-set`), and the rules that need a direction are reported as not evaluated.

## Roles

A role names a kind of element so rules can refer to it. An element may match several roles, or none; an element that matches no role is ignored by the rules, which is how a diagram can contain extra things without breaking a profile. To demand that every element has a role, use a `requiredProperty` rule on the tag the roles are built from.

```json
"roles": {
  "domain":  { "description": "The application core.", "match": { "type": "container", "tag": { "key": "role", "value": "domain" } } },
  "port":    { "match": { "tag": { "key": "role", "value": ["port-in", "port-out"] } } },
  "adapter": { "match": { "tag": { "key": "role", "value": "adapter" } } }
}
```

A role has an optional `description` and a `match`. All the keys of `match` must hold (AND):

| Key | Meaning |
|---|---|
| `type` | `"entity"`, `"container"` or `"text"`. The element's kind. |
| `tag` | `{ "key": "...", "value": ... }`. The element carries a tag with that key. `value` is optional; when given, it is a string, or an array of strings meaning any of them. A tag whose value is a list matches when any member equals. |
| `insideRole` | The name of another role. The element sits, directly or at any depth, inside a container that has that role. |

A `match` has at least one key. Roles may refer to each other with `insideRole`, but not in a cycle. Role names are letters, digits, `-` and `_`; `*` and names starting with `@` are reserved.

Only entities, containers and text nodes have roles. Freeform line nodes are never matched. Edges are reached through the reserved name `@edges`, only in `requiredProperty`.

## Rules

```json
{ "id": "no-adapter-to-adapter", "kind": "forbiddenEdge", "from": "adapter", "to": "adapter",
  "severity": "error", "message": "Adapters must not depend on each other; go through a port." }
```

Every rule has:

| Field | |
|---|---|
| `id` | A short name, unique in the profile; letters, digits, `-`, `_`. Appears in results. |
| `kind` | One of the four kinds below. |
| `severity` | `"error"` or `"warning"`. Optional; `"error"`. |
| `message` | Text shown with each finding. Optional; a checker writes one from the rule. |

Anywhere a rule takes a role, `"*"` means any element.

### `forbiddenEdge`

No edge may go from an element with role `from` to an element with role `to`. One finding per offending edge.

`{ "kind": "forbiddenEdge", "from": "domain", "to": "adapter" }`

### `requiredEdge`

Every element with role `each` must have at least one edge of the given direction to an element with role `with`. `edge` is `"outgoing"`, `"incoming"` or `"either"`. One finding per element that lacks one.

`{ "kind": "requiredEdge", "each": "port", "edge": "incoming", "with": "adapter" }`

### `containment`

Every element with role `each` must be inside (`mustBeInside`) or must not be inside (`mustNotBeInside`) a container with the given role. Give exactly one of the two. One finding per offending element.

`{ "kind": "containment", "each": "domain", "mustBeInside": "hexagon" }`

### `requiredProperty`

Every element with role `each` (or every edge, for `"@edges"`) must have the property. `property` is `"label"` (not blank) or `{ "tag": "key" }` (the tag is present and its value is not blank). One finding per offender.

`{ "kind": "requiredProperty", "each": "@edges", "property": "label" }`

## Results

A checker produces a list of findings and a verdict. A finding has the profile's `name`, the `id` of the rule (or `edge-set` / `edge-presence` for the edge declaration), its severity, a message, and the ids of the nodes or edges concerned. The diagram **conforms** when there is no finding of severity `error`. Warnings are reported but do not fail the check.

If a finding means some rules could not run (the missing edge set), the checker lists those rules as *not evaluated*, so a short result is never read as a pass.

Two checks come from the `edges` declaration, not from `rules`:

- `edge-set` (error): the diagram lacks the edge set the meaning requires, or has two that match.
- `edge-presence` (error): `required` and the diagram has no edge, or `forbidden` and it has some.

## Validation

A checker must reject a profile, with a message naming the problem, when:

- `profileVersion` is not `1`, `name` is missing or blank, or a key is unknown;
- `edges.meaning` or `edges.presence` is missing, `"none"`, or not a listed value, or the consistency rules above are broken;
- a role has no `match` keys, an unknown `type`, an unknown or cyclic `insideRole`, or an invalid name;
- a rule has a duplicate or invalid `id`, an unknown `kind`, a missing field for its kind, or names a role that does not exist;
- a rule's kind is not allowed by `edges` (see above).

A profile that fails validation checks nothing.

## Versioning

`profileVersion` is `1`. A change that old checkers cannot read safely raises it; a checker refuses a profile with a version it does not know.

## Out of scope

This version checks one diagram at a time. Not covered, and not guessed at: rules across linked diagrams, levels (as in C4), layer ordering and cycles, waivers for deliberate exceptions.
