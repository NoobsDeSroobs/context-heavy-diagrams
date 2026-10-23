# The `.chd` file format

This is a standalone reference for the diagram file format — everything a third-party tool would need to read or write a compatible file, without needing to read this project's source code or its decision history. If you're looking for *why* the format is shaped this way, see [docs/decisions/0005-diagram-identity-and-linking.md](decisions/0005-diagram-identity-and-linking.md); this document only covers *what it is*, kept current as the format evolves.

## Summary

A `.chd` file is plain JSON (the extension is cosmetic — any text/JSON tool can read or write one). One file is one diagram. There is no required folder structure: a `.chd` file can be renamed or moved freely without breaking anything about itself.

## Top-level structure

```json
{
  "version": 1,
  "savedWith": "0.2.1",
  "metadata": { "owner": "platform-team" },
  "requiredTags": [
    { "key": "environment", "allowedValues": ["dev", "staging", "prod"], "defaultValue": "dev", "lock": "lockedEditable" }
  ],
  "highlights": [
    { "key": "environment", "value": "prod", "color": "#e6194b" }
  ],
  "legend": [
    { "id": "legend-1", "kind": "line", "label": "Sensitive data transfer", "color": "#e6194b", "lineStyle": "solid", "startMarker": "none", "endMarker": "arrowClosed" }
  ],
  "gravityPresets": [
    { "id": "sharp", "label": "Sharp", "value": 0 },
    { "id": "acute", "label": "Acute", "value": 0.2 },
    { "id": "smooth", "label": "Smooth", "value": 0.5 },
    { "id": "curvy", "label": "Curvy", "value": 1 }
  ],
  "maxConnectionPointsPerSide": 12,
  "fontFamily": "'Georgia', serif",
  "edgeDirectionSets": [
    { "id": "set-1", "name": "Data flow" },
    { "id": "set-2", "name": "Trigger direction" }
  ],
  "activeEdgeDirectionSetId": "set-1",
  "nodes": [ /* Node objects */ ],
  "edges": [ /* Edge objects */ ]
}
```

| Field | Type | Meaning |
|---|---|---|
| `version` | `1` | Format version. Currently always `1`. See Versioning below. |
| `savedWith` | string | The version of the application that last wrote the file, as three numbers (e.g. `"0.2.1"`), so an older application opening it can warn that saving may lose what it does not understand. Written right after `version`. Only ever raised: an application changes it only when its own version is higher than what is recorded, so saving with the same or an older version leaves it alone. Absent means unknown (files written before the field existed, and files an assistant or another tool created); a reader treats absent, unreadable and equal-or-older values as "nothing to warn about". A tool that writes a diagram should leave an existing `savedWith` untouched; a tool that is not this application should not invent one. See Versioning below. |
| `metadata` | object | Diagram-level free-form key/value bag — plain JSON values, no locking concept at this level (that's what `requiredTags` is for). Absent means none set. See [Metadata](#metadata) below for the value shape's general rules (this is the same `JsonValue` type, just not wrapped in a per-entry `MetadataEntry`). |
| `requiredTags` | array of RequiredTagDefinition | The diagram's own template for what every Entity/Container/Edge must carry — see [Required tags](#required-tags) below. Absent means no required tags. |
| `highlights` | array of HighlightDefinition | Saved catalog of tag-based visual highlights — see [Highlights](#highlights) below. Absent means no highlights defined. Note there is no on/off state stored here: this app treats "which highlights are currently enabled" as local, in-memory, per-session state, never written to the file — a reader that only cares about reading the file back doesn't need to reconstruct or care about that. |
| `legend` | array of LegendEntry | Saved catalog of manually-authored legend entries explaining the diagram's own visual conventions — see [Legend](#legend) below. Absent means no legend defined. Like `highlights`, whether the legend panel is currently shown is local, in-memory, per-session state, never written to the file. |
| `gravityPresets` | array of GravityPreset | Named bend values offered on a `"line"` node point's or a catmull-rom-routed Edge point's right-click menu (one shared catalog for both) — see [Gravity presets](#gravity-presets) below. Absent/empty means "use this app's own built-in four" (shown in the example above) — a diagram only needs to define its own once it actually diverges from them. |
| `maxConnectionPointsPerSide` | number | Per-diagram override for the max connection points allowed on one side of a Entity/Container. Absent means "use whoever opens this file's own app-level preference" — a real constraint on what the diagram can contain, not a display setting, so it lives in the file rather than staying app-only. Lowering it below what an existing element already has never removes that element's points; the limit only stops adding more. |
| `fontFamily` | string | The font every label in the diagram is drawn in unless the element sets its own `style.fontFamily`. A raw CSS `font-family` value, like the element field: a stack such as `"'Georgia', serif"` is better than a bare name, because the part after the name is what a computer without that font falls back to. Absent means "use whoever opens this file's own default font", then the application's built-in font. Applies to entity, container, text and edge labels, and to PNG and SVG export. |
| `edgeDirectionSets` | array of EdgeDirectionSet | Named readings of the diagram's edges that differ only in arrow direction — e.g. "Data flow" vs. "Trigger direction". See [Edge direction sets](#edge-direction-sets) below. Absent/empty means the feature is unused. A single set names the current reading, gives it a legend row, and its `style` seeds edges drawn while it is active; two or more can be switched between and add per-edge `directionSets` records. |
| `activeEdgeDirectionSetId` | string | Which entry of `edgeDirectionSets` is currently displayed. With two or more sets the edges on disk are always written in the *first* set's orientation regardless of this value (see [Edge direction sets](#edge-direction-sets)); this only says which reading to show on open. Absent means the first set. |
| `security` | object | Threat/risk model — the threat catalog, which entities are in the security matrix, calculation settings — see [Security](#security) below. Absent means the Security Matrix has never been used for this diagram (and no node has `data.security`). |
| `nodes` | array of Node | See below. |
| `edges` | array of Edge | See below. |

## Node

```json
{
  "id": "entity-1",
  "type": "entity",
  "position": { "x": -22.5, "y": 25 },
  "size": { "width": 120, "height": 80 },
  "rotation": 0,
  "connectionPoints": [{ "id": "cp-1", "side": "top", "offset": 0.25 }],
  "parentId": "container-1",
  "style": { "fill": "#2b6cb0", "stroke": "#1a365d", "strokeWidth": 2 },
  "metadata": {
    "environment": { "value": "prod", "lock": "lockedEditable" },
    "owner": { "value": "platform-team" }
  },
  "data": {
    "label": "Web App",
    "icons": { "topRight": { "source": "builtin", "id": "server" } },
    "details": "web-app/details/Web App-1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d.md",
    "linkedDiagram": "web-app/Database.chd"
  }
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within the file. Referenced by `source`/`target` on edges. |
| `type` | string | no | `"entity"` (a box: resizable, has connection points and icon slots, never rotated), `"text"` (a text-only annotation: resizable, rotatable, never has connection points or icons), `"container"` (a grouping box: resizable, has connection points, never rotated, can be referenced as another node's `parentId`), or `"line"` (a freeform curved line — see `data.points` below; never connectable, never rotated, `position`/`size` are the bounding box of its own points). Absent/unrecognized types should be treated as `"entity"` by a lenient reader. An earlier version also wrote `"anchor"` placeholder nodes; that type was removed and this app no longer supports files containing it (a reader may simply treat such a node as an `"entity"`). Pre-rename files may instead carry `"shape"` — a reader should treat it as a synonym for `"entity"`; this app accepts either on read but only ever writes `"entity"`. |
| `position` | `{x, y}` | yes | Top-left corner, in canvas units. Relative to the canvas origin normally, but relative to the parent container's own top-left corner when `parentId` is set (not the canvas). |
| `size` | `{width, height}` | no | Absent means "let the renderer size it to content" — a reader isn't required to have an opinion on default size. |
| `rotation` | number | no | Degrees. Only meaningful for `"text"` nodes — `"entity"` and `"container"` nodes are never rotated by this app, so a reader can safely ignore rotation on anything else, though there's no harm in a writer omitting it for them either. |
| `zIndex` | integer | no | Stacking order — higher renders on top. Compared directly against every other node's `zIndex` regardless of type; there is no separate "containers always behind" rule enforced by this app beyond it being the typical *starting* arrangement — a node with a higher `zIndex` renders above one with a lower `zIndex` even if the lower one is a `"entity"` and the higher one is a `"container"`. **One exception, enforced by the renderer, not this file:** a node with a `parentId` always draws above its parent regardless of the two stored `zIndex` values (React Flow forces a child's effective z to at least parent + 1). The comparison above is therefore reliable only among *siblings* (nodes at the same nesting level). Absent means this app hasn't assigned one yet (a diagram nothing has ever reordered); a reader can treat an absent value as `0`, or preserve the file's own `nodes` array order among nodes that lack it, either is a reasonable default. An edge never has one — edges derive a display position from their two endpoints' `zIndex` instead of storing their own. |
| `connectionPoints` | array | no | Only meaningful on `"entity"`/`"container"` nodes. Every side always has at least one connection point. If a side has no entries here at all, it implicitly has exactly one: centered (`offset` 0.5), using the side's own name as its `id` (`"top"`/`"right"`/`"bottom"`/`"left"`) — a reader that's never seen this field before can treat those 4 as always-present defaults, same as older versions of this app did. Once a side's points have been edited by this app, that implicit point (and any others on the side) may appear here explicitly, with any `offset`, and behave like any other entry — freely repositionable and removable, with the one rule that a side can never be reduced to zero entries (removing a side's last point isn't a valid edit). Each entry: `id` (string, unique within this node, referenced by edges' `sourceHandle`/`targetHandle` — `"top"`/`"right"`/`"bottom"`/`"left"` are conventional, not reserved: they just happen to be the ids a side's implicit point resolves to, so old files' edges keep working, but they carry no other special meaning once explicit), `side` (`"top"`/`"right"`/`"bottom"`/`"left"`), `offset` (number 0–1, fraction along that side — not a pixel value, so it stays correct across a resize). |
| `parentId` | string | no | Another node's `id` — this node is a child of that container. Absent means top-level. A parent node must appear earlier in the `nodes` array than its children (React Flow's own requirement — a reader building the same in-memory model needs to preserve this ordering). Nesting containers inside containers is allowed, to any depth. Deleting a container reparents its children (to the container's own `parentId`, or top-level) rather than deleting them. On load, this app repairs two corrupt states rather than choke on them: a `parentId` that doesn't resolve to any node in the file is dropped (the node becomes top-level, its `position` numbers kept as-is), and a parent *cycle* (A inside B inside A) has one link cut. A writer isn't required to do this, but shouldn't produce either state. |
| `locked` | boolean | no | Blocks drag/resize/rotate and accidental delete via this app's own UI — not a read-only mode, every other edit (style, tags, label, connection points, details) stays allowed. Absent means unlocked (`false`). Not meaningful on edges (no position of their own to accidentally relocate) — a reader can ignore it there. Locking a container does *not* cascade to its children; each element's lock state is independent. |
| `style` | object | no | Visual overrides — see Node style below. Absent means "use the current hardcoded look." |
| `metadata` | object | no | Only meaningful on `"entity"`/`"container"` nodes — `"text"` never carries this. Key/value entries, each either free (human-added) or diagram-required — see [Metadata](#metadata) below. Absent means none set. |
| `data.label` | string | yes | Display text. May be empty. |
| `data.icons` | object | no | Only meaningful on `"entity"`/`"container"` nodes. Up to four keys — `topLeft`, `topRight`, `bottomLeft`, `bottomRight` — each an icon reference (see below). |
| `data.details` | string | no | Relative path to a Markdown file with free-form notes about this node (purpose, integration type, inputs/outputs, whatever's useful) — rendered in-app as a side panel, never a second canvas object. Same relative-path-from-the-diagram's-own-directory convention as custom icon paths. Absent means the node has no details yet. This app names the file after the node's own `data.label` plus its `id`'s UUID suffix (e.g. `Web App-1a2b3c4d-....md`), for human recognizability in a file listing, and keeps it in sync on relabel — but a reader should treat the whole value as an opaque relative path and never try to parse or reconstruct it; only the path's target content matters. |
| `data.linkedDiagram` | string | no | Relative path (from this diagram file's own directory) to another `.chd` file — a drill-down link. Resolved and opened on demand (e.g. Ctrl/Cmd+click in this app), never eagerly. Absent means the node has no link. See the Linking section below for the missing-target and directionality rules. |
| `data.points` | array of LinePoint | `"line"` only | The line's own shape — see [Line points](#line-points) below. Absent/empty on a `"line"` node means nothing has been drawn yet (this app never actually produces that — a freshly created line always has 2 points). Meaningless on every other node type. |
| `data.references` | array of string | no | Only meaningful on `"entity"`/`"container"` nodes. Ordered list of relative paths (from this diagram file's own directory, same convention as `data.details`) to reference images — screenshots, diagrams, photos kept as working reference material for the concept this node represents. This app keeps them under a sibling `assets/references/` folder and shows them only in transient floating viewer windows; they are **never drawn on the canvas and never included in image exports**. A reader that only renders the diagram can ignore this field entirely. Absent/empty means none. |
| `data.security` | object | `"entity"` only | Threat/risk assessment for this entity — a sparse map keyed by a threat `id` from the top-level [`security`](#security)`.threats` catalog, each value a `RiskCell` (`{ "probability", "consequence", "probabilityNote"?, "consequenceNote"? }`). An entry exists only once that (entity, threat) pair has actually been assessed; a missing cell for a matrix member pair means "not yet assessed". Present only on entities listed in `security.matrixEntityIds`. Absent means this entity isn't in the security matrix. Purely analytical — has no effect on how the entity is drawn. |

### Line points

```json
[
  { "x": 0, "y": 0 },
  { "x": 90, "y": -40, "gravity": 0 },
  { "x": 180, "y": 0 }
]
```

`data.points` on a `"line"` node — an ordered list of points the curve is built from, in node-local coordinates (relative to the node's own `position`, same convention as a container child's `position` being relative to its parent). **Order is the only thing that identifies a point** — there is no separate id, and no other part of the format references an individual point.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `x` / `y` | number | yes | Node-local coordinates. |
| `gravity` | number | no | Per-point Catmull-Rom tension, controlling how much the curve bends at this point. Absent means `0.5` (a smooth pass-through curve — the standard uniform-tension Catmull-Rom default). `0` gives a sharp corner (the curve passes straight through, no bend); higher values bend/bulge more. Only meaningful with 3+ points — a 2-point line always renders as a straight line between them regardless of gravity. |

A reader building the actual curve: for each point `Pi`, compute a tangent — `(P[i+1] - P[i-1]) * gravity_i` for an interior point, `(P[i+1] - P[i]) * gravity_i` for the first point, `(P[i] - P[i-1]) * gravity_i` for the last — then render one cubic bezier per consecutive pair `(Pi, P[i+1])` with control points `Pi + Ti/3` and `P[i+1] - T[i+1]/3`. A reader that doesn't want to implement curve fitting can still render a reasonable approximation by connecting the points with straight segments (a polyline) — every point is still passed through exactly, only the smoothing between them is lost.

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

### Node style

```json
{ "fill": "#2b6cb0", "fillOpacity": 100, "stroke": "#1a365d", "strokeOpacity": 100, "strokeWidth": 2, "textAlign": "center", "fontSize": 13, "fontColor": "#f7fafc", "fontOpacity": 100, "fontWeight": "bold", "fontFamily": "sans-serif" }
```

Every field is optional; an absent field means "use the current hardcoded look," same as the parent `style` object being absent entirely.

| Field | Type | Meaning |
|---|---|---|
| `fill` | string (CSS color) | Body fill. Meaningful for `"entity"`, `"container"`, and `"text"` nodes (all three can have a background), though usually unset on `"text"`. |
| `fillOpacity` | number, 0-100 | Fill opacity — a percentage, not CSS's native 0-1 fraction, so it reads directly as "50%" in a hand-edited file. Absent means 100 (fully opaque). Independent of `strokeOpacity`/`fontOpacity` — this is per-channel, not one whole-element opacity, so the fill can fade without the border or label fading with it. |
| `stroke` | string (CSS color) | Border color. Not meaningful for `"text"` nodes (no border). |
| `strokeOpacity` | number, 0-100 | Border opacity. Same percentage convention as `fillOpacity`. |
| `strokeWidth` | number | Border width in pixels. Not meaningful for `"text"` nodes. |
| `textAlign` | `"start"` \| `"center"` \| `"end"` | Label text alignment. CSS logical values (RTL-correct), not `"left"`/`"right"`. |
| `fontSize` | number | Label font size in pixels. |
| `fontColor` | string (CSS color) | Label text color. |
| `fontOpacity` | number, 0-100 | Label text opacity. Same percentage convention as `fillOpacity`. |
| `fontWeight` | `"normal"` \| `"bold"` | Label font weight. |
| `fontFamily` | string (CSS `font-family` value) | Label font. A raw CSS value, not an enum — this app's own picker currently only offers generic families (`"sans-serif"`, `"serif"`, `"monospace"`, `"cursive"`) since a specific named font isn't reliably available across this app's supported platforms (Windows/Linux), but a reader should treat it as an arbitrary CSS font-family string (a specific font name is valid here too, just not yet offered by this app's own UI). |
| `lineStyle` | `"solid"` \| `"dashed"` \| `"dotted"` | `"line"` nodes only. Same vocabulary as an Edge's own `style.lineStyle` below. |
| `startMarker` / `endMarker` | marker kind | `"line"` nodes only. Same vocabulary as an Edge's own `style.startMarker`/`style.endMarker` below. |

## Edge

```json
{
  "id": "xy-edge__entity-2right-entity-1left",
  "type": "labeled",
  "source": "entity-2",
  "target": "entity-1",
  "sourceHandle": "right",
  "targetHandle": "left",
  "label": "reads from",
  "style": { "stroke": "#1a365d", "lineStyle": "dashed", "startMarker": "none", "endMarker": "arrowOpen" },
  "metadata": { "environment": { "value": "prod", "lock": "lockedStatic" } }
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within the file. |
| `type` | string | no | Currently only `"labeled"` is meaningful (an edge that can carry a `label`). Absent/unrecognized types should be treated as an unlabeled connector per the format's own semantics — but **write it explicitly as `"labeled"` anyway**: this app's own renderer had a real bug (fixed 2026-09-05, see `docs/known-issues.md`) where an edge with an *absent* `type` key could silently fall back to a generic, unstyled connector instead — a build predating that fix will hit it. Costs nothing to include and removes the ambiguity entirely. |
| `source` / `target` | string | yes | Node `id`s this edge connects. |
| `sourceHandle` / `targetHandle` | string | no | Which connection point on the source/target node, when a node has more than one. A `"entity"` or `"container"` node always exposes `"top"`/`"right"`/`"bottom"`/`"left"`, plus whatever `id`s are listed in that node's own `connectionPoints`. Absent means "let the renderer pick a reasonable point." |
| `label` | string | no | Text shown on the edge, e.g. describing the relationship. |
| `style` | object | no | Visual overrides — see Edge style below. Absent means "use the current hardcoded look." |
| `metadata` | object | no | Same shape and rules as a node's `metadata` — see [Metadata](#metadata) below. Absent means none set. |
| `points` | array of LinePoint | no | Manual routing points — see [Edge points](#edge-points) below. Meaningful when `style.routingStyle` is `"catmullRom"` (interior curve control points, `gravity` respected) or `"step"` / `"smoothstep"` (orthogonal waypoints the right-angled path is forced through, `gravity` unused). Ignored for any other routing style (including absent/bezier). Absent/empty means the routing style's own unbent default between the two endpoints. |
| `directionSets` | object | no | Only present when the top-level `edgeDirectionSets` has two or more entries. Maps each set `id` to an `EdgeDirection` — `{ "source", "target", "sourceHandle"?, "targetHandle"? }` — giving this edge's orientation and connection points *in that reading*. The endpoint *nodes* are the same in every set; only which end is `source` and which connection point each end uses may differ. The entry for the first set always matches the edge's own top-level `source`/`target`/handles. See [Edge direction sets](#edge-direction-sets). |

### Edge style

```json
{ "stroke": "#1a365d", "strokeOpacity": 100, "strokeWidth": 2, "lineStyle": "dashed", "startMarker": "none", "endMarker": "arrowOpen", "labelPosition": 0.5, "routingStyle": "catmullRom", "fontSize": 12, "fontColor": "#f7fafc", "fontOpacity": 100, "fontWeight": "normal", "fontFamily": "sans-serif" }
```

Every field is optional, same absent-means-default rule as node style.

| Field | Type | Meaning |
|---|---|---|
| `stroke` | string (CSS color) | Line color. |
| `strokeOpacity` | number, 0-100 | Line (and marker) opacity — see the same field on Node style above. Independent of `fontOpacity` — the label can fade without the line fading with it, or vice versa. Absent means 100 (fully opaque). |
| `strokeWidth` | number | Line width in pixels. |
| `lineStyle` | `"solid"` \| `"dashed"` \| `"dotted"` | Line dash pattern. |
| `startMarker` / `endMarker` | marker kind | Arrowhead/terminator drawn at the source/target end. One of `"none"`, `"arrowOpen"`, `"arrowClosed"`, `"circle"`, `"circleFilled"`, `"diamond"`, `"diamondFilled"`, `"crowsFootOne"`, `"crowsFootMany"`, `"crowsFootOneOrMany"`, `"crowsFootZeroOrOne"`, `"crowsFootZeroOrMany"`. These are deliberately shape-described, not tied to any one notation system (UML/ERD/BPMN) — a reader shouldn't infer semantic meaning from the name beyond what's actually drawn. |
| `labelPosition` | number, 0-1 | Where along the rendered path the label sits, as a fraction of arc length (`0` = source end, `1` = target end) — same fraction-not-pixels convention as a node's `connectionPoints[].offset`, so it stays meaningful if the edge's endpoints move. Absent means `0.5` (the midpoint). |
| `routingStyle` | `"straight"` \| `"step"` \| `"smoothstep"` \| `"catmullRom"` | How the path is routed between the two endpoints. `"straight"` is a direct line. `"step"` / `"smoothstep"` are right-angled (the latter with rounded corners), optionally forced through this edge's own `points` as orthogonal waypoints (see [Edge points](#edge-points) below). `"catmullRom"` is a smooth curve built from the two endpoints plus this edge's own `points`, each leaving its shape perpendicular to whichever side it's attached to. Absent means a plain bezier curve, this format's original and only behavior before this field existed — a reader that doesn't recognize this field, or an unrecognized value, should fall back to that. |
| `fontSize` | number | Label font size in pixels. |
| `fontColor` | string (CSS color) | Label text color. |
| `fontOpacity` | number, 0-100 | Label text opacity — see the same field on Node style above. |
| `fontWeight` | `"normal"` \| `"bold"` | Label font weight. |
| `fontFamily` | string (CSS `font-family` value) | Label font — see the same field on Node style above. |

### Edge points

```json
[
  { "x": 340, "y": 120, "gravity": 0.2 }
]
```

`points` on an Edge — an ordered list of manual routing points, in **absolute canvas coordinates** (the same coordinate space as a top-level node's own `position`, unlike a `"line"` node's own points, which are node-local). **Order is the only thing that identifies a point** — there is no separate id, and no other part of the format references an individual point. The two path endpoints are always the edge's real `source` / `target` (each leaving its shape's side perpendicular); this array supplies only the *interior* points between them.

How the points are used depends on `style.routingStyle`:

- **`"catmullRom"`** — interior control points of a smooth curve. Same shape and curve-fitting formula as a `"line"` node's own points (see [Line points](#line-points) below), `gravity` respected.
- **`"step"` / `"smoothstep"`** — orthogonal waypoints. The right-angled path is forced to pass through each point, with 90° corners synthesised between any two consecutive points (or between a point and an endpoint) that aren't already axis-aligned. `gravity` is not used.
- **any other routing style** — ignored, but preserved on save so switching routing style away and back is lossless.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `x` / `y` | number | yes | Absolute canvas coordinates. |
| `gravity` | number | no | Per-point Catmull-Rom tension (`"catmullRom"` routing only) — see [Line points](#line-points) below for the exact meaning and the curve-fitting formula, identical here. Ignored under other routing styles. |

## Metadata

Free-form, structured key/value data on a Entity/Container node or an Edge — not opaque to interpretation: the app's own highlighting features and external tooling are both meant to read and act on it, not just display it. `"text"` nodes never carry this.

```json
{
  "environment": { "value": "prod", "lock": "lockedEditable" },
  "owner": { "value": "platform-team" }
}
```

Each key maps to an entry, not a bare value:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `value` | JSON value (string, number, boolean, null, array, or object) | yes | The entry's own value. A nested array/object is valid — there's no restriction to flat scalars. |
| `lock` | `"lockedEditable"` \| `"lockedStatic"` | no | Absent means a free entry: added by a human (or any writer), removable, freely editable. `"lockedEditable"` means this key came from the diagram's `requiredTags` template and can't be removed, but a human can still fill in/change its value. `"lockedStatic"` means the same, except the value itself is also fixed — always whatever the template's own `defaultValue` currently is. `lock` is a provenance signal, not an access-control mechanism a reader needs to enforce — nothing stops a writer from changing a locked value directly; this app's own GUI just chooses not to offer that. |

## Required tags

A diagram-level template — `requiredTags` on the top-level object — describing which metadata keys every Entity/Container/Edge in the diagram must carry, and how.

```json
[
  { "key": "environment", "allowedValues": ["dev", "staging", "prod"], "defaultValue": "dev", "lock": "lockedEditable" }
]
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `key` | string | yes | The metadata key this definition governs. |
| `allowedValues` | array of string | no | If set, constrains what a `lockedEditable` entry's value is allowed to be (this app resets an out-of-range value back to `defaultValue` when the diagram is opened or the template is edited — see below). Absent means no constraint; anything is valid. Only meaningful for `lockedEditable` — a `lockedStatic` entry's value is never anything but the template's own, so there's nothing to validate. **JSON `null` is always valid, regardless of `allowedValues`** — every required tag has an implicit "not applicable" value (rendered as "None" in the app) available without being listed in `allowedValues` itself. A reader/writer implementing this reconciliation rule independently must special-case `null` the same way, or a deliberately-`null` entry will get incorrectly treated as out-of-range. |
| `defaultValue` | JSON value | no | The value a freshly-created element gets seeded with, and the value a `lockedStatic` entry always holds. Absent is treated as `null`. **Never validated against `allowedValues`** — a `defaultValue` that isn't itself in `allowedValues` is legal (the app's own UI still shows and preserves it rather than discarding it) and elements reset to it will therefore also be out of range for `allowedValues` until it's changed. |
| `lock` | `"lockedEditable"` \| `"lockedStatic"` | yes | Which of the two locked kinds every element's entry for this key gets — see [Metadata](#metadata) above. Never absent here (an unlocked entry isn't "required" by definition). |

This app applies the template two ways: seeding it onto every newly-created Entity/Container/Edge, and retroactively reconciling every *existing* one whenever the template itself changes (or, defensively, whenever a file is opened, in case of hand-edited drift) — a `lockedEditable` entry keeps its current value if still valid or resets to `defaultValue` if not, a `lockedStatic` entry always takes the template's current value, and a key removed from `requiredTags` demotes any existing entries under that key to free rather than deleting them. A reader that only cares about reading the file back doesn't need to reimplement any of this — `requiredTags` is metadata about the metadata, not something a passive reader has to enforce.

## Highlights

A saved catalog of visual highlights — `highlights` on the top-level object — each one a display color tied to an exact metadata key/value match. This app renders a highlight on a Entity/Container/Edge whenever the element's own [Metadata](#metadata) has that exact key with that exact value, *and* the highlight is currently toggled on in the app's UI — but which highlights are toggled on is never stored in the file (see below).

```json
[
  { "key": "environment", "value": "prod", "color": "#e6194b" }
]
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `key` | string | yes | The metadata key this highlight matches against. |
| `value` | JSON value | yes | The exact value this highlight matches against — compared for equality against a matching element's `metadata[key].value`, not a substring or pattern. |
| `color` | string (CSS color, typically `#rrggbb`) | yes | The highlight's display color. This app renders it as a border/stroke override when an element matches exactly one enabled highlight, or as a small color chip (one per match) when an element matches two or more at once — purely a rendering detail, not something a passive reader needs to reproduce. |

**Enabled/disabled state is deliberately not part of this file.** Only the catalog of *available* highlights is persisted — whether a given highlight happens to be switched on right now is local, in-memory, per-session UI state in this app, reset every time the file is (re)opened. A reader doesn't need to track or reproduce this; it isn't in the file to begin with.

## Legend

A saved catalog of legend entries — `legend` on the top-level object — each one explaining, in the diagram author's own words, what a color/line style/icon means in this specific diagram. Unlike [Highlights](#highlights), entries here are manually authored and not derived from or linked to any other data (metadata, highlights, or otherwise); a legend entry has no matching behavior at all, it exists purely to be displayed.

```json
[
  { "id": "legend-1", "kind": "line", "label": "Sensitive data transfer", "color": "#e6194b", "lineStyle": "solid", "startMarker": "none", "endMarker": "arrowClosed" },
  { "id": "legend-2", "kind": "line", "label": "Planned, not yet built", "color": "#4a5568", "lineStyle": "dashed", "startMarker": "none", "endMarker": "arrowClosed" },
  { "id": "legend-3", "kind": "entity", "label": "GDPR-relevant data", "color": "#e6194b" },
  { "id": "legend-4", "kind": "icon", "label": "Managed database", "icon": { "source": "builtin", "id": "database" } }
]
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within the file. No other significance. |
| `kind` | `"line"` \| `"icon"` \| `"entity"` | yes | Which visual property this entry explains. `"line"` renders a short sample line/arrow; `"icon"` renders the referenced icon as-is; `"entity"` renders a plain colored circle (deliberately a circle, not a box — see [ADR 0033](decisions/0033-diagram-legend-design.md), a box risks implying the meaning only applies to rectangular shapes). Pre-rename files may instead carry `"shape"` — treated as a synonym for `"entity"`; accepted on read, never written. |
| `label` | string | yes | Free-text explanation, shown next to the rendered swatch. |
| `color` | string (CSS color) | no | The swatch's display color. Valid for `"line"` and `"entity"` kinds only. Never set for `"icon"` — this app's icons are fixed multi-color assets, not tintable, so an icon entry's color is meaningless and should be ignored by a reader if present. |
| `lineStyle` | `"solid"` \| `"dashed"` \| `"dotted"` | no | `"line"` kind only. Same vocabulary as an Edge's own `style.lineStyle` — see [Edge](#edge) above. |
| `startMarker` / `endMarker` | MarkerKind | no | `"line"` kind only. Same vocabulary as an Edge's own `style.startMarker`/`style.endMarker`. |
| `icon` | IconRef | no (yes for `"icon"` kind) | `"icon"` kind only. Same shape as a Node's `data.icons.*` entries — see [Node](#node) above. |

**Shown/hidden state is deliberately not part of this file**, same treatment as highlight enablement above — the catalog is shared, whether the legend panel is currently open is local, in-memory, per-session UI state, always starting closed.

## Gravity presets

Named bend values — `gravityPresets` on the top-level object — offered on a `"line"` node point's right-click menu, and on a catmull-rom-routed Edge point's right-click menu too (same catalog, same menu, no separate one). This exists as a diagram-level catalog, not a hardcoded app setting, because a specific diagram's layout may need its own bend values, and reliably reproducing that diagram (for any reader, not just this app) means those named options need to live in the file itself.

```json
[
  { "id": "sharp", "label": "Sharp", "value": 0 },
  { "id": "acute", "label": "Acute", "value": 0.2 }
]
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within the file. No other significance. |
| `label` | string | yes | Shown on the point's right-click menu. |
| `value` | number | yes | The `gravity` a point is set to when this preset is chosen — see [Line points](#line-points) above for what the number itself means. |

**This catalog only affects what a human authoring a line is offered — it doesn't affect how an already-built line renders.** Every point's own `gravity` is already a concrete number (see [Line points](#line-points)), so a reader building the curve never needs to consult this catalog at all; it's purely an authoring convenience, closer in spirit to [Legend](#legend) than to anything that changes rendering. Absent/empty means this app's own built-in four (shown in the example above) — see [Top-level structure](#top-level-structure)'s own example for the exact values.

## Edge direction sets

`edgeDirectionSets` (top-level) lets one diagram carry named *readings* of its edges that differ only in arrow direction — the classic case being a "Data flow" reading and a "Trigger direction" reading, which for a request/response interaction point opposite ways. `activeEdgeDirectionSetId` says which reading to display.

```json
"edgeDirectionSets": [
  { "id": "set-1", "name": "Data flow", "style": { "stroke": "#1a73e8", "endMarker": "arrowClosed" } },
  { "id": "set-2", "name": "Trigger direction", "style": { "stroke": "#e8710a", "lineStyle": "dashed", "endMarker": "arrowClosed" } }
],
"activeEdgeDirectionSetId": "set-2"
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within the file. Referenced by the keys of each edge's `directionSets`. |
| `name` | string | yes | Shown in the set picker, and used as the label of the legend row this reading contributes while it is active. Free-form. |
| `style` | object | no | This reading's **default edge style**. A subset of [Edge style](#edge-style): `stroke` (CSS colour), `strokeWidth`, `strokeOpacity`, `lineStyle` (`"solid"`/`"dashed"`/`"dotted"`), `startMarker`, `endMarker`. It does two things: (1) an edge **drawn while this set is the active one** is born with this style (composed over the app's global default-edge-style), and (2) it is how this reading draws as a legend row (Legend panel + PNG export) while active. It does **not** restyle edges that already exist, and switching the active set never changes an existing edge's appearance — only its direction. Absent `stroke` falls back to a default for the legend swatch. *(Named `legend` before this field was widened; a reader may still encounter the old key — `{ "color", "lineStyle", "startMarker", "endMarker" }` — and should treat `color` as `stroke`.)* |

**A single set is meaningful.** With one set, there is no switching and no per-edge `directionSets` — the set just names the current reading (its `name` + `style` become a legend row, and `style` seeds new edges). Per-edge direction records and the base-orientation rule below apply only once a diagram has **two or more** sets.

**Every edge exists in every set** — a set never adds or removes edges, it only changes their direction. At two or more sets, each edge stores a `directionSets` object (see [Edge](#edge)) mapping every set `id` to an `EdgeDirection`: `{ "source", "target", "sourceHandle"?, "targetHandle"? }`. The two endpoint *nodes* are identical across all sets; only which one is `source` (and which connection point each end lands on) varies.

**Base orientation — what's on disk.** An edge's own top-level `source` / `target` / `sourceHandle` / `targetHandle`, and its direction-sensitive style (`points` order, `startMarker` / `endMarker`, `labelPosition`), are always written in the **first** set's orientation, whatever `activeEdgeDirectionSetId` says. Switching the displayed reading therefore changes only the one `activeEdgeDirectionSetId` line in the file, not every edge — which keeps diffs meaningful. A reader that wants the currently-active reading applies that set's `EdgeDirection` (and mirrors `points` / swaps the two markers / replaces `labelPosition` with `1 - labelPosition` for any edge whose `source` differs from the base) itself.

**Absent / empty `edgeDirectionSets`** means the whole mechanism is dormant: no `directionSets` on any edge, and an edge's direction is simply its own `source`/`target`/handles. A writer emits `edgeDirectionSets` + `activeEdgeDirectionSetId` once there is at least one set, and per-edge `directionSets` only once there are two or more; dropping back below those thresholds removes the corresponding fields again.

This is diagram-level data, not an app preference — reproducing the diagram for any reader means the readings, and which one is shown, have to live in the file.

## Security

`security` (top-level) holds a threat/risk model over the diagram's entities. The per-entity assessments live on each entity's [`data.security`](#node); this block is the shared configuration: the threat catalog, which entities are in the matrix, and the scale definitions.

```json
"security": {
  "threats": [
    { "id": "t-ddos", "name": "DDoS" },
    { "id": "t-phish", "name": "Phishing", "description": "credential theft via a fake login" }
  ],
  "hiddenThreatIds": ["t-phish"],
  "matrixEntityIds": ["entity-2", "entity-7", "entity-9"],
  "hiddenEntityIds": ["entity-9"],
  "probabilityScale": [ { "value": 1, "label": "Rare", "description": "…" } ],
  "consequenceScale": [ { "value": 1, "label": "Negligible", "description": "…" } ]
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `threats` | array of `{ id, name, description? }` | yes | The threat catalog — matrix row candidates. Ordered (row order). `id` is what each entity's `data.security` keys reference; `name` is display-only, so renaming a threat never touches per-entity data. |
| `hiddenThreatIds` | array of string | no | Threat ids currently *hidden* from the matrix — not shown as a row, but still part of the model (their assessments are kept and still count toward completeness). Absent/empty means all threats shown. |
| `matrixEntityIds` | array of string | yes | Ids of `"entity"` nodes that are in the matrix's data model. Ordered (column order). An entity not listed here carries no `data.security` at all. An id that no longer resolves to an entity is dropped on load. Pre-rename files may instead carry this as `matrixShapeIds` — a reader should treat the two as synonyms; this app accepts either on read but only ever writes `matrixEntityIds`. |
| `hiddenEntityIds` | array of string | no | Entity ids in the matrix but currently hidden — not a column, data kept, still counts toward completeness. Absent/empty means all shown. Same pre-rename synonym as `matrixEntityIds`: accepted as `hiddenShapeIds` on read, only ever written as `hiddenEntityIds`. |
| `probabilityScale` / `consequenceScale` | array of `{ value, label, description }` | no | Per-diagram scale definitions. Absent means this app's built-in 1–5 scale. A reader only needs the `value`s to interpret a `RiskCell`; `label`/`description` are for the person filling the matrix in. |

**Calculation modes are not stored here.** How a cell's probability and consequence combine into one score (`multiply` / `add` / `average`), and how a set of cell scores rolls up into a per-threat or per-entity summary (`average` / `sum` / `max`), are **session state in the app that opens the matrix**, not persisted — the same two modes are applied uniformly across a diagram and every diagram it links to, so a per-file mode would be either ignored or inconsistent once a rollup spans files. A file written by an older build may still contain `combineMethod` / `aggregateMethod` keys at this level; a reader ignores them.

**Hide vs. remove.** *Hiding* a threat or entity keeps it in the model — its data is preserved and it still counts toward the matrix's "N of M assessments entered" completeness check — it just isn't rendered. *Removing* a threat deletes it from `threats` and deletes that threat's cell from **every** entity's `data.security`; removing an entity drops it from `matrixEntityIds` and deletes its whole `data.security`. Remove is the destructive, deliberate operation; hide is a view toggle.

**Absent `security`** means the feature is dormant — no entity has `data.security` either. A writer emits this block once it has any threat or any matrix entity, and drops it again if both are empty. Storage is sparse: an un-entered assessment is simply an absent cell, which is what the completeness check reads — nothing is pre-seeded.

## Determinism

Files are written with a fixed key order (matching the tables above) and 2-space indentation, plus a trailing newline. This is deliberate: two saves of an unchanged diagram produce byte-identical output, so git diffs only show real changes. A compatible writer should aim for the same property if it wants clean diffs, though it isn't required for a file to be readable.

## Linking and file organization

**Assets** (custom-uploaded icons, `data.icons.*` with `source: "custom"`), **reference images** (`data.references`), **details** (`data.details`), and newly-created **linked diagrams** (`data.linkedDiagram`) are all relative-path references. By default this app colocates them into a sibling folder named after the diagram file — e.g. `my-diagram.chd` next to `my-diagram/assets/logo.svg`, `my-diagram/assets/references/screenshot.png`, `my-diagram/details/Web App-1a2b3c4d-....md`, and `my-diagram/Database.chd` for a newly-created link. That folder is never required or detected by name; the path stored on the node is what actually matters. A diagram with none of these has no such folder at all. Stored paths use forward slashes as the separator (this app writes them that way regardless of host OS); a reader on any platform should also accept a backslash-separated path in a hand-edited or older file, and a writer should emit forward slashes for portability. This app names a detail file after the element's own label followed by its node id's UUID (`<label>-<uuid>.md`, and a multi-line label contributes only its first line), and a newly-created linked diagram after the node's label (`<label>.chd`) — but a reader shouldn't rely on either pattern; the stored path is authoritative, not the naming. Nothing requires a linked diagram to live inside that sibling folder either — it's just where this app defaults to when *creating* one; linking to an *existing* `.chd` file anywhere on disk (including outside the colocation folder, outside this diagram's own directory tree entirely, or on another drive) is equally valid, since the format has no notion of an enclosing project or repo.

The `.chd` file itself is always plain, deterministic JSON — kept git-friendly on purpose (fixed key order, no inline binaries, see Determinism above). Files under a colocation folder (`assets/*` especially) are ordinary binary/text files with no special handling from this app; if you're versioning a repo full of diagrams with many or large custom icons, [Git LFS](https://git-lfs.com/) tracking `*.svg`/`*.png` under these folders is a reasonable, standard way to keep the repo itself light — this app has no opinion on it either way, since it never touches git directly.

**Linked diagrams** are how drill-down navigation works (e.g. Ctrl/Cmd+click in this app): an explicit relative path stored on the node, resolved at use time, never inferred from a naming convention. Links only ever point downward (parent → child) — a child never references its parent — which is what makes any diagram independently openable as its own root. A missing target (a broken link, a diagram shared without its children) is expected to be a recoverable error ("linked diagram not found at `<path>`"), not a hard failure — the diagram containing the broken reference still opens and works. Detail file references follow the same "missing is recoverable" handling already.

## Versioning

`version` is currently always `1`. Two things carry compatibility information: this format `version` (bumped only for a breaking change) and the `savedWith` application version (see below).

**`savedWith` and the newer-file warning ([ADR 0118](decisions/0118-saved-with-version-marker.md)).** Additive fields mean an older application can open a newer file and silently drop the fields it does not know when it saves. So the application records the version that last wrote the file, and warns when it opens a file whose `savedWith` is **newer than itself**. The comparison uses the whole version (major, minor and patch): a later patch release can change what a file contains just as a later minor can, so there is no "only minor matters" shortcut. Equal, older, absent and unreadable markers never warn. The warning is advisory only; nothing is blocked. A pre-release or build suffix (`1.0.0-beta.2`) is ignored when comparing.

Everything below this point is about the format `version`.

`version` is currently always `1`. Fields have been added over time (`size`, `rotation`, `connectionPoints`, `parentId`, `style` on both Node and Edge, edge `type`/`label`, `data.icons`, `data.details`, `data.linkedDiagram`, top-level `metadata`/`requiredTags`/`highlights`/`legend`, `metadata` on both Node and Edge, Edge style's `labelPosition`, Node's `zIndex`, Node's `locked`, the `"line"` node `type` with its `data.points`, Node style's `lineStyle`/`startMarker`/`endMarker`, top-level `gravityPresets`, Edge style's `routingStyle` with its own `points`, top-level `maxConnectionPointsPerSide`, `data.references`, top-level `edgeDirectionSets` / `activeEdgeDirectionSetId` with each edge's `directionSets`, and top-level `security` with each entity's `data.security`) but always additively — a reader from an earlier point in this project's history can still open a newer file and just won't recognize the newer fields. The same holds in reverse: this app's own current code must still open a file from *before* one of these fields existed, without failing or requiring migration — see [ADR 0029](decisions/0029-backward-compatible-loading-is-a-standing-rule.md), which makes this a standing rule for every future field, not just an incidental property of the fields added so far. A breaking change to the meaning of an existing field would bump `version`; nothing has required that yet.

**One value/field rename, same standing rule applied:** the node `type` value `"shape"`, a legend entry's `kind` value `"shape"`, and `DiagramSecurity`'s `matrixShapeIds`/`hiddenShapeIds` field names were all renamed to `"entity"`/`matrixEntityIds`/`hiddenEntityIds` (see [ADR 0101](decisions/0101-shape-to-entity-rename.md)). Not a `version` bump — the old names are accepted as synonyms on read (never written), the same additive spirit as every field above.

## Example

See [`examples/hello-world.chd`](../examples/hello-world.chd) for a minimal real file, [`examples/with-metadata.chd`](../examples/with-metadata.chd) for a `requiredTags` template plus a required and a free tag on a node, and [`examples/README.md`](../examples/README.md) for what else is there.
