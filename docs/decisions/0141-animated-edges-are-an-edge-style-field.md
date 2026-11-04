# 0141: Animated edges are an edge style field

## Status
Accepted.

## Context
A diagram often has to tell what is running from what is planned, dormant or retired: a live integration, a stream, a job that fires. The edge's line style (solid, dashed, dotted) already carries one such distinction, but it is static, and the set of line styles is small. Movement along the edge says "live" at a glance and cannot be mistaken for a dashed "planned" line.

## Decision
- **`style.animation` on an edge** is `"flow"` or `"pulse"`; absent means none, the same absent-means-default rule as every other style field ([ADR 0014](0014-node-and-edge-style-schema.md)). `"none"` is never stored. A reader that meets a value it does not know draws the edge still.
  - `flow`: the line's dashes travel along it. A solid line is drawn dashed while it flows; a dashed or dotted one keeps its own pattern.
  - `pulse`: a round dot in the line's colour travels along it. `pulseDistance` sets the distance between pulses, so a positive value gives an evenly spaced stream and 0, absent or negative gives one pulse at a time. A pulse is drawn as a second stroke of zero-length dashes with round caps laid over the edge and moved by the same dash animation as a flow, which makes the spacing exact, the speed and direction the same mechanism for both kinds, and needs no per-dot element.
- **Speed and direction are two more edge style fields,** both meaningful only with `animation`. `animationSpeed` is a multiplier on the normal speed (absent means 1, drawn within 0.1 to 10 so a hand-written 0 or a huge value cannot freeze or strobe the edge). `animationDirection` is `"forward"` or `"reverse"` (absent means forward). A multiplier rather than named speeds, so a file written by hand or by an assistant can say any speed and the panel can offer a number.
- **Forward is source to target** of the edge as drawn, so it follows the arrow of the edge direction set in use ([ADR 0081](0081-flippable-edge-direction-sets.md)); neither field is transformed when the reading changes.
- **The dash pattern is a style field too.** `dashLength` and `dashGap` replace what a dashed or dotted line style draws (and give a flowing solid line its pattern), either one alone. They belong to the line, not to the animation: a dashed edge can be set without moving, and the SVG export draws the same pattern. A stored value is drawn within 0.5 to 200 pixels.
- **One switch for all of it:** the **Animate edges** preference draws every animated edge still when it is not on. It is a way of viewing, so it is an application preference and not stored in a diagram; it exists for the cost named below and for people who find movement tiring. It is in **View → Animate edges** (Ctrl+Shift+A) as well as in Preferences.
- **The system's reduced-motion setting is only the default.** The preference is `system` (the default), `on` or `off`. `system` follows the operating system's reduced-motion request, so a person who has asked for less motion starts without it; `on` and `off` are the person's own choice and win over the system, and the View menu item makes one, the opposite of what is drawn now. The request is not an absolute veto because it is reported where it does not reflect a wish: Windows sets it when "Animation effects" is off, and also in a Remote Desktop session and in many virtual machines, and an edge set to move is something the person deliberately asked for, not decoration. A first version made it a veto, and animation could not be turned on at all on such a machine. A value of this preference stored as a boolean before the change is read as `off` for `false` and as `system` for `true`, since `true` was the default and was written back with every other preference.
- **Still is not blind:** while edges are still, holding Ctrl (Cmd) over an edge shows it moving, as holding it over an element shows its note ([ADR 0093](0093-details-peek-card-on-modifier-hold.md)), so a diagram can be read still and an edge inspected at will. It is a deliberate, momentary request, so it applies when the system asks for reduced motion too. A class on the page carries the key, and the hover is the stylesheet's, so pressing it re-renders nothing.
- **The legend arrow moves too:** a legend line carries the same motion and dash fields as an edge, and picking a legend line from an edge copies them, so the legend arrow animates like the edge it explains and stands still when animation is off. Its speed is not shown as a number, and an image export draws it still.
- **It is an ordinary part of the edge's look,** edited in the properties panel (Line, Animation) and copied by the copy-style brush, which already copies the whole style of an edge except where its label sits and how it is routed ([ADR 0095](0095-copy-style-apply-mode.md)). Painting from an edge with no animation removes the target's, as for every other field.
- **Movement is never the only carrier of meaning.** It is not drawn in an SVG export or the compare window, and it does not move for a person who has asked the system for less motion (unless they turn it on), so what "live" means has to be in a tag, a label or the legend. The format documentation and the assistants' field reference say so.
- **No movement unless asked for.** It is off by default, and an assistant sets it only on request.

## Alternatives considered
- **Named speeds (slow, normal, fast) instead of a multiplier.** Easier to pick, but a fixed set that a file cannot go beyond.
- **A per-diagram switch for animation.** Whether to watch movement is about the person and the screen, not the diagram; a diagram that carries it would override that choice for everyone who opens it.
- **A boolean `animated`,** as React Flow has. One kind of movement only, and a second kind later would need a second field or a migration.
- **An animation for the whole edge direction set** (one reading "is live"). The reading is about direction, not state; one edge being live and another planned in the same reading is the normal case.
- **Animation derived from a tag** (`status=live`). Attractive, since the tag is the real meaning and diagrams are searched by tag, but it ties a visual to tag names and needs a rules mechanism of its own. A field that can be copied with the brush does the job now, and a rule can set the field later.
- **Animating only the selected edge.** Selection changes constantly and would make the diagram move as it is worked on; the Ctrl-hover is the deliberate version.
- **An SVG `animateMotion` dot for the pulse.** Needs a path length and a dot count per edge, cannot space a stream exactly, and moves by a different mechanism than the flow.
- **Animating in the SVG export** (SMIL). It would work in a browser and nowhere else (images in documents, slides, print), so the export stays still.

## Consequences
- **An additive file-format change:** older files open unchanged, and a build from before this field draws an animated edge still and drops nothing on save, because the style is kept as a whole.
- Every animated edge is a running animation on the main thread; it suits a handful of edges, and a diagram with hundreds of them may scroll less smoothly. Turning **Animate edges** off is the remedy.
- The compare window, and the canvas while animation is off, show the edge still, as a dashed line for `flow` and plain for `pulse`.
- The edge direction set's own default style (and so its legend row) does not carry animation or dash settings; the field would otherwise be born into every new edge drawn in that reading.
