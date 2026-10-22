# 0130: A diagram-wide default font, and the installed fonts as choices

## Status
Accepted. Applies the fallback pattern of [ADR 0052](0052-settings-ownership-tiers.md) to the font, and extends [ADR 0117](0117-built-in-style-defaults-are-data.md)'s chain of defaults.

## Context
A font could only be set element by element. An element with none was drawn in the app's built-in stack, which names fonts the app does not ship, so the same diagram looks different on each computer. Picking a font meant typing a CSS value into the Style Palette first.

## Decision
- **One font for the whole diagram.** `fontFamily` is a new optional top-level field of the `.chd` file (`docs/file-format.md`), a raw CSS font-family value like the element field. An element's own `fontFamily` still wins.
- **Three tiers.** The diagram's font, else a personal default in Preferences (`defaultFontFamily`), else the built-in font. The personal default applies live to any open diagram without its own font.
- **Applied with a CSS variable.** The canvas sets `--diagram-font-family`; the stylesheet puts it on the React Flow viewport, so nodes, edge labels and the PNG export inherit it, while the zoom controls and minimap keep the app's font. A font change re-renders no node. The SVG and command-line export read the field from the diagram and use the personal default when the app exports.
- **The property panel shows what is inherited.** An element with no font of its own reads "Default (Georgia)" rather than "Default".
- **Installed fonts are offered**, in an "Installed on this computer" group of every font dropdown (element, diagram, Preferences), read once per window with `queryLocalFonts` and sorted by family. The call works with the permission handler of [ADR 0112](0112-electron-hardening-sandbox-and-navigation.md) unchanged.
- **A font picked by name is stored as a stack**: the quoted name plus a generic family guessed from the name (monospace, serif or sans-serif), e.g. `'Georgia', serif`. A computer without the font then draws something close.

## Alternatives considered
- **One font per kind of element.** More control, three fields instead of one; the per-type default style already covers the need, and a per-kind field can be added without breaking files.
- **Bundle a curated set of fonts.** Identical everywhere, but adds installer size and a license check per font, and the fonts people expect (Segoe UI, Arial) cannot be bundled. Left for later; it does not conflict with this.
- **Store the bare name.** A machine without the font falls back to the browser default, which can change a diagram's look sharply.
- **A searchable list instead of a `<select>`.** The native select jumps to a font by typing its first letters; a custom combobox is a larger piece of UI for a modest gain.

## Consequences
- The file format gains one optional field; an older app ignores it.
- A diagram that uses an installed font can look different on a computer without it. The stack's fallback limits the difference; there is no warning in Diagnostics yet.
- The guess of the generic family is a name heuristic, so an unusual font name may get the wrong fallback; editing the stored value in the Style Palette still works.
- The legend popup and the app's own interface keep the app's font; only the diagram is affected.
- `queryLocalFonts` is verified on Windows. On Linux and macOS the list may be empty (the group is then absent) or need a permission; nothing else depends on it.
