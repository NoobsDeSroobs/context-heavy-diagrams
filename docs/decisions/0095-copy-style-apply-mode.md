# 0095: Copy style / apply mode ("format painter")

## Status
Decided and implemented (2026-09-20). Typecheck/lint/unit tests pass; not live-tested (Electron renderer).

## Context

Styling one element and matching it on many others meant re-setting fill, stroke, thickness and font on each through the property panel. The wanted gesture is Word's format painter: style one element, then click others to give them the same look.

## Decision

**A mode holding a snapshot, not a reference.** Entering the mode captures the source element's *stored* style into a `StyleBrush` (`src/renderer/src/styleBrush.ts`, pure and unit-tested). It must be a snapshot: clicking a target changes the selection, so a brush that pointed at "the selected element" would lose its source on the first apply. Storing the stored values (never the theme-flipped display values, ADR 0034) means the copy is correct in either theme. The brush is session-only Canvas state.

**Entry and exit.**
- *Copy style* button at the top of the property panel when exactly one element that can be a source is selected (shape, container, text, line, or an edge); while the mode is on, the same button reads "Stop applying style" for any selection. A toolbar reminder ("Applying style — click a shape · Stop (Esc)") shows while it's on, so there is always a visible way out even with nothing selected.
- **Ctrl/Cmd+Shift+C** toggles the mode from the current single selection; **Esc** exits (last in the Escape chain, after popups and panels, before deselecting). Both register through the command registry (ADR 0094), on the Word convention. `Ctrl+Alt+C/V` (Google Docs) was rejected: Ctrl+Alt is AltGr on many European layouts. `edit.copy`/`edit.paste` now require Shift to be absent so the shifted forms are unambiguous (a unit test guards against overlapping bindings).

**Applying.** While the mode is on, a plain click on an element of the **same type** applies the brush (shape→shape, container→container, text→text, line→line, edge→edge); any other click just selects as usual, and the cursor shows the same/other split (copy vs not-allowed). Ctrl/Cmd+click (follow link) and Shift+click (multi-select) never paint. **Ctrl/Cmd+Shift+V** applies the brush to every currently selected element of the matching type at once. One undo step per application, however many elements it touched.

**What is copied.**
- Nodes: the whole `data.style` bag, replacing the target's — every `NodeStyle` field is visual (fill, stroke, widths, opacities, font, alignment; for lines also line style and markers). Fields the source leaves unset are cleared on the target, so it ends up matching, not a blend. Never label, size, position, rotation, tags, details, links, security data.
- Edges: `EdgeStyle` (stroke, width, opacity, line style, markers, font) **except** `labelPosition` and `routingStyle`, which the target keeps. Never endpoints, bend points, direction sets or tags. (`routingStyle: 'catmullRom'` is only meaningful together with the edge's own bend points, which are not copied; a `step`-routed target shouldn't silently become bezier because the source was.)

## Alternatives considered

- **Palette references instead of values:** there are none to copy — style colours are stored as raw values (a palette only supplies swatches, ADR 0074-era), so a palette edit never propagated to existing elements in the first place.
- **One-shot single click / sticky double click (Word):** deferred. The agreed behaviour was a mode with an explicit exit; a one-shot variant can be added without changing the brush.
- **Copying routing style:** rejected above; easy to add to the copied set later if wanted.
- **Toolbar/dock-only entry (no hotkey):** the hotkey is cheap through the registry and the GUI entry exists regardless.

## Consequences

- No `.chd` schema change; applying is ordinary `data.style` / edge `data.style` edits, so undo, dirty tracking and save need nothing new.
- Ctrl+Shift+C may collide with Chromium's "inspect element" shortcut when DevTools is enabled in a dev build; not observed as a problem in the packaged app but flagged for the Linux/Windows live test.
- A mismatched click is silent (cursor hint only); there's no "wrong type" message.
- Applying a brush that equals the target's current style still records an undo step.
- The brush survives loading another diagram in the same window (styles are plain values); Esc/Stop ends it.
