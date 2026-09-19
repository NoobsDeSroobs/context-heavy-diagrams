# 0122: "Open parent" and backlinks ("Linked from")

## Status
Not Started — logged 2026-09-19. **Needs a real design pass before any
implementation** (user's words: "agreed, but needs a design pass").

## Goal
Links only point downward ([ADR 0005](../../decisions/0005-diagram-identity-and-linking.md)),
so a child diagram cannot tell who links to it, and a component reused under
several parents is invisible from the child. Give the *app* — not the file
format — awareness of the environment around a file: show "Linked from …" and
offer **Open parent**.

## Key constraint
The `.chd` format must **not** change: parent knowledge is a derived,
app-level index, never written into the file (would break the one-way-link
rule and make files depend on their location). It's a meta feature layered on
top because the app can see the folder around the file.

## The design question: how does the app discover parents?
- **Scan-based:** on demand, walk the containing folder tree (upward to a
  bounded root?) looking for `.chd` files whose `linkedDiagram` resolves to
  this file. Reuses the directory-bounded walk in `src/main/requiredTags.ts`
  and the side-effect-free crawl in `security.ts`. Needs a defined scan root
  (the file's parent dir? a user-set "workspace folder"?) and a cost cap.
- **Index-based:** remember who-opened-whom from Recent/last-opened
  history ([epic 0091](completed/0091-recent-diagrams-and-last-opened-path.md)).
  Cheap but incomplete and per-machine.
- Multiple parents → a list, not one "parent". Broken/moved links → nothing.

## Related
- [Epic 0123](0123-semantic-zoom-and-parent-context.md) (zoom out to see one
  level above) needs exactly this parent-resolution as a prerequisite.
- [Epic 0093](0093-drill-down-search-across-linked-diagrams.md) shares the
  tree-crawl machinery.

## Tasks
- [ ] Design pass + ADR (discovery strategy, scan root, cost cap, multiple parents)
- [ ] Side-effect-free `links:findParents` IPC
- [ ] "Linked from" list (property panel for the diagram / File or View menu) + Open parent
