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
  "data": {
    "label": "Web App",
    "icons": { "topRight": { "source": "builtin", "id": "server" } }
  }
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within the file. Referenced by `source`/`target` on edges. |
| `type` | string | no | `"shape"` (a box: resizable, has connection points and icon slots, never rotated) or `"text"` (a text-only annotation: resizable, rotatable, never has connection points or icons). Absent/unrecognized types should be treated as `"shape"` by a lenient reader. |
| `position` | `{x, y}` | yes | Top-left corner, in canvas units (not screen pixels). |
| `size` | `{width, height}` | no | Absent means "let the renderer size it to content" — a reader isn't required to have an opinion on default size. |
| `rotation` | number | no | Degrees. Only meaningful for `"text"` nodes — `"shape"` nodes are never rotated by this app, so a reader can safely ignore rotation on anything else, though there's no harm in a writer omitting it for shapes either. |
| `data.label` | string | yes | Display text. May be empty. |
| `data.icons` | object | no | Only meaningful on `"shape"` nodes. Up to four keys — `topLeft`, `topRight`, `bottomLeft`, `bottomRight` — each an icon reference (see below). |

### Icon reference

Two shapes, distinguished by `source` — see [docs/decisions/0006-icon-storage-model.md](decisions/0006-icon-storage-model.md) for why:

```json
{ "source": "builtin", "id": "server" }
```
A bundled icon, identified by name from [Tabler Icons](https://tabler.io/icons) (MIT-licensed, outline style) — the `id` matches the icon's filename without extension, e.g. `"server"` is `server.svg`. A reader without access to the same bundled set can't render this, but the reference itself is fully portable — it doesn't depend on anything outside the icon set's own stable naming.

```json
{ "source": "custom", "path": "hello-world/assets/logo.svg" }
```
A path to an SVG or PNG file, relative to the diagram file's own directory (not to the diagram file itself) — by convention inside a sibling folder named after the diagram (see the Linking section below). Same graceful-if-missing handling as any other relative-path reference in this format.

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

## Linking and file organization

**Assets** (custom-uploaded icons, `data.icons.*` with `source: "custom"`) are relative-path references pointing into a sibling folder named after the diagram file — e.g. `my-diagram.chd` next to `my-diagram/assets/logo.svg`. That folder is never required or detected by name; the path stored on the node is what actually matters. A diagram with no custom icons has no such folder at all.

**Details** (per-node Markdown content) and **linked diagrams** (drill-down navigation to another `.chd` file) don't exist in the schema yet — noted here so the eventual shape is clear, not because they're usable today. Both will follow the same pattern as custom icons: explicit relative paths stored on the node, resolved at use time, never inferred from a naming convention. Linked diagrams specifically only ever point downward (parent → child) — a child never references its parent — which is what makes any diagram independently openable as its own root. A missing target (a broken link, a diagram shared without its children) is expected to be a recoverable error ("linked diagram not found at `<path>`"), not a hard failure — the diagram containing the broken reference still opens and works.

## Versioning

`version` is currently always `1`. Fields have been added over time (`size`, `rotation`, edge `type`/`label`, `data.icons`) but always additively — a reader from an earlier point in this project's history can still open a newer file and just won't recognize the newer fields. A breaking change to the meaning of an existing field would bump `version`; nothing has required that yet.

## Example

See [`examples/hello-world.chd`](../examples/hello-world.chd) for a minimal real file, and [`examples/README.md`](../examples/README.md) for what else is there.
