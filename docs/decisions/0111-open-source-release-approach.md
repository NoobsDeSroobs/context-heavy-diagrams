# 0111: Open-source release approach — this repo, docs included, early-adopter, 0.x

## Status
Accepted. The "history is not rewritten" part is superseded by [ADR 0121](0121-history-rewritten-before-first-release.md).

## Context
A demo prompted the first outside request for access, which made the open-source release concrete. Earlier plans assumed a curated fresh repo under a new identity, a published installer, and 1.0.0 as the public-release version number ([ADR 0044](0044-app-versioning-scheme.md)). On review, several of those assumptions no longer hold:

- The project's own planning docs, ADRs and known-issues log are the best explanation of why the code is the way it is. A contributor, or their AI assistant, can answer "why is it like this?" from them. A curated repo would drop exactly that.
- Maintaining a private working repo plus a public curated snapshot means mirroring on every change, with no process to do it.
- The author wants to release the project as open source, not as a finished product.

## Decision
- **The public repository is this repository**, history and `docs/` included. There is no curated clone and no second repo to keep in sync. The hosting account stays as it is and the repository is not migrated: the current state is simply labelled the **first open-source release**. The existing GitHub handle is therefore public, which the author has accepted. (History was first planned to stay as it was; it was cleaned once before the first share, see [ADR 0121](0121-history-rewritten-before-first-release.md).)
- **It is released as an early-adopter, work-in-progress project.** No installers, signing or auto-update are published; early adopters build from source, and the README says so. A packaged release is a later, separate step.
- **The version stays 0.x.** 1.0.0 means the author considers the tool feature-complete to their vision — not "first public release". Going open source is a 0.x event (see the addendum on ADR 0044).
- **The product name is Context Heavy Diagrams.** The "(Preview)" suffix is dropped; the 0.x version already signals early status.
- **Security and privacy items must be done before the repository goes public**, and a networking pass that *enforces* offline behaviour (not only audits for it) is part of that.
- **The author keeps full authority over licensing.** The goal is to stop others from abusing or taking the project; the author is not interested in commercialising it but wants to be able to change the license later. Contributors contribute on the understanding that they gain no rights beyond the public license unless the author explicitly grants them. A DCO is not enough for that; the mechanism chosen is a stated contribution grant with a pull-request checkbox rather than a signed agreement (see the addenda to [ADR 0011](0011-software-license-choice.md)).
- **AI use is disclosed** in the README: AI wrote a large share of the code, especially the frontend and the visible side, under the author's direction.

## Alternatives considered
- **Curated fresh repo, no history, `docs/` left out.** Rejected: loses the project's memory and adds a sync burden.
- **Curated fresh repo with `docs/` included.** Rejected: keeps the sync burden and loses the commit trail, which records *how* things were built.
- **Publish installers and treat the first release as 1.0.0.** Rejected: the project is explicitly unfinished and Linux/macOS builds are unverified.

## Consequences
- `docs/` is public: it needed a pass for anything that should not be, `CLAUDE.md` had to be split into contributor conventions and user-specific rules, and `PROGRESS.md` had to become a short status. All three were done (2026-10-18), the personal rules moving to a git-ignored `CLAUDE.local.md`.
- All commits are kept (with the one-time clean-up in ADR 0121), so the commit trail survives. Commit hashes changed, and the hosting repository was recreated, so `PR #NNN` mentions in older docs refer to the former private repository and do not resolve.
- Part of the code is AI-written, which has a legal side; the notes are in [docs/licensing.md](../licensing.md). Not a blocker.
- The README must be honest about platform status (Windows tested; Linux and macOS not).
- Packaging, code signing and auto-update are deferred; the unused `electron-updater` dependency and the placeholder `publish` block can go if auto-update stays off.
