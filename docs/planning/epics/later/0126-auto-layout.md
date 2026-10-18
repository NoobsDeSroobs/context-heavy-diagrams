# 0126: Auto-layout / "tidy up" action

## Status
Not Started — parked, logged 2026-09-19. The user agrees with the concept but
is **not convinced it is doable without messing things up or becoming very
complex**; this stays parked until a narrow, low-risk shape is shown to be
workable. (Earlier scattered mentions: epics 0011, 0031, 0110.)

## Goal
Reposition elements from the connection graph (dagre/elk-style layered layout)
so bulk-created or LLM-authored diagrams (e.g. [epic 0118](../../completed-epics.md#0118-create-multiple-shapescontainers-from-a-pasted-text-list), or Claude
editing the `.chd` directly) don't need hand-arranging.

## What would have to be true (the bar to clear)
- **Explicit action only**, never implicit or on drag; **one undo step**.
- **Scoped to the selection** (or to newly created elements / one container's
  children), never the whole diagram by default — hand-laid diagrams must not
  be trashed.
- Respects locked elements, container parent/child bounds, rotation, fixed
  connection points, and manual waypoints (probably: clears waypoints on
  affected edges, or leaves them alone — undecided).
- **LLM-friendliness angle:** a pure layout function in `@shared/` that takes
  the parsed diagram and returns positions could be used by the app *and* by a
  script/skill ([epic 0110](0110-ai-assisted-diagram-reformat.md)), so an LLM
  doing bulk edits never needs the GUI. Argues for building it as a pure,
  file-level function, not an in-canvas interaction.

## Known risks
Container hierarchies; edges routed with waypoints; connection-point sides;
new dependency weight (elk is large; dagre is small but old); results that are
"correct" but not what the author wanted.
