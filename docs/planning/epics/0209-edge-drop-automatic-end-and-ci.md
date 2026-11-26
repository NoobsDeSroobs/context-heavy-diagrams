# 0209: An edge dropped on empty canvas gets an automatic end, and CI stops on push to master

## Status
Not Started

## Goal
Two small fixes. The entity made by dropping an edge on empty canvas attaches itself to the side that faces the other element instead of always the left point. The CI checks no longer run a second time on the merge commit after a pull request has passed them.

## Tasks

### Automatic end on the new entity
- [ ] New ADR that supersedes the line in [ADR 0178](../../decisions/0178-edge-ends-with-no-connection-point-attach-themselves.md) saying a drop on empty canvas makes an entity "with a fixed end"; mark 0178 as partly superseded.
- [ ] `spawnEntityAt` callers in `Canvas.tsx`: leave the new entity's handle out (no `'left'`) in `onConnectEnd` and in `onReconnectEnd`. The end the person dragged from keeps its handle.
- [ ] Check what else assumes the `'left'` handle: tests, `ensureDirectionSets` with two or more direction sets, the dashed preview line.
- [ ] Update the existing tests; add one for each of the two drop paths that checks the new end has no handle and the other end keeps its own.
- [ ] Changelog entry under the next version; extend an example under `examples/` if one shows edge drops ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)).

### CI on push to master
- [ ] `.github/workflows/ci.yml`: remove the `push: branches: [master]` trigger; keep `pull_request` and the weekly `schedule` (it is what catches a new advisory against a shipped dependency when nobody pushes). Fix the header comment, which says every push to master.
- [ ] Check that nothing else relies on that run: `release.yml` starts from a tag and `installer.yml` by hand, so neither does; look at the repository's branch protection and badges on GitHub.
- [ ] Look for docs that say CI runs on every push to master and correct them.

## Notes
- A pull request's checks run on the branch, not on the result of merging it into a master that has moved since, so a conflict between two pull requests merged close together reaches master untested until the next pull request or the weekly run. Accepted for a one-person project; run `npm run lint`, `npm run build` and `npm test` on master after merging when it matters, or add a `workflow_dispatch` trigger to `ci.yml` if running it from the Actions tab turns out to be wanted.
