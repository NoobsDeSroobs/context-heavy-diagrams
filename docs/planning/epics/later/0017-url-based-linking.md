# 0017: URL-based cross-repo linking (speculative, distant)

## Status
Not Started — speculative, no committed timeline

## Goal
Let a linked-diagram path be a URL instead of a local relative path, so different teams could maintain diagrams in separate repos and still link them together. Raised as a "heck, if we get far enough" idea during epic 0015's design discussion, not a near-term goal.

## Notes
Real architectural appeal (emerges naturally from ADR 0005's "a link is just a path" model), but in real tension with the brief's "local, offline, no server" framing, and a much bigger undertaking than anything else on the backlog (fetching, caching, trust/security of remote content). Worth revisiting only if the tool gets far enough for that tension to be worth resolving — not scoped or planned for now.
