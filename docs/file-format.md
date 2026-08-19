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
  "connectionPoints": [{ "id": "cp-1", "side": "top", "offset": 0.25 }],
  "parentId": "container-1",
  "data": {
    "label": "Web App",
    "icons": { "topRight": { "source": "builtin", "id": "server" } },
    "details": "web-app/details/shape-1.md",
    "linkedDiagram": "web-app/Database.chd"
  }
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within the file. Referenced by `source`/`target` on edges. |
| `type` | string | no | `"shape"` (a box: resizable, has connection points and icon slots, never rotated), `"text"` (a text-only annotation: resizable, rotatable, never has connection points or icons), or `"container"` (a grouping box: resizable, has connection points, never rotated, can be referenced as another node's `parentId`). Absent/unrecognized types should be treated as `"shape"` by a lenient reader. |
| `position` | `{x, y}` | yes | Top-left corner, in canvas units. Relative to the canvas origin normally, but relative to the parent container's own top-left corner when `parentId` is set (not the canvas). |
| `size` | `{width, height}` | no | Absent means "let the renderer size it to content" — a reader isn't required to have an opinion on default size. |
| `rotation` | number | no | Degrees. Only meaningful for `"text"` nodes — `"shape"` and `"container"` nodes are never rotated by this app, so a reader can safely ignore rotation on anything else, though there's no harm in a writer omitting it for them either. |
| `connectionPoints` | array | no | Only meaningful on `"shape"`/`"container"` nodes. *Additional* points beyond the 4 always-present defaults (`"top"`/`"right"`/`"bottom"`/`"left"`, each centered on their side) — absent or empty means just those 4, not zero. Each entry: `id` (string, unique within this node, referenced by edges' `sourceHandle`/`targetHandle`), `side` (`"top"`/`"right"`/`"bottom"`/`"left"`), `offset` (number 0–1, fraction along that side — not a pixel value, so it stays correct across a resize). The 4 defaults are never listed here and can't be removed. |
| `parentId` | string | no | Another node's `id` — this node is a child of that container. Absent means top-level. A parent node must appear earlier in the `nodes` array than its children (React Flow's own requirement — a reader building the same in-memory model needs to preserve this ordering). Nesting containers inside containers is allowed, to any depth. Deleting a container reparents its children (to the container's own `parentId`, or top-level) rather than deleting them. |
| `data.label` | string | yes | Display text. May be empty. |
| `data.icons` | object | no | Only meaningful on `"shape"`/`"container"` nodes. Up to four keys — `topLeft`, `topRight`, `bottomLeft`, `bottomRight` — each an icon reference (see below). |
| `data.details` | string | no | Relative path to a Markdown file with free-form notes about this node (purpose, integration type, inputs/outputs, whatever's useful) — rendered in-app as a side panel, never a second canvas object. Same relative-path-from-the-diagram's-own-directory convention as custom icon paths. Absent means the node has no details yet. |
| `data.linkedDiagram` | string | no | Relative path (from this diagram file's own directory) to another `.chd` file — a drill-down link. Resolved and opened on demand (e.g. Ctrl/Cmd+click in this app), never eagerly. Absent means the node has no link. See the Linking section below for the missing-target and directionality rules. |

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
| `sourceHandle` / `targetHandle` | string | no | Which connection point on the source/target node, when a node has more than one. A `"shape"` or `"container"` node always exposes `"top"`/`"right"`/`"bottom"`/`"left"`, plus whatever `id`s are listed in that node's own `connectionPoints`. Absent means "let the renderer pick a reasonable point." |
| `label` | string | no | Text shown on the edge, e.g. describing the relationship. |

## Determinism

Files are written with a fixed key order (matching the tables above) and 2-space indentation, plus a trailing newline. This is deliberate: two saves of an unchanged diagram produce byte-identical output, so git diffs only show real changes. A compatible writer should aim for the same property if it wants clean diffs, though it isn't required for a file to be readable.

## Linking and file organization

**Assets** (custom-uploaded icons, `data.icons.*` with `source: "custom"`), **details** (`data.details`), and newly-created **linked diagrams** (`data.linkedDiagram`) are all relative-path references. By default this app colocates them into a sibling folder named after the diagram file — e.g. `my-diagram.chd` next to `my-diagram/assets/logo.svg`, `my-diagram/details/shape-1.md`, and `my-diagram/Database.chd` for a newly-created link. That folder is never required or detected by name; the path stored on the node is what actually matters. A diagram with none of these has no such folder at all. This app always names detail files after the node's own `id` (`<node-id>.md`), but a reader shouldn't rely on that — the stored path is authoritative, not the naming pattern. Nothing requires a linked diagram to live inside that sibling folder either — it's just where this app defaults to when *creating* one; linking to an *existing* `.chd` file anywhere on disk (including outside the colocation folder, outside this diagram's own directory tree entirely, or on another drive) is equally valid, since the format has no notion of an enclosing project or repo.

The `.chd` file itself is always plain, deterministic JSON — kept git-friendly on purpose (fixed key order, no inline binaries, see Determinism above). Files under a colocation folder (`assets/*` especially) are ordinary binary/text files with no special handling from this app; if you're versioning a repo full of diagrams with many or large custom icons, [Git LFS](https://git-lfs.com/) tracking `*.svg`/`*.png` under these folders is a reasonable, standard way to keep the repo itself light — this app has no opinion on it either way, since it never touches git directly.

**Linked diagrams** are how drill-down navigation works (e.g. Ctrl/Cmd+click in this app): an explicit relative path stored on the node, resolved at use time, never inferred from a naming convention. Links only ever point downward (parent → child) — a child never references its parent — which is what makes any diagram independently openable as its own root. A missing target (a broken link, a diagram shared without its children) is expected to be a recoverable error ("linked diagram not found at `<path>`"), not a hard failure — the diagram containing the broken reference still opens and works. Detail file references follow the same "missing is recoverable" handling already.

## Versioning

`version` is currently always `1`. Fields have been added over time (`size`, `rotation`, `connectionPoints`, `parentId`, edge `type`/`label`, `data.icons`, `data.details`, `data.linkedDiagram`) but always additively — a reader from an earlier point in this project's history can still open a newer file and just won't recognize the newer fields. A breaking change to the meaning of an existing field would bump `version`; nothing has required that yet.

## Example

See [`examples/hello-world.chd`](../examples/hello-world.chd) for a minimal real file, and [`examples/README.md`](../examples/README.md) for what else is there.
