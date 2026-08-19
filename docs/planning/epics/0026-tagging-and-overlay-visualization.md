# 0026: Tagging and overlay visualization

## Status
Not Started — mostly scoped now, a few technical questions deliberately deferred (see Notes)

## Goal
Tag nodes and edges with freeform labels, then visualize the diagram *by* tag via a set of user-defined, individually-toggleable **highlights** — each one a tag + a color. Two motivating use cases: tracing a specific data path through a system (which shapes and edges does customer PII actually flow through?), and showing which parts of a large macro/landscape diagram participate in a given business capability, without needing a separate diagram file per concern.

## Design (as scoped in discussion)

**Two related concepts, not one:**
- **Tags** — freeform strings applied directly to individual nodes/edges. Live as *standard* metadata (a real first-class field, e.g. `data.tags: string[]`), not [ADR 0009](../../decisions/0009-custom-metadata-bucket.md)'s opaque custom `metadata` bucket — the field itself is standard/tool-managed, but the tag *values* are entirely user-created/custom text, not a fixed predefined vocabulary. Resolves the standard-vs-custom question this epic originally left open.
- **Highlights** — a separate list of `{ tag, color, enabled }` entries, managed independently of individual elements. A highlight doesn't tag anything itself; it's a saved *visualization* of an existing tag.

**Highlights panel** (a new in-app view — see open question below on "panel vs. window"):
- "Add new highlight" opens a searchable picker listing every tag currently used somewhere in the diagram — same searchable-picker pattern already established for icons (`builtinIcons.ts`) and planned for line-style presets (ADR 0010), not a new interaction to learn.
- Pick a tag, pick a color (other properties left open/extensible — "maybe some other things," not specified further yet).
- Once added, the panel lists each highlight as: color swatch, tag name, and an on/off toggle. Multiple highlights can be enabled simultaneously — this isn't "pick one active view," it's a set of independently-toggleable overlays.
- Enabling a highlight colors every node/edge carrying that tag — either as an overlay (glow/outline/badge on top of the shape's real style) or a temporary color override (visually recolored while active, underlying stored style untouched). Genuinely undecided which — see Notes.

Tagging an individual element (applying a tag to it in the first place) still needs its own UI surface — likely the existing right-click context menu (mirroring "Add icon…", "Link to diagram…") plus/or a tags section in the details panel — not yet designed, flagged as a needed companion piece this discussion didn't cover.

## Tasks
(Not broken down into implementation steps — revisit when this epic starts. Design direction above is real, but several technical specifics are deliberately deferred, see Notes.)

## Notes
Genuinely open, deferred on purpose ("how we solve it technically we can figure out later"):

- **Overlay vs. temporary color-override** for how an active highlight actually renders on a matching node/edge.
- **Multiple simultaneously-active highlights on the same element**: if a shape carries two tags and both have enabled highlights with different colors, what renders? (Split border, small color chips/dots, blend, priority/z-order by highlight creation order, something else.) Not addressed yet — worth prototyping rather than guessing.
- **Dim non-matching elements or leave them alone** while a highlight is active — the description covers coloring matches, doesn't say whether everything else should fade for contrast. Worth deciding once there's something to actually look at.
- **Panel vs. a real second window**: "a new window or view" was offered as either — this project has no second-OS-window precedent anywhere yet (every existing surface — `ContextMenu`, `IconPicker`, `DetailsPanel` — is an in-app panel/popup), so an in-app panel is the more consistent default, but a real second window isn't ruled out. Loosely relevant to epic 0024 (tabs/windows) if that lands first and establishes multi-window patterns to reuse.
- **Do highlight definitions persist in the file, or are they session/local-only?** Not explicitly stated. Persisting them (a new top-level `DiagramFile.highlights` array, alongside `nodes`/`edges`/`viewport`) fits this project's "files are the database" principle and means a shared/reopened file shows the same highlight setup to whoever opens it — the default worth assuming unless there's a reason for local-only, but not decided yet.
- **Tagging UI itself** (see Design above) — applying a tag to an element needs its own entry point, not yet designed.
- **Tag autocomplete while tagging an element** (not just while building a highlight) — same "smart tagging" usability concern as the highlight picker, extends naturally but not explicitly confirmed for that surface too.
- **What "tracing a data path" means mechanically**: still assumed to be manual (the user selects and tags the relevant nodes/edges themselves; the tool only visualizes), not automatic graph traversal/path-finding — consistent with [ADR 0008](../../decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md)'s flexible-primitives-over-automation stance. Not re-litigated in this round of discussion, carried over from the original scoping.
- **Cross-diagram tag scope: resolved, stays local/per-diagram.** No shared/global tag catalog across linked diagrams — confirmed, not just carried over by default. Reasoning given: there's no visibility into a linked child diagram's content from the parent anyway (consistent with [ADR 0005](../../decisions/0005-diagram-identity-and-linking.md)'s downward-only, independently-scoped model — a parent doesn't know what's inside a child until it's actually opened), so a shared catalog wouldn't make practical sense on top of how the tool already works.

**Nice-to-have, explicitly for later, not this epic's core scope:**
- A "search children" setting — when searching tags (e.g. in the highlight picker), optionally also search within linked child diagrams, not just the current one. Bridges some of the "local only" limitation without needing a persisted shared catalog — would read child files on demand (the app already has the IPC plumbing for this from epic 0009: `resolveLinkedDiagram`/`openDiagramAtPath`), not a new indexing mechanism.
- A "copy to direct children" operation — propagate a tag or highlight definition down to a diagram's direct linked children, for consistent tagging across a link tree without a shared catalog file. Exact scope ("for some parts") not pinned down yet.

Likely relevant once scoped: epic 0022's gallery (application-to-capability heat maps, data flow/lineage diagrams, security zones would all benefit substantially), and epic 0003/ADR 0010's color/styling infrastructure, which highlight rendering will likely want to build on rather than invent separately.
