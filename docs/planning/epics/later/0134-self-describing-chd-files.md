# 0134: Self-describing `.chd` files (a `$comment` pointer in every file)

## Status
Not Started — parked, logged 2026-10-15 from [epic 0133](../0133-ai-onboarding.md)'s design discussion. The user likes the problem it solves but isn't sold on the approach yet; deliberately on the back burner.

## Goal
Make any `.chd` file tell an AI that opens or receives it how to read it, so it works even in a chat with no shell, no skill, and no pasted instructions.

## Sketch (not decided)
A constant top-level `"$comment"` line, emitted first by the serializer, pointing at the spec (URL and/or `chd spec`), optionally with a 2–3 sentence summary of the mental model (coordinate systems, relative-path rule):

```json
{
  "$comment": "Context-heavy diagram (.chd), plain JSON. Spec: <url> — or run `chd spec`. AIs: read the spec before editing.",
  "version": 1,
  "nodes": [
```

## Notes / open questions
- `serializeDiagram` ([diagram.ts](../../../../src/shared/diagram.ts)) builds objects from a fixed key order and known fields, so the serializer must emit the constant itself — a hand-added `$comment` would otherwise be dropped on save. The loader only checks `version`/`nodes`/`edges`, so reading is already compatible.
- Cost: one line per file; must be a stable constant so diffs never show noise. Touches `docs/file-format.md` (optional, ignorable field).
- A URL only helps if the AI can fetch it — hence the other legs of epic 0133. Whether to embed a summary vs. just a pointer is open.
- Interacts with [epic 0115](../0115-file-app-version-compatibility-and-data-loss-safety.md) (unknown-field preservation / app-version stamping) — design the two together if this is picked up.
