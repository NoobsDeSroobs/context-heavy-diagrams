# .chd field reference

Complete field-by-field reference. Read the relevant section rather than the whole file when you just need one field's exact name/type/meaning.

## Table of contents

1. [Top-level object](#top-level-object)
2. [Node](#node)
3. [Line points (`data.points` on a `"line"` node)](#line-points)
4. [Icon reference](#icon-reference)
5. [Node style](#node-style)
6. [Edge](#edge)
7. [Edge style](#edge-style)
8. [Edge points](#edge-points)
9. [Metadata](#metadata)
10. [Required tags](#required-tags)
11. [Highlights](#highlights)
12. [Legend](#legend)
13. [Gravity presets](#gravity-presets)
14. [Edge direction sets](#edge-direction-sets)
15. [Security](#security)
16. [Determinism & versioning](#determinism--versioning)

---

## Top-level object

```json
{
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "metadata": { "owner": "platform-team" },
  "requiredTags": [ { "key": "environment", "allowedValues": ["dev", "staging", "prod"], "defaultValue": "dev", "lock": "lockedEditable" } ],
  "highlights": [ { "key": "environment", "value": "prod", "color": "#e6194b" } ],
  "legend": [ { "id": "legend-1", "kind": "line", "label": "Sensitive data transfer", "color": "#e6194b", "lineStyle": "solid", "startMarker": "none", "endMarker": "arrowClosed" } ],
  "gravityPresets": [ { "id": "sharp", "label": "Sharp", "value": 0 }, { "id": "acute", "label": "Acute", "value": 0.2 }, { "id": "smooth", "label": "Smooth", "value": 0.5 }, { "id": "curvy", "label": "Curvy", "value": 1 } ],
  "maxConnectionPointsPerSide": 12,
  "edgeDirectionSets": [ { "id": "set-1", "name": "Data flow" }, { "id": "set-2", "name": "Trigger direction" } ],
  "activeEdgeDirectionSetId": "set-1",
  "nodes": [ /* Node objects */ ],
  "edges": [ /* Edge objects */ ]
}
```

| Field | Type | Meaning |
|---|---|---|
| `version` | `1` | Format version. Currently always `1`. |
| `viewport` | object | Camera position when last saved: `x`, `y` (pan offset) and `zoom` (scale, `1` = 100%). Purely cosmetic. |
| `metadata` | object | Diagram-level free-form key/value bag (plain JSON values, no locking at this level — that's `requiredTags`). Absent means none set. Same `JsonValue` shape as a metadata entry's `value`, just not wrapped in `{value, lock}`. |
| `requiredTags` | array of RequiredTagDefinition | Template for what every Shape/Container/Edge must carry — see [Required tags](#required-tags). Absent means none. |
| `highlights` | array of HighlightDefinition | Catalog of tag-based visual highlights — see [Highlights](#highlights). Absent means none. Enabled/disabled state is never stored here. |
| `legend` | array of LegendEntry | Catalog of manually-authored legend entries — see [Legend](#legend). Absent means none. Shown/hidden state is never stored here. |
| `gravityPresets` | array of GravityPreset | Named bend values for line-node/catmull-rom-edge points — see [Gravity presets](#gravity-presets). Absent/empty means the built-in four shown above. |
| `maxConnectionPointsPerSide` | number | Per-diagram cap on connection points per side. Absent means "use the opening app's own preference." Lowering it never removes existing points, only stops adding more. |
| `edgeDirectionSets` | array of EdgeDirectionSet | Named readings of edge direction — see [Edge direction sets](#edge-direction-sets). Absent/empty means unused. |
| `activeEdgeDirectionSetId` | string | Which `edgeDirectionSets` entry is currently displayed. Absent means the first set. Edges on disk are always written in the *first* set's orientation regardless of this value once there are 2+ sets. |
| `security` | object | Threat/risk model — see [Security](#security). Absent means unused (no node has `data.security` either). |
| `nodes` | array of Node | See [Node](#node). |
| `edges` | array of Edge | See [Edge](#edge). |

---

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
| `type` | string | no | `"shape"` (box: resizable, connection points, icon slots, never rotated), `"text"` (text-only, resizable, rotatable, never connection points/icons), `"container"` (grouping box: resizable, connection points, never rotated, can be a `parentId`), or `"line"` (freeform curve — see [Line points](#line-points); never connectable, never rotated, `position`/`size` are the bounding box). Absent/unrecognized → treat as `"shape"`. The removed `"anchor"` placeholder type is no longer supported by the app; never write it. |
| `position` | `{x, y}` | yes | Top-left corner, canvas units. Relative to canvas origin normally, but relative to the **parent container's own top-left** when `parentId` is set. |
| `size` | `{width, height}` | no | Absent means "let the renderer size to content." |
| `rotation` | number | no | Degrees. Only meaningful for `"text"` — `"shape"`/`"container"` are never rotated. |
| `zIndex` | integer | no | Stacking order, higher on top. Compared directly across all nodes regardless of type — no automatic "containers behind" rule beyond it being the typical starting arrangement. **Exception enforced by the renderer, not the file**: a node with `parentId` always draws above its parent regardless of stored `zIndex` (React Flow forces child z ≥ parent + 1) — so the comparison is only reliable among *siblings*. Absent → treat as `0` or preserve array order. Edges/anchors never have one; edges derive display position from their endpoints. |
| `connectionPoints` | array | no | Only meaningful on `"shape"`/`"container"`. Every side always has ≥1 point. No entries for a side → implicit single centered point (`offset` 0.5, `id` = side name `"top"`/`"right"`/`"bottom"`/`"left"`). Once edited, may appear explicitly with any `offset`; a side can never be reduced to zero entries. Entry: `id` (string, unique in node, referenced by edge `sourceHandle`/`targetHandle`), `side` (`"top"`\|`"right"`\|`"bottom"`\|`"left"`), `offset` (0–1 fraction along the side, not pixels — stays correct across resize). |
| `parentId` | string | no | Another node's `id` — this node is its child. Absent = top-level. **Parent must appear earlier in the `nodes` array than its children.** Nesting to any depth is allowed. Deleting a container reparents children rather than deleting them. A reader should repair (not choke on) a `parentId` that doesn't resolve (drop it, node becomes top-level) or a parent cycle (cut one link) — a writer shouldn't produce either. |
| `locked` | boolean | no | Blocks drag/resize/rotate/accidental-delete in the app's UI only — every other edit (style, tags, label, connection points, details) stays allowed. Absent = `false`. Not meaningful on edges. Locking a container does not cascade to children. |
| `style` | object | no | See [Node style](#node-style). Absent = current hardcoded look. |
| `metadata` | object | no | Only on `"shape"`/`"container"` — never on `"text"`. See [Metadata](#metadata). |
| `data.label` | string | yes | Display text. May be empty. |
| `data.icons` | object | no | Only on `"shape"`/`"container"`. Up to 4 keys: `topLeft`, `topRight`, `bottomLeft`, `bottomRight` — each an [icon reference](#icon-reference). |
| `data.details` | string | no | Relative path (from **this diagram file's own directory**) to a Markdown notes file, shown as a side panel. This app names it `<label>-<uuid-suffix>.md` and keeps it in sync on relabel, but treat the stored value as an opaque path — never parse/reconstruct it. |
| `data.linkedDiagram` | string | no | Relative path (from **this diagram file's own directory**) to another `.chd` file — a drill-down link, resolved on demand, never eagerly. See [authoring-guide.md](authoring-guide.md) for directionality/missing-target rules. |
| `data.points` | array of LinePoint | `"line"` only | See [Line points](#line-points). Meaningless on other types. |
| `data.references` | array of string | no | Only on `"shape"`/`"container"`. Ordered relative paths (same convention as `data.details`) to reference images, conventionally under a sibling `assets/references/` folder. Shown only in floating viewers — **never drawn on canvas, never in image exports.** A rendering-only reader can ignore this field. |
| `data.security` | object | `"shape"` only | Sparse map keyed by threat `id` (from top-level `security.threats`) → `RiskCell` (`{probability, consequence, probabilityNote?, consequenceNote?}`). Present only on shapes listed in `security.matrixShapeIds`; a missing cell = "not yet assessed." Purely analytical, doesn't affect rendering. See [Security](#security). |

### Line points

```json
[
  { "x": 0, "y": 0 },
  { "x": 90, "y": -40, "gravity": 0 },
  { "x": 180, "y": 0 }
]
```

`data.points` on a `"line"` node — ordered, **node-local coordinates** (relative to the node's own `position`, same convention as a container child's `position`). **Order is the only identity a point has** — no id, nothing else references an individual point.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `x` / `y` | number | yes | Node-local coordinates. |
| `gravity` | number | no | Per-point Catmull-Rom tension. Absent = `0.5` (smooth pass-through). `0` = sharp corner. Higher = more bend/bulge. Only meaningful with 3+ points — a 2-point line is always a straight segment regardless of gravity. |

**Curve-fitting formula** (for building the actual bezier path, and identical for [edge points](#edge-points) under `"catmullRom"` routing): for each point `Pi`, compute a tangent — `(P[i+1] - P[i-1]) * gravity_i` for an interior point, `(P[i+1] - P[i]) * gravity_i` for the first point, `(P[i] - P[i-1]) * gravity_i` for the last — then render one cubic bezier per consecutive pair `(Pi, P[i+1])` with control points `Pi + Ti/3` and `P[i+1] - T[i+1]/3`. Without curve-fitting, connecting points with straight segments (a polyline) is a reasonable fallback — every point still passes through exactly, only the smoothing is lost.

---

## Icon reference

```json
{ "source": "builtin", "id": "server" }
```
Bundled icon from [Tabler Icons](https://tabler.io/icons) (MIT, outline style) — `id` matches the filename minus extension (`"server"` → `server.svg`). Fully portable reference even without the icon set available to render it.

```json
{ "source": "custom", "path": "hello-world/assets/logo.svg" }
```
SVG or PNG, **relative to the diagram file's own directory** (not to the diagram file itself) — by convention inside a sibling folder named after the diagram. Same graceful-if-missing handling as any relative-path reference in this format.

---

## Node style

```json
{ "fill": "#2b6cb0", "fillOpacity": 100, "stroke": "#1a365d", "strokeOpacity": 100, "strokeWidth": 2, "textAlign": "center", "fontSize": 13, "fontColor": "#f7fafc", "fontOpacity": 100, "fontWeight": "bold", "fontFamily": "sans-serif" }
```

Every field optional; absent = current hardcoded look, same as `style` being absent entirely.

| Field | Type | Meaning |
|---|---|---|
| `fill` | CSS color | Body fill. `"shape"`, `"container"`, `"text"` (usually unset on text). |
| `fillOpacity` | 0–100 | Percentage, not 0-1 fraction. Absent = 100. Independent per-channel from `strokeOpacity`/`fontOpacity`. |
| `stroke` | CSS color | Border color. Not meaningful for `"text"`. |
| `strokeOpacity` | 0–100 | Same percentage convention. |
| `strokeWidth` | number | Border width, px. Not meaningful for `"text"`. |
| `textAlign` | `"start"` \| `"center"` \| `"end"` | CSS logical values (RTL-correct), not left/right. |
| `fontSize` | number | Label font size, px. |
| `fontColor` | CSS color | Label text color. |
| `fontOpacity` | 0–100 | Same percentage convention. |
| `fontWeight` | `"normal"` \| `"bold"` | Label weight. |
| `fontFamily` | CSS `font-family` string | Not an enum — arbitrary CSS value valid even though this app's own picker only offers generic families. |
| `lineStyle` | `"solid"` \| `"dashed"` \| `"dotted"` | `"line"` nodes only. Same vocabulary as Edge style. |
| `startMarker` / `endMarker` | marker kind | `"line"` nodes only. Same vocabulary as Edge style. |

---

## Edge

```json
{
  "id": "xy-edge__shape-2right-shape-1left",
  "type": "labeled",
  "source": "shape-2",
  "target": "shape-1",
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
| `type` | string | no | Only `"labeled"` is currently meaningful (carries a `label`). Absent/unrecognized → treat as an unlabeled connector per the format's own semantics. **Always write it explicitly as `"labeled"` anyway when authoring a new edge** — this app had a real bug (fixed 2026-09-05) where an edge with a genuinely-absent `type` could silently render via a generic fallback with no styling, no highlight support, and no custom routing, on a build that predates the fix. Costs nothing, removes the risk entirely. |
| `source` / `target` | string | yes | Node `id`s this edge connects. |
| `sourceHandle` / `targetHandle` | string | no | Which connection point when a node has more than one. `"shape"`/`"container"` always expose `"top"`/`"right"`/`"bottom"`/`"left"` plus any custom `connectionPoints` ids. Absent = "renderer picks." |
| `label` | string | no | Text shown on the edge. |
| `style` | object | no | See [Edge style](#edge-style). |
| `metadata` | object | no | Same shape/rules as Node metadata — see [Metadata](#metadata). |
| `points` | array of LinePoint | no | Manual routing — see [Edge points](#edge-points). Meaningful for `"catmullRom"` (interior control points, `gravity` respected) or `"step"`/`"smoothstep"` (orthogonal waypoints, `gravity` unused). Ignored (but preserved) for other routing styles. |
| `directionSets` | object | no | Only present when top-level `edgeDirectionSets` has 2+ entries. Maps each set `id` → `EdgeDirection` (`{source, target, sourceHandle?, targetHandle?}`). See [Edge direction sets](#edge-direction-sets). |

### Edge style

```json
{ "stroke": "#1a365d", "strokeOpacity": 100, "strokeWidth": 2, "lineStyle": "dashed", "startMarker": "none", "endMarker": "arrowOpen", "labelPosition": 0.5, "routingStyle": "catmullRom", "fontSize": 12, "fontColor": "#f7fafc", "fontOpacity": 100, "fontWeight": "normal", "fontFamily": "sans-serif" }
```

| Field | Type | Meaning |
|---|---|---|
| `stroke` | CSS color | Line color. |
| `strokeOpacity` | 0–100 | Line + marker opacity. Absent = 100. Independent from `fontOpacity`. |
| `strokeWidth` | number | Line width, px. |
| `lineStyle` | `"solid"` \| `"dashed"` \| `"dotted"` | Dash pattern. |
| `startMarker` / `endMarker` | marker kind | One of `"none"`, `"arrowOpen"`, `"arrowClosed"`, `"circle"`, `"circleFilled"`, `"diamond"`, `"diamondFilled"`, `"crowsFootOne"`, `"crowsFootMany"`, `"crowsFootOneOrMany"`, `"crowsFootZeroOrOne"`, `"crowsFootZeroOrMany"`. Shape-described, not tied to UML/ERD/BPMN semantics — don't infer meaning beyond what's drawn. |
| `labelPosition` | 0–1 | Fraction of arc length from source (`0`) to target (`1`). Absent = `0.5`. |
| `routingStyle` | `"straight"` \| `"step"` \| `"smoothstep"` \| `"catmullRom"` | `"straight"` = direct line. `"step"`/`"smoothstep"` = right-angled (rounded corners for the latter), optionally through `points` as orthogonal waypoints. `"catmullRom"` = smooth curve through the two endpoints plus `points`, each leaving perpendicular to its shape's side. Absent = plain bezier (the format's original/default behavior) — unrecognized values also fall back to this. |
| `fontSize` / `fontColor` / `fontOpacity` / `fontWeight` / `fontFamily` | — | Label text styling, same conventions as [Node style](#node-style). |

### Edge points

```json
[ { "x": 340, "y": 120, "gravity": 0.2 } ]
```

`points` on an Edge — ordered, **absolute canvas coordinates** (same space as a top-level node's `position` — unlike a `"line"` node's points, which are node-local). **Order is the only identity a point has.** The two path endpoints are always the edge's real `source`/`target` (each leaving perpendicular to its side); this array supplies only *interior* points.

| `routingStyle` | How `points` is used |
|---|---|
| `"catmullRom"` | Interior control points of a smooth curve. Same shape/formula as [Line points](#line-points), `gravity` respected. |
| `"step"` / `"smoothstep"` | Orthogonal waypoints — path is forced through each point, with 90° corners synthesized between non-axis-aligned consecutive points. `gravity` unused. |
| anything else | Ignored, but preserved on save (lossless round-trip through a routing-style change). |

| Field | Type | Required | Meaning |
|---|---|---|---|
| `x` / `y` | number | yes | Absolute canvas coordinates. |
| `gravity` | number | no | Catmull-Rom tension (`"catmullRom"` only) — same meaning as [Line points](#line-points). Ignored otherwise. |

---

## Metadata

Structured key/value data on a Shape/Container node or an Edge — meant to be *read and acted on* (by this app's highlighting, and by external tooling), not just displayed. `"text"` never carries this.

```json
{
  "environment": { "value": "prod", "lock": "lockedEditable" },
  "owner": { "value": "platform-team" }
}
```

Each key maps to an entry, not a bare value:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `value` | JSON value (string/number/boolean/null/array/object) | yes | The entry's value — nested structures are valid, not restricted to flat scalars. |
| `lock` | `"lockedEditable"` \| `"lockedStatic"` | no | Absent = free entry (any writer added it, removable, freely editable). `"lockedEditable"` = came from `requiredTags`, can't be removed, value still human-editable. `"lockedStatic"` = same, but value is also fixed — always the template's current `defaultValue`. **This is a provenance signal, not access control** — nothing stops a writer from changing a locked value directly; it's just what the GUI chooses not to offer. |

---

## Required tags

Diagram-level template — top-level `requiredTags` — describing which metadata keys every Shape/Container/Edge must carry.

```json
[ { "key": "environment", "allowedValues": ["dev", "staging", "prod"], "defaultValue": "dev", "lock": "lockedEditable" } ]
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `key` | string | yes | The metadata key this definition governs. |
| `allowedValues` | array of string | no | Constrains a `lockedEditable` entry's value (out-of-range gets reset to `defaultValue` on open/template-edit). Absent = unconstrained. **JSON `null` is always valid regardless of `allowedValues`** — an implicit "not applicable" value, shown as "None" in the app, without needing to be listed. Not meaningful for `lockedStatic` (value is never anything but the template's own). |
| `defaultValue` | JSON value | no | Seed value for new elements, and the permanent value for `lockedStatic` entries. Absent = `null`. **Never validated against `allowedValues`** — legal even if out of range; elements reset to it stay out of range too until changed. |
| `lock` | `"lockedEditable"` \| `"lockedStatic"` | yes | Which locked kind every element's entry gets. Never absent (an unlocked entry isn't "required"). |

Reconciliation (seeding new elements, resetting existing ones when the template changes or the file is opened) is this app's job, not a passive reader's — `requiredTags` is metadata about the metadata.

---

## Highlights

Top-level `highlights` — a saved catalog of display colors tied to an exact metadata key/value match. Rendered on an element whenever its metadata has that exact key+value **and** the highlight is toggled on in the UI (toggle state is never in the file).

```json
[ { "key": "environment", "value": "prod", "color": "#e6194b" } ]
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `key` | string | yes | Metadata key to match. |
| `value` | JSON value | yes | Exact-equality match against `metadata[key].value` — not substring/pattern. |
| `color` | CSS color | yes | Border/stroke override on a single match; a small chip per match when 2+ highlights match at once (rendering detail). |

Enabled/disabled state is deliberately **not** in the file — only the available catalog persists.

---

## Legend

Top-level `legend` — manually-authored entries explaining the diagram's own visual conventions in the author's words. Unlike Highlights, entries have **no matching behavior** — purely for display, not derived from metadata.

```json
[
  { "id": "legend-1", "kind": "line", "label": "Sensitive data transfer", "color": "#e6194b", "lineStyle": "solid", "startMarker": "none", "endMarker": "arrowClosed" },
  { "id": "legend-3", "kind": "shape", "label": "GDPR-relevant data", "color": "#e6194b" },
  { "id": "legend-4", "kind": "icon", "label": "Managed database", "icon": { "source": "builtin", "id": "database" } }
]
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within the file, no other significance. |
| `kind` | `"line"` \| `"icon"` \| `"shape"` | yes | `"line"` renders a sample line/arrow; `"icon"` renders the icon as-is; `"shape"` renders a plain colored **circle** (deliberately not a box — implying the meaning isn't limited to rectangular shapes). |
| `label` | string | yes | Free-text explanation. |
| `color` | CSS color | no | `"line"`/`"shape"` only — never set for `"icon"` (icons are fixed multi-color assets, not tintable; ignore if present). |
| `lineStyle` | `"solid"` \| `"dashed"` \| `"dotted"` | no | `"line"` kind only. |
| `startMarker` / `endMarker` | marker kind | no | `"line"` kind only. |
| `icon` | IconRef | conditionally | Required for `"icon"` kind — same shape as `data.icons.*` (see [Icon reference](#icon-reference)). |

Shown/hidden state, same as Highlights, is never in the file.

---

## Gravity presets

Top-level `gravityPresets` — named bend values offered on a line-node point's or catmull-rom edge point's right-click menu (one shared catalog for both).

```json
[ { "id": "sharp", "label": "Sharp", "value": 0 }, { "id": "acute", "label": "Acute", "value": 0.2 } ]
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within file, no other significance. |
| `label` | string | yes | Shown on the right-click menu. |
| `value` | number | yes | The `gravity` value applied when chosen — see [Line points](#line-points). |

**Purely an authoring convenience** — every point's `gravity` is already a concrete number once set, so a reader building/rendering a curve never needs this catalog at all. Absent/empty = this app's built-in four (Sharp `0`, Acute `0.2`, Smooth `0.5`, Curvy `1`).

---

## Edge direction sets

Top-level `edgeDirectionSets` — named *readings* of a diagram's edges differing only in arrow direction (e.g. "Data flow" vs. "Trigger direction," which point opposite ways for a request/response pair). `activeEdgeDirectionSetId` says which is displayed.

```json
"edgeDirectionSets": [
  { "id": "set-1", "name": "Data flow", "style": { "stroke": "#1a73e8", "endMarker": "arrowClosed" } },
  { "id": "set-2", "name": "Trigger direction", "style": { "stroke": "#e8710a", "lineStyle": "dashed", "endMarker": "arrowClosed" } }
],
"activeEdgeDirectionSetId": "set-2"
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within file. Referenced by keys of each edge's `directionSets`. |
| `name` | string | yes | Shown in the set picker and as this reading's legend-row label while active. |
| `style` | object | no | Subset of [Edge style](#edge-style): `stroke`, `strokeWidth`, `strokeOpacity`, `lineStyle`, `startMarker`, `endMarker`. Does two things: (1) an edge **drawn while this set is active** is born with this style, composed over the app's global default; (2) it's how this reading draws as a legend row while active. **Never restyles existing edges** and switching active sets never changes appearance, only direction. *(Was named `legend` before this field widened; a reader may meet the old key `{color, lineStyle, startMarker, endMarker}` — treat `color` as `stroke`.)* |

**A single set is meaningful on its own** — no switching, no per-edge `directionSets`; it just names the current reading (contributes a legend row, seeds new edges' style). Per-edge direction records and the base-orientation rule below only apply once there are **2+ sets**.

**Every edge exists in every set** — a set changes direction, never adds/removes edges. At 2+ sets, each edge's `directionSets` maps every set `id` → `EdgeDirection` (`{source, target, sourceHandle?, targetHandle?}`). Endpoint *nodes* are identical across sets; only which end is `source`, and which connection point, varies.

**Base orientation — what's on disk**: an edge's own top-level `source`/`target`/handles, and direction-sensitive style (`points` order, `startMarker`/`endMarker`, `labelPosition`), are always written in the **first** set's orientation, regardless of `activeEdgeDirectionSetId`. Switching the displayed reading changes only the one `activeEdgeDirectionSetId` line — not every edge — keeping diffs meaningful. To read the *currently active* reading, apply that set's `EdgeDirection` yourself: mirror `points`, swap the two markers, replace `labelPosition` with `1 - labelPosition` for any edge whose `source` differs from the base.

Absent/empty `edgeDirectionSets` = the whole mechanism dormant — no `directionSets` on any edge; direction is simply the edge's own `source`/`target`/handles.

---

## Security

Top-level `security` — threat/risk model. Per-shape assessments live in each shape's `data.security` (see [Node](#node)); this block is shared config.

```json
"security": {
  "threats": [
    { "id": "t-ddos", "name": "DDoS" },
    { "id": "t-phish", "name": "Phishing", "description": "credential theft via a fake login" }
  ],
  "hiddenThreatIds": ["t-phish"],
  "matrixShapeIds": ["shape-2", "shape-7", "shape-9"],
  "hiddenShapeIds": ["shape-9"],
  "probabilityScale": [ { "value": 1, "label": "Rare", "description": "…" } ],
  "consequenceScale": [ { "value": 1, "label": "Negligible", "description": "…" } ],
  "combineMethod": "multiply",
  "aggregateMethod": "average"
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `threats` | array of `{id, name, description?}` | yes | Threat catalog — matrix row candidates, ordered (row order). `id` is what `data.security` keys reference; `name` is display-only (renaming never touches per-shape data). |
| `hiddenThreatIds` | array of string | no | Threats hidden from the matrix but still part of the model — data kept, still counts toward completeness. Absent/empty = all shown. |
| `matrixShapeIds` | array of string | yes | `"shape"` node ids in the matrix, ordered (column order). A shape not listed carries no `data.security` at all. An id that no longer resolves is dropped on load. |
| `hiddenShapeIds` | array of string | no | Same hide-not-remove treatment as `hiddenThreatIds`, for shapes. |
| `probabilityScale` / `consequenceScale` | array of `{value, label, description}` | no | Per-diagram scale definitions. Absent = built-in 1–5 scale. A reader only needs the `value`s to interpret a `RiskCell`. |
| `combineMethod` | `"multiply"` \| `"add"` \| `"average"` | no | How probability × consequence combine into one cell score. Absent = `"multiply"`. |
| `aggregateMethod` | `"average"` \| `"sum"` \| `"max"` | no | How cell scores roll up per-threat/per-shape. Absent = `"average"`. |

**Hide vs. remove**: hiding keeps data and still counts toward completeness, just isn't rendered. Removing a threat deletes it from `threats` **and** deletes that threat's cell from every shape's `data.security`; removing a shape drops it from `matrixShapeIds` **and** deletes its whole `data.security`. Remove is destructive/deliberate; hide is a view toggle.

Absent `security` = feature dormant, no shape has `data.security`. Storage is sparse — an un-entered assessment is simply an absent cell (what the completeness check reads), nothing is pre-seeded.

---

## Determinism & versioning

- **Determinism**: files are written with a fixed key order (matching the tables above), 2-space indentation, and a trailing newline, so two saves of an unchanged diagram are byte-identical and diffs only show real changes. A compatible writer should aim for the same property for clean diffs, though it isn't required for the file to be readable.
- **Versioning**: `version` is currently always `1`. Fields have been added additively over the format's history — a reader from earlier in the format's timeline can still open a newer file and just won't recognize newer fields; the reverse also holds — current code must open an old file missing newer fields without failing or requiring migration. A breaking change to an *existing* field's meaning would bump `version`; nothing has required that yet. Treat every field as optional unless a table above marks it required, and never "fix" an old file by backfilling fields it doesn't have.

See [authoring-guide.md](authoring-guide.md) for linking/colocation conventions, the relative-path gotcha, and git/LFS notes.
