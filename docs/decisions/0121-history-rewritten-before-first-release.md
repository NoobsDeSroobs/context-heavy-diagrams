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
- **A fresh repository.** Same loss of trail, and it would also lose issue and PR numbering on the hosting site.

## Consequences
- Every commit hash changed. No document in `docs/` refers to a hash, so nothing there needed fixing. Anyone holding a clone from before the rewrite must re-clone.
- `PR #NNN` references in older docs stay valid only if the hosting repository is kept; the hosting site may also keep the old commits reachable through its own PR refs and cached SHAs until the repository is recreated or the old refs are removed there. That part is outside this repository.
- The committer on commits made through the hosting site's web interface is that site's own no-reply identity; that is not a personal address and was left as it is.
