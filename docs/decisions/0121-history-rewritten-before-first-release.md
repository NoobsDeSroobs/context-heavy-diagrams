# 0121: Git history rewritten once, before the first release

## Status
Accepted. Supersedes the "history is not rewritten" part of [ADR 0111](0111-open-source-release-approach.md); the rest of that ADR stands.

## Context
Before the repository was first shared, a review of the whole history found two things that the tracked files no longer contained but older commits still did:

- Content copied from a real system the author works with (an example diagram and its container labels, in an ADR and the project brief). The file names were fine to keep; the content was not.
- The author's personal email address, as commit author on most of the commits.

The repository had never been public, so a one-off rewrite was still cheap: nobody else had clones, forks or links to the old commit hashes.

## Decision
- **The history was rewritten once, keeping every commit.** Messages, dates and the commit order are unchanged. The removed content was generalised in the tracked tree first, then stripped from every older commit; the author address became the GitHub no-reply address.
- **The tip tree was not changed by the rewrite.** After the rewrite the tree at the tip of the release branch was byte-identical to the working tree before it.
- **It was done on a fresh clone and verified before the real repository was touched.** Every reachable commit was searched for each removed string (none left), the commit count was compared, and the tip tree was compared. Only then were the branches and the tag fetched into the real repository, and the old objects (reflog, stash, remote-tracking refs) expired so that garbage collection removed them.
- **This is a one-time exception, not a policy.** From the first push of the rewritten history on, history is not rewritten; ADR 0111's reasoning for keeping the commit trail stands.

## Alternatives considered
- **Leave the history and accept the exposure.** Rejected for the real-system content: it is not the author's to publish. The email would have been the smaller problem alone.
- **Squash to a single root commit.** Simplest to verify, but loses the commit trail that ADR 0111 wants to keep.
- **A fresh repository, with the history rewritten in place first.** Rejected on its own, since a fresh repository with the *old* history would carry the same problem. It turned out to be needed anyway, see the consequences.

## Consequences
- Every commit hash changed. No document in `docs/` refers to a hash, so nothing there needed fixing. Anyone holding a clone from before the rewrite must re-clone.
- **The hosting repository had to be recreated.** After the rewritten branches were force-pushed, the hosting site still held the old commits through its read-only `refs/pull/*` refs (one per earlier pull request), which a push cannot remove, and possibly in pull-request text. The repository was therefore recreated under the same name from the rewritten `master` alone, and the previous one was deleted. Pull requests, issues and their numbering did not carry over: the `PR #NNN` mentions in older docs and the `(#NNN)` in squash-merge commit titles refer to the former private repository and do not resolve in the current one.
- A rewrite on a repository that has pull requests is not finished until the pull refs are gone too; that is the lesson for any later clean-up.
- The committer on commits made through the hosting site's web interface is that site's own no-reply identity; that is not a personal address and was left as it is.
