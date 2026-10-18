# 0117: The built-in default look is data

## Status
Accepted

## Context
An element's stored style holds only what the author changed. Everything else is "the default", and the default look was spread over three places that agreed only by hand: CSS rules for entities, containers and text; constants in the edge and line components; and nothing at all for the property panel. The panel therefore showed empty fields for an element that was visibly coloured and bordered.

Reading the values back from the rendered element was rejected (considered and dropped in favour of the data model): an entity is a data container and the rendering layer turns it into pixels, so the panel must show the data, not the output of the rendering pipeline. Pixels are also the wrong source for the specifics: a 1.5 px border is reported as 1 px (Chromium snaps border widths to device pixels), a font is reported as a resolved family stack, and in light mode a rendered colour is already the converted one.

## Decision
- **The default look is defined once, as data,** in `src/renderer/src/styles/styleDefaults.ts`: per node type (entity, container, text), for edges, and for freeform lines. Opacity is 0 to 100 like the stored fields.
- **Everything reads that data.**
  - The panel shows the element's stored value, or the default for any field it leaves unset.
  - The CSS gets its values from custom properties (`--default-entity-fill` and so on) generated from the data and set on the document before the first paint and on every theme change (`applyDefaultStyleVars`, called from `useTheme`). The stylesheet keeps doing the painting, so large diagrams gain no inline styles.
  - `LabeledEdge` and `LineNode` import their defaults instead of keeping copies.
- **Colours stay in the stored form the panel already uses.** A stored colour is the dark-theme baseline and is flipped for display in light mode ([ADR 0034](0034-theme-adaptive-color-value-flip.md)); an unset colour shows the default for the current theme. Editing is unchanged.
- **The built-in light look is kept exactly as it was.** Defaults are therefore listed per theme (`{ dark, light }`) instead of deriving light from dark, because the shipped light values were hand-picked and deriving them would visibly change every default element in light mode. Making a default purely derived is a matter of removing its `light` entry. A freeform line's default is a single stored-form colour that the usual flip converts, as it always was.
- **Drift is guarded by tests.** The one place that still repeats a value, React Flow's fallback edge colour in `base.css`, is checked against the data by a test.

## Alternatives considered
- **Read the computed style of the rendered element.** Exact for the screen and needs no data, but it makes the panel depend on rendering quirks, does not give font or width as stored, and breaks the stored-form rule in light mode.
- **Constants applied inline by the renderer.** One source of truth too, but every node would carry inline styles, and deriving light from dark would change the shipped light look.
- **Write the defaults into each element's stored style when it is created.** Makes the panel trivially correct but turns defaults into data that has to be migrated whenever a default changes, and pollutes every `.chd` file.

## Consequences
- The built-in look can now be changed in one file and the panel, CSS and renderers follow.
- Verified in the packaged app: 51 of 52 measured properties of an unstyled entity, container, text node and edge are identical to before in both themes, and the panel shows the data defaults for each; the remaining difference was a flaw in the old baseline measurement.
- Fields without a built-in default stay blank on purpose (font family, routing), because blank already means "the default font" and "the default curve".
- Found while verifying: the theme flip is not exactly reversible for saturated colours, so a colour typed in light mode can come back changed (known-issues.md).
