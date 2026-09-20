# 0121: Copy style / "format painter" apply mode

## Status
Not Started — logged 2026-09-19. Direction agreed; needs a design pass on
mode entry and hotkey.

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

## Open design questions
- **Entering the mode:** a paintbrush button in the property panel, plus a
  hotkey. Word-style variant: single click = one-shot, double click = sticky.
- **Hotkey:** candidates Ctrl+Shift+C / Ctrl+Shift+V (Word convention; but
  Ctrl+Shift+C is DevTools "inspect" in Chromium if dev menus are on) or
  Ctrl+Alt+C / Ctrl+Alt+V (Google Docs; **but Ctrl+Alt is AltGr on many
  European layouts**, e.g. Nordic — risky). Check the existing set in
  `Canvas.tsx` and register through [epic 0120](0120-help-keyboard-shortcuts-page.md)'s command registry.
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
- [ ] Design pass + ADR (fields copied, palette refs, mode entry, hotkey)
- [ ] Pure `extractStyle` / `applyStyle` per element type (in a testable module)
- [ ] Mode state + cursor + Esc handling in `Canvas.tsx`
- [ ] Property panel entry point; hotkey via the command registry
