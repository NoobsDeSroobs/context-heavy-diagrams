# 0209: An edge dropped on empty canvas gets an automatic end, and CI stops on push to master

## Status
In Progress (implemented; waiting for the check in the app and the branch-protection look on GitHub)

## Goal
Two small fixes. The entity made by dropping an edge on empty canvas attaches itself to the side that faces the other element instead of always the left point. The CI checks no longer run a second time on the merge commit after a pull request has passed them.

## Tasks

### Automatic end on the new entity
- [x] New ADR that supersedes the line in [ADR 0178](../../decisions/0178-edge-ends-with-no-connection-point-attach-themselves.md) saying a drop on empty canvas makes an entity "with a fixed end"; mark 0178 as partly superseded. ([ADR 0200](../../decisions/0200-a-drop-on-empty-canvas-makes-an-entity-with-an-automatic-end.md); 0107's left-point note points to it too.)
- [x] `spawnEntityAt` callers in `Canvas.tsx`: leave the new entity's handle out (no `'left'`) in `onConnectEnd` and in `onReconnectEnd`. The end the person dragged from keeps its handle. (`edgeDrop.ts`: the end is `null`, as "Attach automatically" writes it.)
- [x] Check what else assumes the `'left'` handle: nothing else did. `ensureDirectionSets` stores the live handles and takes `null`; the dashed preview line is made while dragging, before the entity exists.
- [x] Tests: `edgeDrop.test.ts` covers both drop paths (new end has no handle, the other end keeps its own). No existing test assumed `'left'`.
- [x] Changelog entry under 0.16.0; the `automatic-attachment.chd` row in `examples/README.md` names the drop (a gesture, so no new diagram).
- [ ] Try both drops in the app: drag an edge out onto empty canvas, and drag one end of an existing edge out, each to the left, right, above and below.

### CI on push to master
- [x] `.github/workflows/ci.yml`: remove the `push: branches: [master]` trigger; keep `pull_request` and the weekly `schedule` (it is what catches a new advisory against a shipped dependency when nobody pushes). Fix the header comment, which says every push to master.
- [ ] Check that nothing else relies on that run: `release.yml` starts from a tag and `installer.yml` by hand, so neither does (checked); look at the repository's branch protection and badges on GitHub (the maintainer's, on the remote).
- [x] Look for docs that say CI runs on every push to master and correct them. (None did.)

## Notes
- A pull request's checks run on the branch, not on the result of merging it into a master that has moved since, so a conflict between two pull requests merged close together reaches master untested until the next pull request or the weekly run. Accepted for a one-person project; run `npm run lint`, `npm run build` and `npm test` on master after merging when it matters, or add a `workflow_dispatch` trigger to `ci.yml` if running it from the Actions tab turns out to be wanted.
