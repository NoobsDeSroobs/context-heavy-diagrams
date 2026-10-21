# 0149: A hollow triangle edge marker

## Status
Not Started. Logged 2026-10-21. Sparse on purpose: small, and mainly a prerequisite for [epic 0148](0148-archimate-flavoured-vocabulary-kit.md).

## Goal
Add a hollow (unfilled) triangle as an edge end marker, the conventional end for realisation and specialisation (UML generalisation, ArchiMate realisation).

## What exists
Edge markers today include open and closed arrows, circles, diamonds (open and filled) and crow's foot ends (`src/renderer/src/edges/markerIds.ts`). Whether the existing closed arrow can be drawn unfilled is to be checked first; if it can, this may need no new marker.

## Open questions
- A new `MarkerKind` is an additive change to the `.chd` format: `docs/file-format.md`, the file version warning and the AI instructions must be updated, and older apps meet an unknown marker (see the standing rule on backward-compatible loading, [ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md)).
- The marker must follow the edge colour and theme like the others.
