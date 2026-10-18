# 0116: Deleting a container and its selected children

## Status
Accepted

## Context
[ADR 0012](0012-container-node-design.md) decided that deleting a container promotes its children instead of deleting them. That is a useful "unwrap this container" gesture, and it was implemented by stripping every cascaded child removal out of React Flow's delete.

React Flow's delete always cascades: the container, every descendant, and every edge touching any of them are removed together, and nothing in the removal says whether a child was selected or just swept up. The implementation therefore could not tell "unwrap this container" from "delete everything I selected", and a selection spanning a container and its own contents left the contents behind.

Reading the cascade also showed a side effect nobody had reported: the edges of the promoted children were part of the same removal, so unwrapping a container silently deleted the connections of every child that was supposed to survive.

## Decision
- **A deleted container's children are promoted, unless they were selected too.** Selecting only the container unwraps it. Selecting the container and all its contents deletes all of it. Selecting the container and some of its contents deletes the selected ones and promotes the rest.
- **The decision is made once, before the delete happens,** in React Flow's `onBeforeDelete` hook, by a pure function (`resolveDeletion`, `src/renderer/src/containerRemoval.ts`). A node is deleted when it is selected or is the top of the removal; an edge is deleted when it is selected or touches a node that is really being deleted. Promoted children therefore keep their edges.
- **Nested containers behave like any other child.** An unselected inner container is promoted together with its own contents, where before it was dissolved as well.
- `onNodesChange` no longer second-guesses the removal: a container's own removal is still replaced by reparenting its surviving children (unchanged from ADR 0012), and everything else passes through.

## Alternatives considered
- **Filter inside `onNodesChange`, as before, but spare selected children.** Fixes the node case but not the edges, and the filter is too late to separate edges that should survive.
- **Always delete children when they are selected, never promote.** Loses the unwrap gesture ADR 0012 wanted to keep.
- **A separate "ungroup container" command and plain deletion that always cascades.** Simpler rules, but a bigger change to how people already use the app.

## Consequences
- The rule is unit-tested without React Flow; the wiring (Delete key, cut) is only exercised in the running app.
- Behaviour change to be aware of: deleting a container no longer deletes the edges of its promoted children, and an unselected nested container now survives.
- Cut (`Ctrl+X`) inherits the same rule because it deletes through the same path.
