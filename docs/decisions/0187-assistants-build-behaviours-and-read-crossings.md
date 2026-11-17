# 0187: Assistants build behaviours, set label positions and read crossings

## Status
Accepted (2026-11-17)
Amends: the operations of [0148](0148-an-assistant-builds-a-diagram-by-operations-that-answer.md); applies [0175](0175-assistants-make-what-a-person-can-make.md) to behaviours (stencils, [0180](0180-stencils-are-light-elements-for-events-and-verbs.md)), label positions ([0183](0183-where-the-label-of-a-small-shape-goes.md), [0184](0184-the-label-of-a-container-goes-on-any-side.md)) and crossings ([0185](0185-edges-that-cross-a-container-are-marked-with-a-gate.md)).
Superseded by: none

## Context
A person can add a behaviour, change its kind, move the label of a small shape or of a container, and see which edges cross a lane. An assistant that builds a flow with `edit_diagram` or `chd edit` could do none of it: a flow was entities with step-like labels. The stale-edit check ([0109](0109-stale-edit-check-for-every-ai-write-path.md)) is unchanged, since the operations are the same kind of write.

## Decision
- **Three operations**, in the shared edit core, so the extension, the command line and a live window get them alike: `add_behaviour {kind?, label?, x, y, width?, height?, parent?, labelPosition?, offset?, style?}`, `set_behaviour_kind {id, kind}` and `set_label_position {id, position, offset?}`; `add_container` also takes `labelPosition`. The word is "behaviour", the palette's name for it; the stored type stays `stencil`.
- **The kinds come from the app's own table** (`shared/stencils/kinds.ts`): an unknown kind is refused with the list. Size and default label follow the kind; the answer says when the label was filled in. `set_behaviour_kind` does what the app's kind change does: label and size follow only while they are still the old kind's own, a resized box keeps its centre.
- **One operation for both label positions**, since the fields are the same one (`data.labelPosition`) with different values: below, above, left, right or free for a behaviour with a small shape, top, left, right or bottom for a container. The default is stored as nothing, as the app does. Making a label free without an offset keeps it where it was, using the app's own estimate. A step's label is inside it, so a position on a step is refused rather than stored and ignored.
- **A behaviour carries no tags, notes or required tags, and one link** ([0180](0180-stencils-are-light-elements-for-events-and-verbs.md)): the tag, note and required-tag operations refuse or skip it as the app's panel does. `connect`, `move`, `resize`, `set_style`, `reparent` (into a container only) and `remove` take it as they take an entity.
- **Crossings are read, not drawn or checked.** `inspect_diagram` gives each edge that crosses a container's border a `crossing` route ("Sales → Finance"), from the same derivation the app uses; it is information, not a layout issue, since a hand-off is often the point of a lane. A rule that forbids a crossing is a check of a diagram metamodel.
- **The kind and any non-default label position are in the description of an element**, so an assistant reading a flow sees what a step is.
- **The validator does not flag an unknown kind or position.** The app reads them as a step and as below, so a file from a newer version is still valid; the operations are strict, the reader is lenient, and the standalone validator would need a second copy of the kinds list.
- **Guidance:** the operations help, the build page (a flow section, and a longer limit for the page) and the field reference and layout guide of the skill.

## Alternatives considered
- **A generic `set_data {id, field, value}`:** small, but it lets an assistant write what the app would not (a label position on a step, a kind that does not exist) and gives nothing to read in the help.
- **A separate operation per label position field** (`set_container_label_side`, `set_stencil_label_position`): the same word means two things in the file already; a person sees one control, so the assistant gets one operation.
- **Crossings as a layout issue:** would make every swim-lane diagram report problems it does not have.
- **A separate tool for crossings:** the edge list already is the place a hand-off is read; a second answer to fetch would cost a round trip for a field that fits in one.

## Consequences
- An assistant can draw a flow in lanes with the same elements and label positions a person would, and read back where it hands over between lanes.
- The kind list has one source: a new kind in the table is available to the operations, their help and their errors with no further change.
- The build page is longer (about 1.3 KB), which is the price of the flow guidance; the rest of the detail stays in the operations help.
