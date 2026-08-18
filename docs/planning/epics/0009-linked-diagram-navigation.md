# 0009: Linked-diagram navigation

## Status
Not Started

## Goal
Ctrl/Cmd+click on a node navigates into a separate `diagram.json` (a drill-down view), resolved via a relative path stored on the node. Distinct trigger from the detail sublayer — both can exist on the same node.

## Tasks
- [ ] Ctrl/Cmd+click handler on nodes, distinct from plain click (select) and right-click (details)
- [ ] Resolve the node's `linkedDiagram` relative path and load that `diagram.json`
- [ ] Some way back to the parent diagram (breadcrumb / back navigation)
