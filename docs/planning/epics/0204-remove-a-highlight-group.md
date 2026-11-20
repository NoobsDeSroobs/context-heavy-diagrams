# 0204: Remove a highlight group

## Status
Not Started. Logged 2026-11-20, from using the app.

## Goal
Let a person delete a whole group in the Highlights panel. Today the group's header has a collapse caret, a tri-state checkbox and a resync button, and no way to remove it.

## Why removing the rows is not enough
Each row of a group has a cross, but a group keeps itself in sync with its key ([ADR 0026](../../decisions/0026-grouped-highlights.md), addendum): a removed row of a required tag comes back from its allowed values, and one of a free tag comes back while the value is in use. So the group cannot be taken apart by hand.

## Tasks
- [ ] A cross on the group header that removes every highlight of the key.
- [ ] Decide what "removed" means for the automatic resync: a key with no group is never created by it ([ADR 0026](../../decisions/0026-grouped-highlights.md)), so removing the group should end it until the person adds the group again; check that this is how the code behaves, and test it.
- [ ] A test, and a line in the changelog.
