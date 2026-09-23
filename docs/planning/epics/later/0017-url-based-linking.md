# 0017: URL-based cross-repo linking (design workbook, parked)

## Status
Not Started — **parked design workbook**. No committed timeline, and no commitment to build it. The point of this file is to keep the design thinking so it can be iterated on until the feature is warranted and the design is trusted. Do not treat the Tasks section as a plan.

## Goal
Let a linked diagram live in a *different repo* from the diagram that links to it, so ownership of documentation follows ownership of implementation and operation: a team owns its repo's diagrams, and other teams link to them instead of re-drawing them.

Motivating scenario: a solution architect looks at an overview diagram of all business domains and asks "does any domain hold GDPR-sensitive data?". Each domain links to that domain's master diagram of services, and each service links on to its own sub-diagrams, owned by the service team. The answer comes from rolling up the live tree, so the overview cannot go stale and nothing is maintained by hand twice.

## Why it's parked
Very large (fetch, cache, auth, trust, coverage-aware aggregation), in real tension with the brief's "local, offline, no server" framing (see [ADR 0005](../../../decisions/0005-diagram-identity-and-linking.md)), and not clearly wanted at this stage of the product. Revisit when the local feature set is settled and there is a concrete org that wants it.

## Model (working assumptions)
- **Within a repo:** links are relative to the linking diagram, as today. Unchanged.
- **Between repos:** the link is a URL-style reference. Links still only point downward (ADR 0005), so every diagram stays independently openable as a root.
- **Remote content is read-only.** Search, open, view and follow links, but never edit. Ownership lies with the owning team's repo; the tool never writes to it.
- **Docs live in the code repo they describe.** Splitting code and docs into separate repos makes them drift and get neglected, so that is the recommended default and not something the tool should encourage.

## Design threads

### Link identity
- Prefer a structured reference `{ repo, ref, path }` over a raw web URL. A GitHub/GitLab blob URL is provider-specific and mixes ref into the path. The UI could accept a pasted blob URL and convert it.
- Identity is host + org + repo, **not** the transport scheme. One user has SSH keys, another an HTTPS token; both must resolve the same link. Shelling out to `git` honours the user's own `url.<base>.insteadOf` config for free.
- Canonical identity for cycle/duplicate detection is repo + ref + path. The same repo at two refs is two snapshots (fine, but visible).
- The path in a link is a public contract: if the owning team moves the file, every parent link across the org breaks. Open question whether a small per-repo manifest naming a stable entry diagram is worth it, so files can move internally. This is governance as much as tooling.

### Fetching (leading option, unproven)
- Shallow, partial, sparse git fetch into the app's cache dir (`app.getPath`), e.g. `--depth 1 --filter=blob:none --sparse`, checking out only the diagram folder. Keeps fetches small and avoids pulling source the tool doesn't need. Does not change access, which stays repo-level.
- **Use the user's own `git` and credentials.** The app never stores a token and needs no per-provider auth code. Costs: git must be installed; credential managers vary by person and OS.
- Run git **non-interactively** (`GIT_TERMINAL_PROMPT=0`, plus whatever suppresses GUI credential-helper prompts). Any auth failure degrades to "unreachable" (below) with a hint (e.g. run `git ls-remote <url>` once in a terminal to prime the credential helper). Must be verified on both Windows and Linux with more than one credential helper — flag for the user to test.
- A fetched repo acts as a **mounted root**: relative links inside it (children, icons, images, details `.md`) resolve within that snapshot, so the resolver must generalise from a directory to a location. Anything escaping the repo root (`..`, absolute paths) is rejected. Remote content is untrusted: sanitise details markdown and don't auto-load remote images.
- Rejected on this path: a plain per-file HTTP downloader. It breaks relative children, needs per-provider auth, and stores credentials — the hard parts, without the leverage git gives.
- Also rejected as the main route: relying on local clones of linked repos. An architect rolling up dozens of repos won't have them cloned. A local clone could still be an *optional later override* for authors who want to see a sibling repo's uncommitted changes.

### Freshness
- Check **per repo, not per file**: `git ls-remote` on the ref, compare to the cached SHA, fetch only if changed.
- Revalidate on open and on an explicit **Refresh all**; debounce repeat checks of the same repo in a session. No fixed timer.
- Rollups run **cache-first**: show results immediately with per-repo "as of" timestamps, refresh in the background. Needs concurrency, progress and cancel for large trees.
- Offline: use the stale cache with a clear badge.
- A link may pin a tag/SHA (immutable, never stale) or track a branch (current, but can change under you). Per-link choice; default probably the branch.
- Compatible with [ADR 0088](../../../decisions/0088-recursive-security-matrix-rollup.md)'s "derived values are computed live, never persisted": the fetch cache holds source files only.

### Tri-state coverage (the false-negative problem)
A rollup or search over a tree that can't be fully read must never report a confident "no". Evaluation is per node, in this order, and composes upward (Kleene OR), so each domain gets its own result:

1. **Any match found → True.** Unreadable subtrees are irrelevant once a match exists.
2. **No match, but one or more subtrees were unreadable → Unknown**, with a counter and a list.
3. **No match and everything was read → False.**

Notes:
- "Unreadable" is not a user-defined boundary. It is the boundary that **emerges from real obstacles**: no access, repo/file not found (404), offline/unreachable, auth failure. The tool doesn't create boundaries; it reports where its own view ends. Group the Unknown list by reason and owning repo.
- Accepting that these boundaries exist means the **process** must include checking those unreachable repos outside the tool. The Unknown list is the worklist for that ("request access to / ask the owner of these").
- Universal questions ("are *all* services classified?") invert the order: any False is decisive, otherwise unknown propagates.
- Numeric rollups (e.g. max threat score) with unreadable subtrees become bounds ("at least N"), not a plain N.
- **This gap already exists locally**: ADR 0088's crawl turns a broken link deeper in a subtree into a warning and lets that shape contribute nothing, so today's rollup can already give a confident-looking miss. Tri-state could be retrofitted to the local crawl and search predicate ([ADR 0096](../../../decisions/0096-search-facets-and-shared-match-predicate.md)) independently of any URL work, and may be worth doing first.

### Access
- Value scales with what the reader can see. Read access is not write access, so an org can grant broad read on diagram-owning repos without exposing production write paths. The tool can't fix this and doesn't try; it can only report the limit honestly (tri-state above).
- Teams that genuinely can't open their repo: the least-bad option is a **CI-generated, one-way mirror** of the diagram folder into a readable repo — a build artifact, not a second source of truth, so it can't drift the way hand-copying would. A per-team process choice, not tool functionality.
- Repo-level access is the only granularity git offers; sparse checkout does not narrow it.

## Open questions
- Is a single git provider per org a safe assumption, and is git + a credential manager normal for the intended users? (Assumed mostly yes, not guaranteed.)
- How common will "Unknown" be in a real org? Depends entirely on that org's read-access policy — needs a real org to test against.
- Stable-entry-file convention / manifest, or is the path-as-contract acceptable?
- Repo size: is shallow+sparse enough, or do large repos need more?
- Where does the tri-state result surface in the UI (search facets, matrix, a coverage banner)?
- Does the resolver refactor (directory → location) touch icons, reference images, details and required-tag propagation, all of which share `resolveLinkPath` ([src/main/linkPaths.ts](../../../../src/main/linkPaths.ts))?

## Tasks
Deliberately empty — nothing here is scheduled. When the feature is warranted, expect roughly this order, to be replanned then:
- [ ] ADR: cross-repo link identity, git-based fetch/cache, read-only remote content
- [ ] ADR: tri-state coverage for search and rollups (may ship first, locally, on its own)
- [ ] Update `docs/file-format.md` for the new link type when `src/shared/diagram.ts` changes

## Notes
- Origin: first raised as a "heck, if we get far enough" idea during epic 0015's design discussion; recorded in ADR 0005. Expanded here after a design discussion (2026-09-22) that settled the model above but deliberately committed to nothing.
- Nothing in this workbook is an accepted decision; write ADRs only if and when the feature is picked up.
