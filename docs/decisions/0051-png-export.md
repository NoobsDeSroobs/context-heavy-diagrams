# 0051: PNG export — rasterized capture now, true vector SVG deferred

## Status
Decided (2026-08-23), Decision 4 reversed the same day after live feedback — see Addendum.

## Context
Image export is needed to get a diagram out of the app as a picture, primarily for uploading views into Confluence. The original task list named both SVG and PNG. Two real questions had to be settled before writing any code: how faithful the SVG output needs to be, and how the export actually captures the canvas.

## Decision

**1. This pass builds PNG only; SVG is deferred, and when it's built later it must be true vector, not a rasterized snapshot wrapped in an `<svg>` tag.**

The common shortcut for React-based canvas apps is `html-to-image`'s `toSvg()` — a DOM snapshot wrapped in an SVG `<foreignObject>`, technically valid SVG but not actually editable shapes/text in Illustrator/Inkscape. The user explicitly wants real vector output eventually (editable elsewhere), which means a genuine serializer walking the diagram model into native SVG elements — a much larger, separate piece of work (effectively a second renderer alongside `ShapeNode`/`ContainerNode`/`LineNode`/`LabeledEdge`, one that has to be kept in sync with all of them going forward). Rather than build the throwaway rasterized version now and redo it later, this pass scopes down to PNG only; the export task list reflects the split.

**2. PNG capture: `html-to-image`'s `toPng()` against React Flow's own `.react-flow__viewport` DOM, cropped to content bounds.**

`getNodesBounds()` (`@xyflow/react`) computes the diagram's own bounding box; the exported image size is that box plus a configurable padding on each side, with a manual translate (`padding - bounds.x`, `padding - bounds.y`) positioning the viewport content inside it at zoom 1 — deliberately not the user's current on-screen pan/zoom, since the point is exporting the diagram itself, not whatever happened to be scrolled into view. `.react-flow__viewport` contains only nodes/edges; `<Background>`/`<Controls>`/`<MiniMap>`/`AlignmentGuides` are siblings elsewhere in the DOM (React Flow's own structure), so capturing that element directly needs no explicit hiding of editor chrome. A fixed `pixelRatio: 2` oversamples the output for sharpness — not exposed as a setting, since it wasn't asked for and a fixed sensible default avoids a knob nobody asked to turn.

**3. Selection outlines and resize/connection-point handles are hidden by deselecting before capture, not by CSS overrides scoped to export.**

Those render conditionally inside each node's own component based on `node.selected`/`edge.selected` — clearing selection immediately before capture (via `flushSync` so the DOM commits before `html-to-image` reads it) keeps them out of the image without the export code needing to know how each node type draws its selected state. Selection is restored afterward regardless of success/failure.

**4. Padding and transparent-background are global `AppSettings` fields, not a per-export dialog.**

Same "one settings object, a field per app-wide preference" convention as every other global setting (`edgeStraightSegmentLength`, `canvasBackgroundColor`, etc. — `settings.ts`), editable in the existing `SettingsPanel`. A per-export modal (padding/transparency prompted fresh each time) was considered and rejected: these two values are much more likely to be "set once to match your Confluence habits" than to vary export-to-export, and it avoids building a new modal component for what's otherwise a one-click File-menu action.

**5. Background color, when not transparent, is read from the already-resolved `--xy-background-color` CSS custom property via `getComputedStyle`, not re-derived from theme/settings logic.**

Whatever's actually painting the canvas right now (a custom `canvasBackgroundColor`, or the theme's own light/dark default when unset — see [ADR 0048](0048-style-palette-and-defaults.md)/[known-issues.md](../known-issues.md)'s entry on why this app sets that CSS variable directly rather than a plain `backgroundColor` style) is exactly what should fill the export background. Reading the computed value sidesteps duplicating that resolution logic a second time in the export path.

## Alternatives considered

**`html-to-image`'s `toSvg()` as a quick stand-in for real SVG export**, rejected per Decision 1 above — would need throwing away and rebuilding once true vector export is actually designed.

**A per-export options dialog** (padding/transparency prompted each time via a new modal), rejected per Decision 4 — more UI than the "set it once" nature of these two values calls for; can still be added later if per-export variation turns out to matter in practice.

**Auto-fit to the window's current viewport/zoom** instead of a fixed 1:1 capture of content bounds, rejected — would make the exported image's apparent size depend on incidental on-screen zoom at export time, not the diagram's own dimensions.

## Consequences
- New dependency: `html-to-image`.
- New `AppSettings` fields `pngExportPaddingPx`/`pngExportTransparentBackground`/`pngExportBackgroundColorOverride` — additive, `localStorage`-only, no `.chd` schema impact.
- True vector SVG export remains unscoped, tracked as the remaining half of the export work; whatever serializer eventually gets built there is unrelated code, not a variant of this PNG path.

## Addendum (2026-08-23): Decision 4 reversed — a real per-export dialog, not a Settings-panel-only control

Live testing immediately after the first pass shipped surfaced two real problems, both from the user:

1. **No dialog.** The user expected `File → Export as PNG…` to prompt for padding/background right there, not require a detour into the global Settings panel first. The "these rarely change export-to-export" reasoning behind putting them in `SettingsPanel` instead was wrong in practice — reversed the same day. `ExportPngDialog.tsx` is now the actual place these get set, opened directly from the File menu; `SettingsPanel`'s copy of these fields was removed. The underlying `AppSettings` fields stay, but now serve a narrower purpose: remembering the *last used* dialog values so it reopens prefilled rather than reset to defaults every time — not a second, competing place to edit them.
2. **"Background override" needed a real color, not just a transparency toggle.** Added `pngExportBackgroundColorOverride` (optional) alongside the transparency flag — absent means "use whatever's on screen right now" (the existing `--xy-background-color`-reading behavior), set means an explicit fill color distinct from the diagram's own on-screen `canvasBackgroundColor`.

Also found in the same pass, unrelated to the dialog question: **exported PNGs had no visible arrowheads on any edge.** Root cause: `EdgeMarkerDefs` (`src/renderer/src/edges/edgeMarkers.tsx`) renders its `<marker>` definitions in a separate, zero-size `<svg>` that's a *sibling* of `<ReactFlow>`, not a descendant of `.react-flow__viewport` — deliberately, so marker ids stay resolvable document-wide (see that file's own comment). But `captureDiagramPng` only clones the `.react-flow__viewport` subtree, so those defs were never part of the captured content at all; every edge's `marker-end="url(#...)"` reference dangled, silently rendering no arrowhead. Fixed by cloning the marker-defs `<svg>` (found via a new `data-export-role="edge-marker-defs"` attribute) into the viewport element for the duration of the capture, then removing the clone — cloning rather than moving the live node, to avoid disturbing React's own DOM bookkeeping for an element it still manages. See [known-issues.md](../known-issues.md#exported-pngs-had-no-visible-arrowheads-on-any-edge) for the full writeup.

Deferred, not built now: an "export everything vs. export selection only" choice, raised by the user in the same conversation once the base PNG-export case actually worked — logged for later, not scoped here.

## Addendum (2026-08-23): "use canvas color" was reading the wrong thing entirely

A third live-testing round, right after the two fixes above, found "Use canvas color" always exported plain white regardless of the diagram's real on-screen background. The background-color resolution described in Decision 5 above — reading `--xy-background-color` directly via `getComputedStyle` — was wrong: that custom property only ever gets a value through a `var()` fallback chain in `.react-flow`'s own CSS, never as a literal assignment when no custom color is set, so reading it directly returned an empty string every time in the common case. Replaced with `resolveEffectiveBackgroundColor()`, which walks up the DOM from the viewport reading each ancestor's actual resolved `background-color` until a non-transparent one turns up — the same thing a browser does to composite what's really behind an element. See [known-issues.md](../known-issues.md#use-canvas-color-png-export-always-exported-plain-white) for the full writeup.

## Addendum (2026-08-23): a legend, combining diagram Legend entries + enabled highlights

Once color/arrow fidelity worked, the user asked for a legend in the exported PNG: every entry from the diagram's own `legend` catalog, plus one swatch per currently-*enabled* highlight (their own example: exporting with the GDPR classification highlights on should produce rows for "No PII"/"Pseudonymized"/"PII"/"Sensitive PII", each in that highlight's own color). Real decisions, most confirmed directly with the user before building:

**Highlight rows use whatever's enabled right now, session state — not the full catalog.** Matches `HighlightDefinition`'s own "enabled is never persisted" design (shared/diagram.ts) and the user's own framing ("if I use the GDPR highlights when exporting"). Label convention copied exactly from `HighlightsPanel`: `key = value` for a highlight that's the only enabled member of its key, just the value when it shares its key with other enabled entries — the user's own four-row example has no group header, confirming this is the right convention to reuse rather than inventing a new one.

**No on-canvas legend existed to reuse.** `LegendPanel` is only ever a floating *editor* popup — this is genuinely new rendering, not "include what's already drawn." Built as a fully self-styled (literal resolved colors, not inherited CSS custom properties — see `resolveLegendColors`, which probes this app's own `--color-text`/`--color-background-soft`/`--ev-c-gray-2` tokens once) plain DOM element (`exportLegendDom.ts`), not a React tree — avoids needing a temporary React root/portal just for an export-only artifact. Builtin-icon legend rows inline trusted SVG markup; custom-icon rows use an `<img src="data:...">`, same trust boundary `IconSlotView` already draws. 'Line'-kind legend rows reference the same `url(#markerId)` ids real edges use, satisfied by the same marker-defs clone already in place for edge arrowheads (one clone now serves both).

**Placement: automatic only for this pass, corner selectable, legend size is never compromised to fit.** The user's own words after weighing the tradeoff: "make sure the legend grows to make the content readable, that is most important... extending the bounds is fine, but would be wasteful if it has nothing in [that] corner." `placeLegend` (`exportLegendPlacement.ts`) implements exactly that: if the chosen corner (bottom-left default, all four offered in `ExportPngDialog`) is already free of every node's own bounds plus a coarse per-edge box (the union of its two endpoint nodes' bounds — an approximation, not the rendered path itself), the legend slots in there and the image size is unchanged; if it's occupied (or the legend is simply bigger than that corner has room for), the export canvas grows outward from that same corner by exactly the legend's own footprint — a dedicated new strip, not a search for a smaller free gap or any shrinking of the legend itself. Manual (drag-to-position) placement was explicitly deferred by the user to a possible future pass, matching how PNG export itself started with just the base case.

**Known limitation, documented not fixed:** edge-obstacle detection uses the coarse endpoint-node-box approximation above, not the edge's actual rendered path. A heavily curved or waypointed edge passing through an otherwise-empty corner without either endpoint node nearby could in principle still get covered without being detected. Acceptable for now given the cost of precise path-based collision (sampling the real rendered SVG path) versus how rarely this specific shape of edge/corner combination would actually occur.
