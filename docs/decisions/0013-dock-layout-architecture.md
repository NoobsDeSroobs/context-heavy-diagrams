# 0013: Two-slot dock layout — diagram dock and utility dock

## Status
Accepted

## Context
Epic 0003 (styling panel) needs a UI surface for two things: a default item palette (add a shape/container/text) and, once something's selected, a context-sensitive property panel. Both need real screen space, and the existing precedent for "a panel on the side" — `DetailsPanel` (epic 0008) — is `position: fixed; right: 0`, a floating overlay that sits on top of the canvas and covers whatever's underneath it. It doesn't reflow anything; React Flow keeps rendering at full width behind it.

Discussing where the new panel(s) should live surfaced a real distinction, not just a styling preference: some right-side content is *part of the diagram's own editing surface* (styling a shape directly changes the diagram), and some is *about* the diagram but conceptually external to it (`DetailsPanel`'s markdown notes are data attached to a node, but the panel itself isn't a diagram-editing tool — closer to a reference document sitting next to the diagram than a control panel on top of it).

## Decision
**Two independent, collapsible dock slots, both zero-width when nothing occupies them:**

- **Diagram dock** — holds anything that's part of the diagram's own editing surface: epic 0003's item palette (nothing selected) and property panel (something selected). Structurally *nested inside* the diagram/canvas view, not a sibling of it — the canvas and this dock together form one composite view. This matters for a concrete reason: a future setting to move the dock to the left side of the canvas (or anywhere else that's naturally "a canvas-view setting") should only need to reconfigure that inner view's own layout, not the app's whole top-level structure.
- **Utility dock** — holds content that's about the diagram but not part of editing it directly: `DetailsPanel` today, and a slot future non-diagram-editing features can reuse without inventing a third pattern. Sits outside the diagram/canvas view entirely, at the outer layout level.

**Nesting, not flat stacking**: `[canvas [diagram dock]] [utility dock]`, left to right — not `[canvas][diagram dock][utility dock]` as three flat siblings. The canvas view (React Flow + diagram dock) is one composite component; the utility dock is a separate top-level sibling next to it. Opening the utility dock pushes the *entire canvas view* (canvas + diagram dock together) to the left; opening the diagram dock alone only affects the canvas view's own internal split, not the utility dock.

**Both slots are real flex layout, not overlays.** React Flow auto-resizes via `ResizeObserver` when its container's dimensions change, so shrinking the canvas view's width when the diagram dock opens is expected to just work — no manual viewport recalculation needed. This is a deliberate departure from `DetailsPanel`'s current fixed-overlay approach: `DetailsPanel` needs to be retrofitted into the utility dock slot as part of this work, so there's one panel-layout pattern in the codebase, not two.

**Width is per-slot-content, not a single fixed value.** The diagram dock's item-palette mode and property-panel mode don't need to be the same width — a palette of a few icons needs less room than a property panel with several collapsible sections and input fields. Each mode gets its own width; neither is user-resizable via a drag handle in v1 (consistent with this project's general preference for not building the adjustable/general case before it's actually asked for).

## Alternatives considered
- **Flat three-way stacking** (`[canvas][diagram dock][utility dock]` as equal siblings): rejected — doesn't capture that the diagram dock's positioning is conceptually a canvas-view concern (could move to the left, could theoretically become collapsible-to-icons-only, etc.) while the utility dock is an independent, outer-level concern. Flat stacking would make a future "move the diagram dock" setting awkwardly touch top-level app layout instead of just the canvas view's own internals.
- **Keep `DetailsPanel`'s fixed-overlay pattern for everything**: simpler (no resize/reflow concerns), but doesn't match the actual requirement — panels are meant to visually *push* content, not cover it, and a properties panel covering the very shape you're styling is a real usability problem, not just an aesthetic one.
- **One single dock slot for everything**: rejected — conflates two things that behave differently in practice (diagram-editing UI that should feel attached to the canvas vs. reference/utility UI that shouldn't), and forces an ordering choice (does styling or details "win" the one slot) that the two-slot model avoids needing at all.

## Consequences
- `DetailsPanel` needs a real (if probably small) refactor: from `position: fixed` to a flex child of the new utility dock container. Its own internal layout (toolbar + body) shouldn't need to change, just its outer positioning.
- A new composite "canvas view" component/wrapper is needed, containing React Flow and the diagram dock as flex children — `Canvas.tsx`'s current top-level render tree (`toolbar` + `ReactFlow` as direct children of one `100vw`/`100vh` div) needs restructuring to introduce this nesting.
- `IconPicker` and `ContextMenu` are unaffected — they're genuinely transient, click-triggered popups, not persistent panels, and stay `position: fixed` as they are today.
- Both docks being independently collapsible to zero width means the layout code needs to handle "neither open," "only diagram dock," "only utility dock," and "both" cleanly — four real states, not just an on/off toggle.
