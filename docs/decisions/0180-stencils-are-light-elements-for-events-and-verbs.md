# 0180: Stencils are light elements for events and verbs

## Status
Accepted (2026-11-15)
Supersedes: none. Builds on [0080](0080-bpmn-as-adopted-vocabulary-not-metamodel.md) (BPMN as vocabulary, not metamodel). [0031](0031-icon-annotation-is-a-standing-requirement.md) (icons) concerns entities only and does not apply to stencils.
Superseded by: none

## Context
An entity is a thing or a concept and carries context: notes, tags, metadata, links, security data. A flow needs elements that are not that: a step, a decision, a split, a start, an end. BPMN has names and marks for them, and 0080 adopts that vocabulary without its grammar. Drawn as entities they would carry context they do not need, and could be used in place of entities.

## Decision
- **A new node type, `stencil`, with a `kind` from a closed list built into the app.** The first kinds are `step`, `decision`, `parallel`, `start` and `end`. **Events and verbs are stencils; nouns and concepts are entities.**
- **A kind is a base shape with an optional mark on it** (whether it has one depends on the kind), one row in a table in the app: its id, neutral name, base shape, mark, default colour and search terms. **A stencil's icon is part of its kind and cannot be changed or added.** Most stencils have no room for an icon, and a mark that says what sort of step it is belongs in the list: a manual step and an automatic step are two kinds that share the step's base shape. Adding a kind is adding a row.
- **What a stencil carries:** a label, its kind, a style, a size and place, a parent container, connection points (with automatic attachment) as an entity has, and **one link to another diagram**. **It carries no icons of its own, notes, tags, metadata, references or security data.** Without tags, highlights, required tags and tag rules do not apply to it.
- **A lane is a container, and a stencil in a lane is its child.** The lane is the only other context a stencil has.
- **Shape:** `start` and `end` are circles, `decision` and `parallel` squares with a mark inside, `step` a pill, a rectangle with fully rounded ends and a tint of its own, so that it does not look like an entity (with no mark; a sort of step with one is its own kind). The frame is always a rectangle, so resizing, containment and connection points work as for any node. The marks are drawn by the app as vector graphics; no raster image is part of the base.
- **Colour:** each kind has a default fill built into the app, found when the element is drawn and not stored, so it is the same on every machine. A fill on the element itself wins; removing it returns to the default. It is not a preference.
- **Legend:** shows the kinds the diagram uses, each with its mark, colour and neutral name. The rows are derived, not stored. They are shown by default, and a switch in the app hides them for the session; nothing about it is in the file.
- **Names and notation:** labels are neutral (Step, Decision, Parallel split or join, Start, End). BPMN terms are search keywords only. The marks are our own drawings and nothing is copied from the specification; the product says "based on BPMN 2.0", never "compliant", and the notices credit OMG.
- **The list is closed:** a person cannot define or install stencils. Installed icon packs give entities icons; they add no stencils and put nothing on one.
- **An assistant can make and change a stencil as a person can** ([0175](0175-assistants-make-what-a-person-can-make.md)).
- **Search and review:** a stencil is found by id, label, kind name and BPMN terms. In a review of changes its kind and link are changes in meaning, not in look.

## Alternatives considered
- **An entity with an icon and a preset** (no new type). Nothing to add to the file, but a stencil could not be told from an entity, it would carry all the context, and conformance and required tags could not leave it alone.
- **Changeable icons on a step** (a person picks one). There is no room on most kinds, it would let a step carry what only an entity should, and a mark chosen per element cannot be in the legend by itself.
- **Non-rectangular outlines** (a diamond for a gateway). Resizing, connection points and containment all assume a rectangular frame.
- **Tags on stencils, to allow highlights.** Tags are context; colour by kind gives most of what highlights would.
- **Colours from a per-person preference.** The same file would look different on another machine, and the legend would show the wrong colours.
- **Stored legend entries.** The person maintains them and they go stale.
- **Stencils people can define or install.** Noun stencils would creep in, which is what the rule is there to prevent.
- **A BPMN metamodel and its checks** (0080).

## Consequences
- The file format gains a node type: an additive change, documented in `docs/file-format.md`. A version without the type does not promise to open such a file correctly.
- Every place that lists node types needs the new one: conformance, style defaults, the exports, the review of changes, search and the assistant tools.
- The list can grow a long way, since every sort of step is its own kind. The picker has to group and filter it, and the legend shows only the kinds a diagram uses.
- A stencil cannot be coloured by tag. What needs explaining is an entity, or a text box beside the stencil.
- Not covered in the first version: kinds beyond the five (inclusive choice, timer and message events, repeat marks), checks on the flow (a decision with one way out), and a check that shows which edges leave their lane.
