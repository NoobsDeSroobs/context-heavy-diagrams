# 0079: Mode-aware (persona-aware) menu bar

## Status

Accepted (2026-08-31). Implements [epic 0080](../planning/epics/0080-mode-aware-menu-bar.md).
Builds on [ADR 0039](0039-top-menu-bar.md) (custom menu bar), [ADR 0055](0055-security-data-lives-on-diagram-elements.md)
(the Diagram / Security Matrix persona split), and [ADR 0078](0078-recent-diagrams-menu.md)
(the submenu infra this could have used but didn't need yet).

> Numbering note: this is **ADR 0079**, unrelated to **epic 0079** (security
> data as an element property). The two share the security/matrix problem
> area but not the topic — ADR and epic numbers are independent sequences.

## Context

The top menu bar (`Canvas.tsx`'s `menus` array → `MenuBar`) showed the same
File / Edit / View / Help regardless of which persona was active. In the
Security Matrix persona most of it is meaningless — the whole Edit menu
(undo/cut/copy operate on the diagram graph), the diagram-only View panels
(Layers, Diagnostics, Style Palette, Diagram settings, References), the
toolbar's default-edge-style swatch.

The Security Matrix persona is still a **render-only prototype**
([ADR 0055](0055-security-data-lives-on-diagram-elements.md)) — its
calculation-mode selects and "Manage matrix…" button are local state inside
`ThreatMatrixView`, not Canvas-level actions. Real matrix-specific menus need
the persisted data model that **epic 0079** will build; there's nothing solid
to hang them on yet.

## Decision

### Hide, don't rebuild — for now

The matrix persona's menu bar is the diagram one **minus** what doesn't apply:

| Menu | Diagram                                                                            | Matrix                          |
| ---- | ---------------------------------------------------------------------------------- | ------------------------------- |
| File | New · Open · Recent · Save · Save As · **Export as PNG** · Reload · Close          | same, **without Export as PNG** |
| Edit | Undo/Redo/Cut/Copy/Paste/Align                                                     | _(hidden entirely)_             |
| View | Diagnostics · Layers · References · Style Palette · Diagram settings · Preferences | **Preferences only**            |
| Help | About                                                                              | About                           |

File basics (open/save/close/reload) are deliberately identical — a `.chd` is
one file behind both views, and the user's call was to keep them the same on
both sides. **Export as PNG** is the one File difference: exporting the matrix
as an image may make sense later but isn't built, so it's diagram-only for
now rather than shipped half-done.

No "Matrix" menu yet. It gets added when epic 0079 gives the matrix real
state to act on (calculation modes, threat-catalog management, and — the user
flagged this as coming sooner than later — matrix styling).

### Mechanism: composed lists, not per-item flags

`Canvas.tsx` builds `fileMenu` / `editMenu` / `viewMenu` / `helpMenu` as
named locals and assembles the final array per persona
(`isDiagramPersona ? [file, edit, view, help] : [file, view, help]`), with
the two within-menu differences (Export as PNG, the View item list) done with
a plain conditional. `MenuBar` stays dumb — no persona knowledge, no
filtering. Rejected a per-`MenuBarItem` `personas?: Persona[]` flag: it
spreads persona logic across every item definition and pushes filtering into
the shared component, for a divergence small enough that a top-level
conditional reads better.

### Switching to matrix closes diagram-only dock panels

`handlePersonaChange` (replacing the bare `setPersona` on the toolbar
`<select>`) closes Details / Diagnostics / Layers / Style Palette / Align-
Distribute / Diagram-settings / References and the edge-style picker when
switching to matrix, so a panel opened in the diagram view isn't left
floating over a persona whose menu no longer offers to open it. Preferences
is left alone — it's global and valid in both. Done in the handler, not a
`useEffect` (the `react-hooks/set-state-in-effect` rule, and it's a cleaner
place for it anyway). The utility dock itself isn't hidden in matrix mode —
what the matrix persona's full chrome should be is an epic-0079-era question,
out of scope here.

## Consequences

- No `.chd` / preferences change — pure UI composition.
- `MenuBarItem` was untouched by this ADR (it gained `title` under
  [ADR 0078](0078-recent-diagrams-menu.md), used here only incidentally via
  the Recent Diagrams submenu).
- When epic 0079 lands, expect a new "Matrix" menu and possibly Save/Export
  behaviour that spans both personas — the composed-list mechanism absorbs
  that without a rework.
