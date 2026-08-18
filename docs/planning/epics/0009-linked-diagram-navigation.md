# 0009: Linked-diagram navigation

## Status
Not Started

## Goal
Ctrl/Cmd+click on a node navigates into a linked diagram (a drill-down view), resolved via an explicit relative path stored on the node — see [docs/decisions/0005-diagram-identity-and-linking.md](../../decisions/0005-diagram-identity-and-linking.md) for the identity/linking model this builds on. Distinct trigger from the detail sublayer — both can exist on the same node.

## Tasks
- [ ] Ctrl/Cmd+click handler on nodes, distinct from plain click (select) and right-click (details)
- [ ] Creating a *new* linked diagram from a node with none yet: default the new file's name to a sanitized version of that node's current label text
- [ ] Linking to an *existing* diagram instead: let the user browse to or type a path directly — no new file created
- [ ] Resolve the node's linked-diagram path and load it
- [ ] Graceful missing-link handling: following a link whose target file doesn't exist shows a clear "linked diagram not found at `<path>`" error — never a silent failure or crash. The diagram containing the broken link must still open and work fine on its own.
- [ ] Some way back to the parent diagram (breadcrumb / back navigation)

## Notes
Links only ever point downward (parent → child), never back up — this is what makes any diagram independently openable as its own root, per ADR 0005. Nothing here needs to know or care whether the diagram it's in is "the" top-level one or a branch partway down a tree.
