# Authoring guide: linking, colocation, and keeping a diagram set healthy

This covers what happens *between* files — how multiple `.chd` files relate to each other on disk — which the field reference doesn't get into.

## The relative-path rule, in full

Every relative path in the format — `data.icons.*.path` (custom icons), `data.details`, `data.linkedDiagram`, `data.references` entries — resolves **relative to the directory containing the `.chd` file that holds the reference**. Not the project root. Not the diagram that originally "owned" the node. Not wherever the value happens to look like it came from.

Stored paths use forward slashes; a writer should always emit forward slashes (for portability across host OSes), and a reader should tolerate backslashes in older or hand-edited files but never write them.

### Worked example of the failure mode

This is a real bug found in this tool's first production diagram set (a set of linked Azure architecture diagrams), reconstructed here because it's the single most likely way a hand edit or a copy-paste breaks a diagram:

```
Project/
  Overview.chd                        ← parent diagram
  Overview/
    assets/icon.svg
    Sub.chd                           ← child diagram, linked from Overview.chd
```

In `Overview.chd`, a node correctly references the icon as:
```json
{ "source": "custom", "path": "Overview/assets/icon.svg" }
```
— relative to `Project/` (where `Overview.chd` lives), this resolves to `Project/Overview/assets/icon.svg`. Correct.

That node then gets copied into `Sub.chd` (a common step when splitting a growing diagram into a linked child). If the path string is copied verbatim:
```json
{ "source": "custom", "path": "Overview/assets/icon.svg" }
```
— relative to `Project/Overview/` (where `Sub.chd` lives), this now resolves to `Project/Overview/Overview/assets/icon.svg`, which doesn't exist. The icon silently fails to render; nothing errors, because missing targets are expected to be recoverable (see below).

**The fix** is to drop the now-redundant leading segment — from `Sub.chd`'s perspective the same asset is one level up:
```json
{ "source": "custom", "path": "../assets/icon.svg" }
```
or, if the child diagram should have its own colocated copy of the asset instead of sharing the parent's, copy the file too and point at `Sub/assets/icon.svg` (relative to `Sub.chd`'s own location).

**The general rule when moving or copying a node between files**: never trust a path string that was written for a different file's location. Recompute it — take the target's real absolute location, take the *new* file's real absolute location, and derive the relative path between them fresh. `data.details` and `data.linkedDiagram` are exactly as vulnerable to this as icon paths; check all three whenever a node crosses files.

### How to check for this

The bundled `scripts/validate_chd.mjs` resolves every relative path in a file against that file's own directory and reports any that don't exist on disk. Run it on every `.chd` file you touch, and on any file that links to one you moved — a parent's `linkedDiagram` pointing at a child you relocated breaks the same way.

## Colocation folders

By default, this app puts a diagram's own custom icons, reference images, detail notes, and newly-created linked diagrams into a sibling folder named after the diagram file: `my-diagram.chd` gets `my-diagram/assets/logo.svg`, `my-diagram/assets/references/screenshot.png`, `my-diagram/details/<label>-<uuid>.md`, and `my-diagram/<label>.chd` for a freshly-created child link.

This folder is a **convention for creating new assets**, never a requirement and never detected by name — the stored path on the node is what actually matters. A diagram with no custom icons/details/references/links has no such folder at all. Nothing stops a `linkedDiagram` from pointing anywhere on disk: outside the colocation folder, outside the parent diagram's directory tree entirely, or on another drive — the format has no notion of an enclosing project or repo boundary.

Filenames within the folder follow conventions too (`<label>-<uuid-suffix>.md` for details, `<label>.chd` for a newly-created link) but a reader should never rely on the naming pattern to *find* a reference — only the stored path is authoritative.

## Linked diagrams: directionality and missing targets

- **Links only point downward**, parent → child. A child diagram never references its own parent. This is what makes every `.chd` file independently openable as its own root — don't add a "back to parent" link even if it would help navigation; that's not what this field is for.
- **A missing link target is a recoverable error, not a hard failure**: the app shows "linked diagram not found at `<path>`" and the diagram containing the broken reference keeps working normally. This is deliberate — it's what makes it safe to share a parent diagram without all its children, or to have a child diagram temporarily deleted mid-restructure. Detail-file references get the same treatment.
- When auditing a multi-diagram project, `scripts/validate_chd.mjs` walks every `linkedDiagram` it finds and reports which targets don't resolve — useful for a project with several linked files, since a broken link in a child several levels down is easy to miss just by opening the top-level file (the app never eagerly loads children).

## Tags aren't visible or useful until something renders them — set up highlights and a legend in the same pass

Declaring `requiredTags` (and populating `metadata` on nodes/edges to match) is only half the job. Two things routinely get skipped by an LLM authoring a diagram from scratch, both caught the same way — a human opens the file and finds the tagging invisible/unexplained even though it's technically all there:

- **Add a `highlights` entry for every value actually in use**, not just declare the tag. A tag with no matching `highlights` entry has nothing to toggle on — the data exists in `metadata` but is inert until a highlight exists for that exact key/value pair (see [field-reference.md](field-reference.md#highlights)). Do this in the same pass as assigning the tag values, not as a follow-up — it's easy to forget once the structural part (nodes, edges, requiredTags) feels "done." If a value you introduce isn't already covered by an existing highlight, add one; don't leave it dark.
- **Add a `legend` entry for anything a reader can't already infer from the label alone** — most concretely, the line/arrow convention itself. "Variance" isn't the bar: even a diagram with exactly one edge style throughout still needs a legend entry saying what that line *means* (e.g. "Request / data flow"), the same way a single un-labeled arrow on a whiteboard would prompt "what does this arrow mean?" Don't reason "nothing varies yet, so nothing needs explaining" — a reader who's never seen the diagram doesn't get that context for free.

## Metadata that varies by data-in-motion belongs on edges too, not just nodes

A classification/risk tag (GDPR sensitivity is the clearest example) describes data, and data moves *between* things at least as much as it sits *inside* them — an edge is exactly where that shows up. `metadata` is available on Edge with the same shape/rules as Node metadata (see [field-reference.md](field-reference.md#metadata)) — use it. Concretely: don't stop at tagging the shapes a piece of data touches and leave every edge at its `requiredTags` default (`No PII`/whatever the template's `defaultValue` is) — look at what actually flows over each specific integration and tag it deliberately, the same way you'd reason about a shape. A load balancer forwarding a request carrying session data is a different GDPR fact than a DNS lookup or a static-asset fetch, even though both might be edges leaving the same node.

This compounds with the previous section: an edge's tag is exactly as inert as a node's without a matching highlight, and it's exactly as unexplained without a legend entry for what the edge itself represents.

*(Both lessons came from the same real pass, 2026-09-05, authoring `examples/gallery/landscape/meridian-rail-landscape-layered/` in this app's own repo — every edge had been left at its auto-backfilled tag default, and neither new file had `highlights` or a `legend` set up, both caught by the user opening the files in-app.)*

## Git and large assets

The `.chd` file itself is deterministic JSON by design (fixed key order, no inline binaries — see [field-reference.md](field-reference.md#determinism--versioning)) specifically so it's git-friendly: diffs show real changes, not reformatting noise. Files under a colocation folder (`assets/*` especially) are ordinary binary/text files with no special handling — if a repo accumulates many or large custom icons, [Git LFS](https://git-lfs.com/) tracking `*.svg`/`*.png` under those folders is a reasonable, standard way to keep the repo light. The tool has no opinion on this either way; it never touches git directly.

## Quick checklist for a multi-file diagram project

When asked to audit, extend, or restructure a project with several linked `.chd` files:

1. Run `scripts/validate_chd.mjs` on every `.chd` file in the tree, not just the one you're editing — a change to one file's location or a copy-paste into another is exactly what breaks a sibling's relative paths.
2. Confirm link direction only ever goes parent → child; flag (don't silently "fix") anything that looks like an intentional child → parent reference, since that may indicate a misunderstanding of what the field is for rather than a bug.
3. If nodes were copied between files, re-derive every relative path on the copy rather than assuming it survived the move.
4. Leave viewport, highlight-enabled-state, and legend-shown-state alone — none of these exist in the file in the first place, so there's nothing to "restore."
