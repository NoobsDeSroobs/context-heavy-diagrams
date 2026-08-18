# The `.chd` file format

This is a standalone reference for the diagram file format — everything a third-party tool would need to read or write a compatible file, without needing to read this project's source code or its decision history. If you're looking for *why* the format is shaped this way, see [docs/decisions/0005-diagram-identity-and-linking.md](decisions/0005-diagram-identity-and-linking.md); this document only covers *what it is*, kept current as the format evolves.

## Summary

A `.chd` file is plain JSON (the extension is cosmetic — any text/JSON tool can read or write one). One file is one diagram. There is no required folder structure: a `.chd` file can be renamed or moved freely without breaking anything about itself.

## Top-level structure

```json
{
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [ /* Node objects */ ],
  "edges": [ /* Edge objects */ ]
}
```

| Field | Type | Meaning |
|---|---|---|
| `version` | `1` | Format version. Currently always `1`. See Versioning below. |
| `viewport` | object | Camera position when the file was last saved: `x`, `y` (pan offset in canvas units) and `zoom` (scale factor, `1` = 100%). Purely cosmetic — restores where the view was, has no effect on the diagram's meaning. |
| `nodes` | array of Node | See below. |
| `edges` | array of Edge | See below. |

## Node

```json
{
  "id": "shape-1",
  "type": "shape",
  "position": { "x": -22.5, "y": 25 },
  "size": { "width": 120, "height": 80 },
  "rotation": 0,
  "data": { "label": "Web App" }
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within the file. Referenced by `source`/`target` on edges. |
| `type` | string | no | `"shape"` (a box: resizable, has connection points, never rotated) or `"text"` (a text-only annotation: resizable, rotatable, never has connection points). Absent/unrecognized types should be treated as `"shape"` by a lenient reader. |
| `position` | `{x, y}` | yes | Top-left corner, in canvas units (not screen pixels). |
| `size` | `{width, height}` | no | Absent means "let the renderer size it to content" — a reader isn't required to have an opinion on default size. |
| `rotation` | number | no | Degrees. Only meaningful for `"text"` nodes — `"shape"` nodes are never rotated by this app, so a reader can safely ignore rotation on anything else, though there's no harm in a writer omitting it for shapes either. |
| `data.label` | string | yes | Display text. May be empty. |

## Edge

```json
{
  "id": "xy-edge__shape-2right-shape-1left",
  "type": "labeled",
  "source": "shape-2",
  "target": "shape-1",
  "sourceHandle": "right",
  "targetHandle": "left",
  "label": "reads from"
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within the file. |
| `type` | string | no | Currently only `"labeled"` is meaningful (an edge that can carry a `label`). Absent/unrecognized types should be treated as an unlabeled connector. |
| `source` / `target` | string | yes | Node `id`s this edge connects. |
| `sourceHandle` / `targetHandle` | string | no | Which connection point on the source/target node, when a node has more than one. Current `"shape"` nodes expose `"top"`, `"right"`, `"bottom"`, `"left"`. Absent means "let the renderer pick a reasonable point." |
| `label` | string | no | Text shown on the edge, e.g. describing the relationship. |

## Determinism

Files are written with a fixed key order (matching the tables above) and 2-space indentation, plus a trailing newline. This is deliberate: two saves of an unchanged diagram produce byte-identical output, so git diffs only show real changes. A compatible writer should aim for the same property if it wants clean diffs, though it isn't required for a file to be readable.

## Linking and file organization (planned, not yet implemented)

These fields don't exist in the schema yet — noted here so the eventual shape is clear, not because they're usable today:

- A **linked diagram** will be an explicit relative path stored on a node, pointing to another `.chd` file — resolved at navigation time, not by any naming convention. Links only ever point downward (parent → child); a child never references its parent. A missing target is expected to be a recoverable error ("linked diagram not found at `<path>`"), not a hard failure.
- **Assets** (uploaded icons) and **details** (per-node Markdown content) will also be explicit relative-path references stored on the node, by convention pointing into a sibling folder named after the diagram file (e.g. `my-diagram.chd` next to `my-diagram/assets/`, `my-diagram/details/`) — but that folder is never required or detected by name; the paths stored in the file are what actually matter.

## Versioning

`version` is currently always `1`. Fields have been added over time (`size`, `rotation`, edge `type`/`label`) but always additively — a reader from an earlier point in this project's history can still open a newer file and just won't recognize the newer fields. A breaking change to the meaning of an existing field would bump `version`; nothing has required that yet.

## Example

See [`examples/hello-world.chd`](../examples/hello-world.chd) for a minimal real file, and [`examples/README.md`](../examples/README.md) for what else is there.
