# 0141: Animated edges are an edge style field

## Status
Accepted.

## Context
A diagram often has to tell what is running from what is planned, dormant or retired: a live integration, a stream, a job that fires. The edge's line style (solid, dashed, dotted) already carries one such distinction, but it is static, and the set of line styles is small. Movement along the edge says "live" at a glance and cannot be mistaken for a dashed "planned" line.

## Decision
- **`style.animation` on an edge** is `"flow"` or `"pulse"`; absent means none, the same absent-means-default rule as every other style field ([ADR 0014](0014-node-and-edge-style-schema.md)). `"none"` is never stored. A reader that meets a value it does not know draws the edge still.
  - `flow`: the line's dashes travel along it. A solid line is drawn dashed while it flows; a dashed or dotted one keeps its own pattern.
  - `pulse`: a dot in the line's colour travels along it.
- **The direction is source to target** of the edge as drawn, so it follows the arrow of the edge direction set in use ([ADR 0081](0081-flippable-edge-direction-sets.md)); the field is not transformed when the reading changes.
- **It is an ordinary part of the edge's look,** edited in the properties panel (Line, Animation) and copied by the copy-style brush, which already copies the whole style of an edge except where its label sits and how it is routed ([ADR 0095](0095-copy-style-apply-mode.md)). Painting from an edge with no animation removes the target's, as for every other field.
- **Movement is never the only carrier of meaning.** It is not drawn in an SVG export or the compare window, and it is switched off by the system's reduced-motion setting, so what "live" means has to be in a tag, a label or the legend. The format documentation and the assistants' field reference say so.
- **No movement unless asked for.** It is off by default, and an assistant sets it only on request.

## Alternatives considered
- **A boolean `animated`,** as React Flow has. One kind of movement only, and a second kind later would need a second field or a migration.
- **An animation for the whole edge direction set** (one reading "is live"). The reading is about direction, not state; one edge being live and another planned in the same reading is the normal case.
- **Animation derived from a tag** (`status=live`). Attractive, since the tag is the real meaning and diagrams are searched by tag, but it ties a visual to tag names and needs a rules mechanism of its own. A field that can be copied with the brush does the job now, and a rule can set the field later.
- **Animation in the legend line.** Not included in the first version: a legend row would have to animate too, and a still export cannot show it.
- **Animating in the SVG export** (SMIL). It would work in a browser and nowhere else (images in documents, slides, print), so the export stays still.

## Consequences
- **An additive file-format change:** older files open unchanged, and a build from before this field draws an animated edge still and drops nothing on save, because the style is kept as a whole.
- Every animated edge is a running animation on the main thread; it suits a handful of edges, and a diagram with hundreds of them may scroll less smoothly.
- The compare window and the reduced-motion setting show the edge still, as a dashed line for `flow` and plain for `pulse`.
