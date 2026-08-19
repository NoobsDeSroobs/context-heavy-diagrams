# 0008: Tool scope includes EA-adjacent diagram types, not just software architecture

## Status
Accepted

## Context
While scoping epic 0022 (example diagram gallery), the first proposal was to keep the tool's example set — and implicitly its ambition — limited to technical/software-architecture diagrams (C4-style: context/container/component), explicitly steering away from formal Enterprise Architecture (EA) concepts like business capability maps, motivation/goals modeling, and application portfolio views. The reasoning was that dedicated EA suites already own that space, and this tool's brief frames it as a lighter-weight alternative to Draw.io, not an EA suite.

That framing was wrong. The intent was never to replace or out-feature dedicated EA suites at their own game — structured metamodels, enforced relationship types, governance workflows. Those suites are fast and efficient at that specifically *because* they're narrow and rigid. The actual intent is a **free, flexible, purpose-built tool for architects** that can carry a team most of the way there — through business-capability-level thinking and other EA-adjacent concepts — until they have the size or maturity to justify adopting a dedicated EA suite. Flexibility, not formal notation, is the tool's actual competitive edge, and there's no principled reason that edge should stop at the software-architecture layer.

## Decision
The tool's scope explicitly includes EA-adjacent diagram types — business capability maps, motivation/goals views, application portfolio/rationalization views, and similar — as first-class intended use cases, not just software/technical architecture diagrams.

This does **not** mean adopting a formal EA metamodel: no ArchiMate-style enforced notation, no validated relationship types, no governance layer. That rigidity is exactly what a dedicated EA suite is for, and exactly what this tool's flexibility-first design exists to be an alternative to. It means the existing generic primitives — shapes, containers, styling/color, details, links — need to stay expressive enough to *approximate* EA views by hand, even without dedicated notation support for them.

Epic [0022](../planning/epics/0022-example-diagram-gallery.md) operationalizes this: a running gallery of one example per standard architecture/IT diagram type, EA-level and technical-level alike, used both to prove the tool can reach that far and to find out concretely where flexible generic primitives stop being enough.

## Alternatives considered
- **Stay strictly technical/software-architecture scoped** (the initially proposed direction): keeps positioning narrow and unambiguous, avoids ever being compared unfavorably against dedicated EA suites on their own turf. Rejected — it artificially caps a tool whose whole differentiator against both Draw.io (too generic) and commercial EA suites (too restrictive) is covering the middle ground, per the project brief's original framing.
- **Fully replicate a dedicated EA suite's structured approach** (formal ArchiMate-style notation, enforced/validated relationship types, a real metamodel): would make certain EA views more "correct" and internally consistent, but reintroduces exactly the rigidity/restrictiveness this tool exists to be an alternative to (see [project brief](../project-brief.md) and [docs/architecture/overview.md](../architecture/overview.md)). Rejected — out of scope indefinitely, not just deferred; the tool stays notation-agnostic by design.

## Consequences
- No new node types, schema fields, or enforced structure follow from this decision alone — EA-adjacent diagrams stay expressible through the same generic primitives as everything else, which is the point.
- Several EA-flavored diagram types (business capability heatmaps, application portfolio views) are currently awkward or blocked by not-yet-built features — containers (epic 0004) and fill/color styling (epic 0003) especially. This decision doesn't pull those epics forward by itself, but their priority should now account for how much EA-adjacent capability they unlock, not just technical-diagram polish.
- [docs/architecture/overview.md](../architecture/overview.md)'s "Purpose" section is updated alongside this ADR to reflect the broader ambition.
- If, in practice, approximating EA views with generic primitives turns out too manual or awkward — the concrete finding epic 0022 is designed to surface — that's a legitimate trigger to revisit this decision. This ADR records the current bet, not a permanent guarantee it pans out.
