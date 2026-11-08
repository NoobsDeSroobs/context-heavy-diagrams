# Glossary

The terms this project uses precisely, so that "settings" does not quietly mean three things. The app shows this file under **Help → Glossary…**: for each `##` term, the text up to its `### For developers` subheading, and nothing else. So that text is plain: no type names, no ADR numbers, no links (name another term instead). The code-level detail goes under `### For developers`. A test fails for a term with no plain part, and for a link or an ADR number in one ([ADR 0157](../decisions/0157-menus-are-grouped-and-the-glossary-is-in-help.md)). See [ADR 0052](../decisions/0052-settings-ownership-tiers.md) for the reasoning behind the settings tiers.

## Entity

A box that stands for one thing in what the diagram models: a service, a system, a team, a queue. It means "this diagram treats it as one thing", not "it has no inside": link it to a deeper diagram to show the inside.

### For developers

The `entity` node type (called Shape before 2026-09-30, [ADR 0101](../decisions/0101-shape-to-entity-rename.md); a pre-rename file's `"shape"` is accepted as a synonym on load, per [docs/file-format.md](../file-format.md)). The meaning lives in the node's *type*, not its appearance: an Entity styled to look like a Container is still an Entity. Its `linkedDiagram` leads to the diagram where it is a Container.

## Container

A box that holds other elements: a boundary, a scope, a group. It never means a thing of its own, only a collection of things. Drag an element into it to nest it; moving the container moves what is inside. What is a container in one diagram can be a single entity in a higher-level one.

### For developers

The `container` node type. Both Entity and Container are scoped to the diagram they are drawn in, not absolute. A diagram scoped to a team might show each of its services as a Container with the compute, queues and storage inside as Entities; a diagram for the whole organization draws that service as one Entity, linked (via `linkedDiagram`) down to the detailed diagram. Nothing new needs building for this: it is what linked-diagram drill-down already does, and the naming makes it legible.

## Edge

An arrow or line that joins two elements at connection points. It stays attached and re-routes when either end moves, and it can carry a label and tags like an element.

## Edge direction set

A named reading of a diagram's arrows. The same edges can be read as "Data flow" or "Trigger direction", which for a request and its response point opposite ways. You switch between readings, and each can have its own colour and arrow style. A diagram metamodel can require one named for what its arrows mean.

### For developers

`edgeDirectionSets` and `activeEdgeDirectionSetId` at the top of the file ([ADR 0081](../decisions/0081-flippable-edge-direction-sets.md), per-set style in [ADR 0083](../decisions/0083-per-set-edge-style-as-creation-template.md)). Edited in the Edge direction sets section of the Diagram settings panel.

## Notes

The Markdown text behind an element: what you would otherwise squeeze into the box. A note is saved next to the diagram as its own file, and written when you save the diagram. Its panel says Unsaved until then. Hold Ctrl (Cmd on a Mac) over an element to peek at its note.

### For developers

A `.md` file the node's `data.notes` points at, kept in an in-memory shadow while it is edited and written on diagram Save ([ADR 0092](../decisions/0092-unified-multi-file-save-and-change-detection.md), [ADR 0154](../decisions/0154-unsaved-changes-show-in-the-window-title-and-the-notes-panel.md)). Called details before 0.4.0.

## Tags

Key and value data on an element or an edge, such as `env=prod` or `owner=payments`, entered in the Metadata section of the properties panel. Search finds them (`tag:env=prod`), highlights colour by them, and a diagram metamodel can check them.

### For developers

The `metadata` object on a node or edge ([docs/file-format.md](../file-format.md#metadata)).

## Required tags

The diagram's own list of tags that every element carries, each with the values it allows. Set under View → Diagram settings.

### For developers

`requiredTags` at the top of the file ([docs/file-format.md](../file-format.md#required-tags)).

## Highlights

Colours tied to a tag value, such as `env=prod` in red. Switch one on and every element with that tag value takes the colour, so one diagram can answer "what is production?" or "where does personal data live?". Which highlights are switched on is not saved in the file.

## Legend

The author's own explanation of what the colours, lines and icons mean in this diagram, written by hand. It does not follow the highlights. An exported image can carry it, in a corner you choose.

## Layers

The order in which elements are drawn: what lies above what. The Layers panel lists them and lets you drag one up or down. It shows the diagram from this angle and holds nothing of its own.

### For developers

A read-only projection of each node's `zIndex` ([ADR 0075](../decisions/0075-container-hierarchy-integrity.md) for the parent rule). Like Diagnostics it owns no state, so it is not a settings tier.

## Linked diagram

An element that points at another diagram file, usually a deeper view of the same thing. Ctrl-click (Cmd-click on a Mac) follows the link. Links only point downward, so any diagram in a tree can be opened on its own as its root.

### For developers

`linkedDiagram`, a relative path resolved against the diagram's folder and kept inside it ([ADR 0115](../decisions/0115-paths-stored-in-diagrams-are-untrusted.md)).

## Properties

The settings of one selected element, in the properties panel: fill, border, font, tags and the rest. Changing one element's properties never changes another's.

### For developers

**Scope: one element** (an Entity, Container, Text, Line or Edge). Lives in that element's own `data` on `DiagramNode` / `DiagramEdge`.

## Diagram settings

Settings that belong to the whole diagram and are saved in its file: required tags, highlights, the legend, edge direction sets, gravity presets (named bends for curved lines) and the most connection points a side may have. Whoever opens the file sees the same ones. View → Diagram settings.

### For developers

**Scope: one diagram.** Stored at the top level of `DiagramFile`, everything except `nodes` and `edges`: `requiredTags`, `highlights`, `legend`, `gravityPresets`, `maxConnectionPointsPerSide`, `metadata`. The camera position is deliberately not part of this tier; it is not persisted at all ([ADR 0090](../decisions/0090-drop-viewport-persistence.md)). Edited by `DiagramSettingsPanel`. Older docs and comments call this tier "Configuration".

## Preferences

Your own choices for how the app behaves, kept on this computer for every diagram: the colour of a selected edge, the size of the Ctrl-hover card, whether the AI menu shows. Two people with different preferences can work on the same file without conflict. View → Preferences.

### For developers

**Scope: this installation, every diagram.** Stored in `AppPreferences`, a per-OS file ([ADR 0053](../decisions/0053-os-conventional-settings-storage.md); on disk it is still `settings.json`). Edited by `PreferencesPanel`. Older docs and comments call this tier "Settings".

## Override and default

A few values can be set at three levels. A diagram can pin one for everyone who opens it (the diagram's override). Otherwise your own preference applies, and otherwise the app's built-in value. The most connection points per side and the gravity presets work this way.

### For developers

Diagram override → user default → built-in default. It is deliberately not applied everywhere: [ADR 0052](../decisions/0052-settings-ownership-tiers.md) lists which values get it and why, and which stay Preferences-only (the style palette, where a diagram-local copy would repeat what Properties already stores). A value that needs to be consistent for the diagram to make sense gets the override.

## Diagram metamodel

The complete set of rules one kind of diagram follows, such as hexagonal, data flow or C4: which kinds of element there are, what an arrow means and how they may be combined. It is a separate file applied to a diagram, never stored in one. A diagram is checked against one metamodel at a time, because hexagonal rules laid over C4 rules mean nothing. That separates a metamodel from a regulation such as GDPR, whose rules do add up.

### For developers

A `.chdmeta` file ([ADR 0131](../decisions/0131-conformance-profiles.md), [format](../metamodel-format.md), naming in [ADR 0144](../decisions/0144-a-conformance-profile-is-called-a-diagram-metamodel.md)). The check is the **conformance check** (`chd check`, and Diagnostics in the app). It was called a *profile* before 0.6.0.
