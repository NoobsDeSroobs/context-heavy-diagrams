# 0103: A top-level "AI" menu, gated by an `aiFeaturesEnabled` preference

## Status
Accepted (2026-10-15).

## Context
The app needs a home for the helpers that let a non-technical user work with
Claude or a similar assistant on their diagrams: copying instructions for a
chat, bootstrapping a folder for an agent, installing a CLI/extension. Several
such items are planned, and the user should be able to find them without being
told they exist — and to hide them entirely if they don't want AI features.

## Decision
- A **top-level menu labelled "AI"**, placed between View and Help
  (File · Edit · View · AI · Help). It is built in `Canvas.tsx` alongside the
  other menus, so its leaves flatten into the command palette for free
  ([ADR 0100](0100-command-palette-reuses-the-menu-bar.md)).
- Visibility is controlled by an **app preference, `aiFeaturesEnabled`**
  (default `true`, in `AppPreferences`), toggled from the Preferences panel.
  The Windows installer seeds it from an "enable AI features?" question
  ([ADR 0108](0108-chd-file-association-and-single-instance.md)); that is why
  it is a preference rather than a build flag. Being a preference, it
  follows the standing "seeded with defaults at every boundary" rule via
  `normalizePreferences`.
- The preference is **chrome only**. Nothing in a `.chd` file or in the
  diagram model depends on it, so turning it off can never affect round-tripping.
- Auto-arrange is deliberately **not** in this menu: it is a general app
  feature and belongs under Edit next to Align / Distribute.
- A menu with no items is omitted rather than rendered empty; each task group
  of the AI-onboarding work appends its items.

## Alternatives considered
- **Under Help** — least discoverable; the whole point is that a new user finds it.
- **Under Edit or View** — neither has a natural slot (Edit mutates the
  document, View toggles panels).
- **A build/installer-time flag only** — can't be changed later by the user,
  and a hidden menu would have no way back.
- **Label "Assistant"** — less searchable; users look for "AI".

## Consequences
- One more top-level menu; harmless on narrow windows (five short labels).
- The preference gates *UI*, not capability: the CLI and any files the app
  has already written into a folder keep working with the menu hidden.
