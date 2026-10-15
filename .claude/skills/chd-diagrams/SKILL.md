---
name: chd-diagrams
description: Read, author, and hand-edit .chd files — the JSON-based diagram format used by the "context-heavy diagrams" (chd) tool (nodes: shapes/containers/text/anchors/freeform lines, edges, metadata/tags, linked drill-down diagrams, custom icons, security matrices). Use this skill whenever a .chd file is opened, referenced, or needs to be created, parsed, or modified — adding/editing shapes or connections, wiring up linked diagrams across files, adding metadata or required-tag templates, fixing broken relative-path references (icons/details/linked diagrams), reasoning about coordinate systems, laying out/arranging a new diagram (spacing, sizing, color restraint, or archetypes like swimlanes/layered architecture/hub-and-spoke), or answering any question about how the format works. Trigger even when the user just says "this diagram," "the .chd file," or names a specific diagram (e.g. an Azure/infra overview) without spelling out the format — and for any project directory that contains .chd files.
---

# .chd diagram format

A `.chd` file is plain JSON. One file is one diagram. The extension is cosmetic — it's readable/writable with any text tool — and a file can be renamed or moved freely without breaking anything about *itself* (only paths *pointing into* it, or *out of* it, care about location — see Linking below).

This skill covers three jobs: **reading** a `.chd` file correctly, **hand-editing** one without corrupting it, and general **authoring** know-how (linking diagrams together, colocated assets, keeping diffs clean, laying out a diagram so it doesn't look ad hoc).

## Before editing any real file

Run the bundled validator first — it catches the most common ways a `.chd` file breaks, including a real bug class this skill exists because of (see below):

```bash
node scripts/validate_chd.mjs path/to/diagram.chd
```

(Plain Node, no packages. If `node` isn't installed, skip the script but still check ids, parent-before-child ordering and relative paths by hand, as described below.)

It checks JSON validity, id uniqueness, parent-before-child node ordering, dangling `parentId`/`source`/`target` references, and whether every relative path (`data.icons.*.path`, `data.details`, `data.linkedDiagram`, `data.references`) actually resolves to a file on disk *relative to that `.chd` file's own directory*. Run it again after you edit, and run it over every `.chd` in a project when asked to audit one — broken relative paths are silent at the JSON level and only show up this way.

## The core invariant: relative paths are relative to the referencing file, not the diagram it was copied from

This is the single most common corruption when hand-editing or when a node is copied between diagrams. Every relative path in the format (`data.icons.*.path` for custom icons, `data.details`, `data.linkedDiagram`, `data.references`) resolves **relative to the `.chd` file that contains it** — never relative to the project root, never relative to wherever the value "looks like" it came from.

Concretely: if `assets/logo.svg` sits next to `diagram.chd`, a node inside `diagram.chd` references it as `"path": "assets/logo.svg"`. If that same node gets copied into a *child* diagram at `diagram/child.chd` (a normal thing to do when splitting a diagram via `linkedDiagram`), the path must become `"path": "../assets/logo.svg"` — copying `"assets/logo.svg"` verbatim now points at a nonexistent `diagram/assets/logo.svg`.

This isn't hypothetical — it's the exact failure mode found in this tool's first real diagram set: a parent diagram at `Project/Overview.chd` correctly referenced `Overview/assets/icon.svg`, but when a node carrying that same path string was copied into a child diagram at `Project/Overview/Sub.chd`, the unchanged path resolved to the nonexistent `Project/Overview/Overview/assets/icon.svg` — every icon and detail-note link on that node silently broke. **Whenever you copy a node (or write one by hand) into a diagram at a different depth than the one you're copying from, recompute every relative path against the new file's own location.** The validator script above catches this class of bug directly.

Missing targets are meant to be recoverable, not fatal — the app shows "not found at `<path>`" and keeps working — so a wrong path won't crash anything, it'll just quietly fail to show the icon/note/link. That's exactly why it's worth checking deliberately instead of trusting that "nothing errored."

## Reading a file: mental model

- Top-level object has `version`, `viewport` (cosmetic camera position, ignore for meaning), optional `metadata`/`requiredTags`/`highlights`/`legend`/`gravityPresets`/`edgeDirectionSets`/`security`, and the two arrays that matter: `nodes` and `edges`.
- **Coordinate systems differ by context** — get this wrong and every position calculation is wrong:
  - A top-level node's `position` is absolute canvas coordinates.
  - A node with `parentId` set has `position` relative to *its parent's own top-left corner*, not the canvas.
  - A `"line"` node's `data.points` are relative to *that line node's own `position`*.
  - An `edge`'s `points` (routing waypoints) are absolute canvas coordinates — a different convention from line-node points despite looking similar. Don't reuse line-point logic for edge-point logic.
- Node `type` determines what's meaningful: `"shape"`/`"container"` have connection points, icons, metadata; `"text"` has rotation but no connection points/icons; `"anchor"` is a bare placeholder; `"line"` has `data.points` and nothing else structural.
- **Absent means default, everywhere** — with one specific, deliberate exception: **always write an edge's `"type": "labeled"` explicitly**, never omit it. Every other field really does follow "absent means default": no `style` object means "current hardcoded look," no `rotation` means `0`, no `connectionPoints` means one centered point per side, no `lock` on a metadata entry means it's a free (non-template) entry — don't treat an absent optional field as an error or as needing to be filled in, and when *writing*, omit a field rather than writing its default value explicitly (keeps diffs meaningful and matches how this app itself writes files). Edge `type` is the one field where that instinct actively hurt — this app's renderer had a real bug (fixed 2026-09-05, see `docs/known-issues.md`) where an edge with a genuinely-absent `type` key silently rendered with no styling, no highlight support, and no custom routing, no error shown anywhere. Fixed now, but a build predating the fix will still hit it — explicit costs nothing.
- `nodes` array order matters structurally, not just cosmetically: **a parent node must appear before its children.** This is a React Flow requirement, not a style preference — build/preserve this ordering in anything you write.
- For the full field-by-field reference (every field, type, and exact meaning across top-level object, Node, Node style, Edge, Edge style, line points, edge points, icon references, metadata, required tags, highlights, legend, gravity presets, edge direction sets, and the security matrix), see [references/field-reference.md](references/field-reference.md). Read it whenever you need an exact field name/type/enum rather than guessing.

## Editing a file by hand

1. **Parse, mutate the in-memory structure, re-serialize** — don't do string-level surgery on the JSON text, since key order and indentation both matter for clean diffs (see Determinism below).
2. **Generate new node/edge ids as `<type>-<uuid>`** (e.g. `shape-1a2b3c4d-5e6f-...`) to match this app's own convention, though the format only requires ids be unique within the file — nothing parses structure out of the id string itself.
3. **New node → append after its would-be parent**, respecting the parent-before-child ordering rule above. If it's top-level, position doesn't matter relative to other top-level nodes.
4. **New edge → reference existing node ids** via `source`/`target`. Only set `sourceHandle`/`targetHandle` if you need a *specific* connection point; otherwise omit and let the renderer pick one.
5. **Adding a `linkedDiagram`** (drill-down to a child diagram): decide the child's actual file location first, *then* compute the path relative to the parent's own directory — not the other way around. See the invariant above; this is where that bug is introduced most often.
6. **Metadata/tags**: a plain human-added key is `{ "value": ... }` with no `lock`. Only set `lock` if the diagram's `requiredTags` template governs that key — see [references/field-reference.md](references/field-reference.md#metadata) for the `lockedEditable`/`lockedStatic` distinction before touching a locked entry, since a `lockedStatic` value should track the template's `defaultValue`, not be edited independently.
7. **Validate before considering the edit done** — run `scripts/validate_chd.mjs` on the file (and on any other `.chd` file whose relative paths you might have affected, e.g. a parent that links to a child you moved).

### Determinism (why this matters for git-tracked diagrams)

This app writes files with a **fixed key order** (matching the order fields appear in [the field reference](references/field-reference.md)), **2-space indentation**, and a **trailing newline** — so two saves of an unchanged diagram are byte-identical and git diffs only show real changes. When hand-editing, preserve this: don't reformat unrelated parts of the file, don't reorder keys you're not touching, and match 2-space indent for anything you add. It isn't required for the file to still be *readable* by this app (a lenient reader tolerates any valid JSON), but a diagram in a git repo loses most of its diff-review value if a hand edit reformats the whole file.

## Other things worth knowing before authoring

- **Colocated assets**: by convention, a diagram's custom icons/details/reference-images/child-diagrams live in a sibling folder named after the diagram file (`my-diagram.chd` → `my-diagram/assets/...`, `my-diagram/details/...`). This is a convention this app defaults to when *creating* new assets, never a requirement — a `linkedDiagram` can point anywhere on disk, including outside that folder or the project entirely.
- **Links only point downward** (parent → child) — a child diagram never references its own parent. This is what lets any `.chd` file be opened independently as its own root; don't add a back-reference from a child to its parent even if it seems convenient for navigation.
- **Backward compatibility is a standing rule**: an older file missing a newer field (e.g. no `edgeDirectionSets`, no `security`) is completely normal, not corrupt — treat every top-level and per-node/edge field as optional unless the reference marks it required, and never "fix" an old file by adding fields it doesn't have.
- **Highlights and legend are catalogs, not state**: `highlights`/`legend` on the top-level object are the *available* set; whether they're currently toggled on/shown is the app's own in-memory session state and is never written to the file. Don't add an "enabled" field to an entry — it doesn't exist in the format.
- **A tag isn't done once it's declared**: if you add `requiredTags` and populate `metadata` to match, also add a `highlights` entry for every value in use and a `legend` entry explaining the diagram's own conventions (the line/edge style, at minimum) — otherwise the tagging is technically present but invisible/unexplained to whoever opens the file. And don't stop at nodes: an edge carries `metadata` too, and a classification tag like GDPR sensitivity is often more meaningful on the data-in-motion (the edge) than on the shapes it connects. See [references/authoring-guide.md](references/authoring-guide.md#tags-arent-visible-or-useful-until-something-renders-them--set-up-highlights-and-a-legend-in-the-same-pass) for the full reasoning and a real example of getting this wrong.
- Full authoring detail (edge direction sets, the security matrix, gravity presets, line/edge point curve math, versioning history) lives in [references/field-reference.md](references/field-reference.md); linking/colocation/determinism nuance beyond the summary above lives in [references/authoring-guide.md](references/authoring-guide.md) — read that one when a task involves multi-diagram link graphs, git/LFS considerations, or reconstructing a curve from `points`.
- **Laying out a diagram from scratch** (no existing arrangement to follow): see [references/layout-guide.md](references/layout-guide.md) for spacing/sizing conventions and named archetype recipes (layered architecture, hub-and-spoke, pipeline, swimlane, boundary nesting) — advisory starting points, not something the format or validator enforces. Includes a general authoring *order*, too, not just spacing values: build structure (shapes/containers) → content (edges with labels, metadata) → geometry pass last, since an edge's label needs real visual clearance a position chosen before the label existed won't have accounted for.

## Minimal worked example

A two-node, one-edge diagram, correctly formatted:

```json
{
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [
    {
      "id": "shape-1",
      "type": "shape",
      "position": { "x": 0, "y": 0 },
      "size": { "width": 120, "height": 80 },
      "data": { "label": "Client" }
    },
    {
      "id": "shape-2",
      "type": "shape",
      "position": { "x": 300, "y": 0 },
      "size": { "width": 120, "height": 80 },
      "data": { "label": "API" }
    }
  ],
  "edges": [
    {
      "id": "xy-edge__shape-1right-shape-2left",
      "type": "labeled",
      "source": "shape-1",
      "target": "shape-2",
      "sourceHandle": "right",
      "targetHandle": "left",
      "label": "requests"
    }
  ]
}
```
