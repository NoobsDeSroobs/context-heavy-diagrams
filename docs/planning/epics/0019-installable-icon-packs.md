# 0019: Installable vendor icon packs

## Status
Not Started — blocked

## Goal
Let the user install additional icon packs (AWS, Azure, GCP, etc.) beyond the built-in generic set from epic 0007, referenced via a third `source: "installed"` kind on `IconRef` (see [ADR 0006](../../decisions/0006-icon-storage-model.md), which deliberately left room for this).

## Blocked on
Licensing/redistribution terms for vendor icon packs — see [docs/licensing.md](../../licensing.md). Not an engineering blocker; needs the user to contact AWS/Azure/GCP etc. directly. Don't start this epic before that's resolved.
