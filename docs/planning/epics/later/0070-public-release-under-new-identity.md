# 0070: Public release under a new GitHub identity, as a curated fresh repo

## Status
Not Started — not yet scoped. Raised by the user (2026-08-23), decided in direction (new account, fresh curated repo, not a fork/mirror of this one) but not in concrete detail. Logged so it isn't lost, not scheduled into the current batch (see [PROGRESS.md](../../../../PROGRESS.md)).

## Goal
Publish this project publicly, decoupled from the user's existing GitHub account — which mixes many abandoned exploratory projects and is tied to their gaming/online nickname — under a new account created for professional distance. The new repo is a hand-picked, fresh-history export of "the important parts," not a fork or history-preserving mirror of this repo.

## Why a fresh repo, not a fork/mirror
This repo's own `docs/planning/` and `docs/decisions/` are written for this Claude Code collaboration, not a public audience — candid about half-finished ideas, naming struggles, who's receiving a test build, unresolved product-direction questions (see [epic 0060](../completed/0060-threat-risk-matrix.md)'s naming notes for a concrete example). Carrying this repo's git history into the new one would mean either scrubbing that history after the fact (destructive, error-prone) or publishing it as-is (not what the user wants). A fresh initial commit, hand-picking only intended files, sidesteps that entirely — and incidentally does a lot of [epic 0068](../0068-privacy-and-security-pass-before-public-release.md)'s job for free, since only current file contents matter, not anything that ever existed in history.

## Real open questions (deliberately not resolved here)
- **What ships.** At minimum `src/`, `LICENSE`, a rewritten `package.json` (today's `author: "example.com"` and `homepage: "https://electron-vite.org"` are stale electron-vite template defaults, never updated), and a new `README.md` — the current one links directly to `docs/planning/`, `docs/decisions/`, and `PROGRESS.md`, none of which are meant to ship as-is. Whether any `docs/` content ships at all (e.g. a public-facing rewrite of `docs/architecture/overview.md`, or `docs/file-format.md` since it's already deliberately written for third-party importers) isn't decided.
- **Relationship to epic 0068 (privacy/security pass).** Likely folds together or runs immediately before this — the unused Mac entitlements, `sandbox: false`, CSP re-check, and outbound-network-call check all matter more once the code is actually public.
- **Relationship to epic 0027 (branding/naming).** Naming is still blocked on [epic 0060](../completed/0060-threat-risk-matrix.md)'s "does this belong in this app" question. This epic doesn't require a final name to proceed — the existing Phase 1 placeholder approach (epic 0053) can carry over — but a new account/repo is also a natural moment to reconsider whether to wait for a real name first. Not decided.
- **Ongoing sync.** Once live, this becomes two repos: this one (full working history, where Claude Code sessions actually happen) and the new public one (curated snapshot). No process decided yet for keeping the public copy current after the first push — could be manual, could be a script, could be "update it every N epics" rather than continuously.
- **Whether the new account creates it, or the user's existing account creates it and transfers ownership.** GitHub supports both; not decided. Account creation and any account-level actions (org/repo creation under a new login) are the user's own to do — outside what Claude can perform.

## Notes
Prompted directly by a conversation about export/cleanup work (epic 0010), not itself part of that epic. The user confirmed a password manager makes a second set of credentials a non-issue, so account-management overhead isn't a blocker to this direction.
