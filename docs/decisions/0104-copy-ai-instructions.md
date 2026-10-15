# 0104: "Copy AI instructions" — a small hand-written paste for chat assistants

## Status
Accepted (2026-10-15).

## Context
A user working in a chat window (Claude Desktop, claude.ai, any assistant with
no shell and no installed skill) can only give the AI knowledge by pasting it.
They need one click that puts the essentials on the clipboard.

## Decision
- **AI → Copy AI instructions** copies the text to the clipboard and shows the
  shared alert dialog with a short confirmation telling the user to paste it
  into their chat and attach or paste a `.chd`.
- **`showAlert(textToShow, textToCopy = textToShow)`.** The first version
  confirmed via `showAlert(message)`, whose dialog Copy button copies the
  *displayed message* — pressing it replaced the instructions on the clipboard
  with the confirmation text. Rather than a one-off dialog, the one shared
  alert dialog now takes two strings: what to show and what its Copy button
  copies. They are the same for every existing caller (the second argument is
  optional); this caller passes the confirmation and the instructions.
- The text is a constant, `AI_INSTRUCTIONS` in `src/shared/aiInstructions.ts`:
  a few hundred words covering structure, node/edge basics and the traps that
  actually corrupt files (parent-before-child ordering, the three coordinate
  systems, relative paths), plus a pointer to `docs/file-format.md` in the
  repository. A unit test guards those invariants and a size ceiling.
- **Small on purpose.** The full spec and skill are reachable via the repository
  once it is public; the paste does not try to replace them.
- No file is bundled or read at runtime for this — it is a string in the code.

## Alternatives considered
- **Generate the paste from `docs/file-format.md`.** Keeps it from drifting, but
  the full spec is far too long to paste, and extracting a "short version"
  automatically is brittle. Drift is instead covered by the standing rule to
  update the spec when the format changes, plus the test above for the key rules.
- **Paste the whole spec.** Large, and most of it (security, legend, gravity
  presets) is irrelevant to a first edit.
- **Embed a repository URL.** The repository is not public yet, so the text
  names the file path only; add the URL when it is.

## Consequences
- The text can go stale relative to the spec; changing coordinate, path or
  ordering rules in the format means touching `aiInstructions.ts` as well.
- Task groups C/D (bundled skill, `chd spec`) are separate and will have their
  own, fuller, bundled material.
