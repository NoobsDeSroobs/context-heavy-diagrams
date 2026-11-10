# 0170: Style types are built from sister parts

## Status
Accepted (2026-11-11)
Supersedes: the `FontStyle` base type in [0014](0014-node-and-edge-style-schema.md); the rest of 0014 stands.
Superseded by: none

## Context
`NodeStyle` and `EdgeStyle` both extended `FontStyle`. That read as a parent type, was named after one of the things a style holds, and collided with CSS `font-style`.

## Decision
The style fields are grouped into parts that stand side by side, and the two styles are intersections of them (`src/shared/styling/schema.ts`):

- `TextStyle`: `fontSize`, `fontColor`, `fontWeight`, `fontFamily`, `fontOpacity`.
- `FillStyle`: `fill`, `fillOpacity`.
- `StrokeStyle`: `stroke`, `strokeOpacity`, `strokeWidth`, `lineStyle`.
- `LineEndsStyle`: `startMarker`, `endMarker`.

`NodeStyle` is the four parts plus `textAlign`. `EdgeStyle` is text, stroke and line ends plus the fields only an edge has (animation, dash, label position, routing). The JSON stays flat, so the file format does not change.

## Alternatives considered
- **Keep `FontStyle` and rename it.** Fixes the name, keeps the parent-and-child reading.
- **Nest the fields in the file** (`style.text.fontSize`). A format change with no gain for the people who write files, so not done here.
- **Interfaces extending several parts.** Same type, but the `extends` keyword brings back the parent reading.

## Consequences
A new field goes into the part it belongs to, and a feature that needs only one part can take that part as its type. Code that spelled out `FontStyle` has to use `TextStyle`.
