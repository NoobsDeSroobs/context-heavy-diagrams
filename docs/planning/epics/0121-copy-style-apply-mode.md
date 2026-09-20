# 0121: Copy style / "format painter" apply mode

## Status
Implemented 2026-09-20 on `epic/0121-copy-style-apply-mode`
([ADR 0095](../../decisions/0095-copy-style-apply-mode.md)); `typecheck`/`lint`/`npm test`
clean, **not live-tested** (Electron renderer; Linux/Mac unverified). Logged
2026-09-19; direction agreed then, design pass done in the ADR.

## Goal
Style one shape, edge, or container the way you want, then **apply that style
by clicking other elements of the same type**, instead of re-setting fill /
stroke / thickness / font on each one through the property panel.

## Agreed behaviour
- Source = the current selection (one element). Apply targets **only accept
  the same type** (shape→shape, container→container, edge→edge); a mismatched
  click does nothing (cursor hints it).
- A *mode*: after entering it, each click on a matching element applies the
  style; exit with Esc / clicking the button again. One undo step per applied
  element.

## Open design questions (resolved — see ADR 0095)
- **Entering the mode:** a paintbrush button in the property panel, plus a
  hotkey. Word-style variant: single click = one-shot, double click = sticky.
- **Hotkey:** candidates Ctrl+Shift+C / Ctrl+Shift+V (Word convention; but
  Ctrl+Shift+C is DevTools "inspect" in Chromium if dev menus are on) or
  Ctrl+Alt+C / Ctrl+Alt+V (Google Docs; **but Ctrl+Alt is AltGr on many
  European layouts**, e.g. Nordic — risky). Check the existing set in
  `Canvas.tsx` and register through [epic 0120](completed/0120-help-keyboard-shortcuts-page.md)'s command registry.
  A GUI entry point must exist regardless of hotkey.
- **Which fields:** fill, stroke, thickness, line style, font/size/colour;
  *not* label, size, position, tags, details, links, security data. For edges:
  style only — not endpoints, routing waypoints or direction sets.
- **Palette references vs values:** if the source uses a named palette entry
  ([ADR 0074-era palettes](completed/0074-multiple-named-style-palettes.md)),
  copy the reference (so a palette edit still propagates) or the resolved
  values? Probably reference-when-present.
- **Theme-adaptive colour flip** ([ADR 0034](../../decisions/0034-theme-adaptive-color-value-flip.md)):
  copy the *stored* values, never the theme-flipped display values.
- A multi-selection as target ("Paste style" to all selected at once) is a
  cheap addition of the same code path.

## Tasks
- [x] Design pass + ADR (fields copied, palette refs, mode entry, hotkey)
- [x] Pure capture/apply per element type (`src/renderer/src/styleBrush.ts`, 9 unit tests)
- [x] Mode state + cursor + Esc handling in `Canvas.tsx`
- [x] Property panel entry point + toolbar reminder; Ctrl/Cmd+Shift+C / +V via the command registry
- [ ] Live test: Copy style on a shape → click other shapes (fill/stroke/font match, label/size/tags untouched), a container/edge click is ignored; same for edge→edge; Ctrl/Cmd+Shift+V onto a multi-selection; one Ctrl+Z per apply; Esc / Stop / button exit; cursor hint; both themes; on Linux check Ctrl+Shift+C is not swallowed by DevTools
