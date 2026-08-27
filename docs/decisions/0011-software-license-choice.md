# 0011: Software license — GPL-3.0-or-later, with dual-licensing kept open

## Status
Accepted

## Context
The project has no LICENSE file yet — `package.json` still carries no `license` field, and `docs/licensing.md` (which only covers redistributing third-party vendor icon packs) offhandedly assumes "eventually open-source" without ever deciding *which* open-source terms. The user's actual goal, stated directly: prevent someone from taking this codebase (or a fork of it) and turning it into a closed-source, for-profit product, while not otherwise restricting who can use or build on it.

That goal splits into two different things a license can do, and they're easy to conflate:
- **Copyleft** (GPL-family): anyone can use, modify, and redistribute — including commercially — but any distributed derivative must also ship its source under the same license. This blocks a closed-source fork specifically, not commercial use in general.
- **Non-commercial restriction** (e.g. PolyForm Noncommercial, or custom terms): blocks commercial/for-profit use by anyone but the copyright holder, full stop. Not an OSI-recognized "open source" license, and "commercial use" is notoriously hard to define cleanly (does a consultancy using it internally count? a company distributing it preinstalled?).
- **Source-available / delayed-open (BSL-style)**: blocks *competing* commercial use for a fixed window, then auto-converts to a permissive or copyleft license later.

Asked directly, the user chose copyleft — stay open source, allow commercial use, block closed-sourcing — over the stronger non-commercial route. They also want to keep the option to sell a separate proprietary/commercial license later (a common copyleft business model), which is legally straightforward right now because the user is the sole copyright holder — no contributor license agreement (CLA) is needed for that until/unless outside contributions are accepted (see Consequences).

## Decision
**License**: GPL-3.0-or-later. Full canonical text placed verbatim at [`LICENSE`](../../LICENSE) (fetched from `gnu.org`, not retyped, to avoid transcription drift in a legal document).

**GPL-3.0 over AGPL-3.0**: AGPL's one addition over GPL is a network-use clause — running a modified version as a network service still triggers source disclosure, even without distributing the binary. [The project brief](../project-brief.md) and [ADR 0008](0008-tool-scope-includes-ea-adjacent-diagrams.md) both describe this as offline, local, no-server, no-DB desktop software with no hosted/SaaS variant planned. AGPL's extra clause would be defending against a threat (someone wrapping it as a hosted service) that doesn't apply to the product as scoped. If that scope ever changes, revisit — this isn't a one-way door, just not needed for what exists today.

**`-or-later`** over pinning to GPL-3.0 exactly: standard FSF recommendation, gives the option to adopt a future GPL version without needing to relicense.

**`package.json`**: added `"license": "GPL-3.0-or-later"` (SPDX identifier).

**Dual licensing**: not a special legal mechanism, just a consequence of sole copyright ownership — the same code can be licensed to different parties under different terms simultaneously. Documented as an explicit intent (not yet formalized in any file — see Consequences) rather than assumed silently, so it isn't accidentally foreclosed later by e.g. uncritically accepting outside PRs under terms that assign rights away.

## Alternatives considered
- **Non-commercial license**: rejected — stronger than what the user actually wants (they're fine with others using it commercially, just not closed-sourcing it), and materially harder to define/enforce cleanly.
- **BSL / delayed-open**: rejected — adds a time-boxed proprietary window the user didn't ask for; GPL's "always open, always" is simpler and matches the stated goal directly.
- **MIT/Apache-2.0 (permissive)**: rejected outright early — permissive licenses impose no copyleft obligation at all, which is exactly what the user wants to prevent (nothing would stop a closed-source for-profit fork).
- **AGPL-3.0**: considered and rejected for now, see Decision — revisit only if a hosted/network variant ever gets scoped in.

## Consequences
- Anyone can legally build and sell a commercial product on top of this code, as long as they distribute their modified source under GPL-3.0-or-later too — this is intended, not a gap.
- The dual-licensing intent isn't yet backed by any actual paperwork or file — no CONTRIBUTING.md, no CLA, no explicit "commercial licensing available, contact X" notice anywhere. Fine as long as the user is the only contributor; becomes a real gap the moment an outside PR is merged without a CLA, since that contributor's copyright share can't be relicensed on their behalf. Flagged as a task in the app branding-and-licensing work, not resolved by this ADR.
- No per-file copyright/license header has been added across the existing codebase — the FSF's own GPL guidance recommends one short notice per source file. Mechanical, touches most files, tracked as a separate task rather than done as part of this decision.
- `docs/licensing.md`'s vendor-icon-pack notes are unaffected by this decision — that's about redistributing *third-party* icon assets under *their* terms, a separate question from this codebase's own license.
