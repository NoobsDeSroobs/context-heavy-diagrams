# 0160: README and documentation changes from outside feedback

## Status
Not Started. Do it when the first installers are close, since the target audience below cannot use the tool before then.

## Goal
Change the README, the website copy and the docs so that a first-time reader sees what sets the tool apart, in claims that match the software. The points come from a reader's overview of the tool, vetted against what it actually does.

## Changes to make
1. **Lead with progressive disclosure.** Today it is one quote at the bottom of the feature list ([ADR 0054](../../decisions/0054-progressive-disclosure-for-advanced-features.md)). Say near the top that a new diagram is plain boxes and arrows, that tags, links, notes and the command line are opt-in, and that a non-technical person can draw a flow without touching them. Describe it as plain boxes and arrows, not as a Draw.io replacement.
2. **Make tag perspectives a headline.** One diagram, then colour it by GDPR, NIS2, owning team or state, one highlight at a time. This is the showcase demo and sits mid-page today. Say "highlights recolour the elements"; it does not switch layouts. Avoid "compliance" as a promise: the tool shows the tags, it certifies nothing.
3. **Present AI work as draft, then review.** Add a sample prompt for turning existing text material into a diagram, and tie it to the compare window and `chd diff` for reviewing what the assistant changed. Keep the warning that what an assistant reads goes to its provider. The extension reads text files only (no images or PDFs), so state which sources work.
4. **Say why layout is manual.** Positions are the human's job and the file keeps them stable in git. Say it as a design stance and also say plainly that a diagram an assistant generates needs a person to tidy the layout.
5. **A short, factual list for regulated settings.** Offline enforced by a test, a standalone format spec so there is no lock-in, `chd diff` and `chd check` in CI, the review window, and the licence. No "enterprise-grade", and no claim about C4 checks: the shipped profiles are hexagonal and data-flow.
6. **A new intro paragraph** that carries points 1 to 3 in two or three sentences.

## Do not claim
- "Draw.io alternative" or "fully brandable".
- C4 validation (not shipped as a profile).
- Automated migration or automatic compliance tagging.
- "Air-gapped" next to the AI features without the data warning.
- "Enterprise-grade" while the release is 0.x, built mainly on Windows, unsigned and without an installer.

## Tasks
- [ ] Rewrite the README intro and move the opt-in line and the tag-perspective demo up
- [ ] Add the "AI draft, then review" section with a sample prompt, and point `docs/architecture/ai-integration.md` and the getting-started guide at it
- [ ] Add the manual-layout stance to the README or the comparison page
- [ ] Add the short regulated-settings list
- [ ] Check each new sentence against the software before it goes in
- [ ] Reuse the wording for the website
- [ ] Revisit the README's install section when the installers exist ([0161](0161-published-windows-installers-built-by-ci.md))
- [ ] Link the manual-layout stance to the parked [auto-layout](later/0126-auto-layout.md) epic, so the two do not contradict each other

## Notes
Raised after a reader's overview of the tool. Its claims about C4 checks, automated migration and "enterprise" use did not match the software and are listed above as things not to say. The reader knew installers are planned; the missing installer is the largest barrier for the non-technical audience and is tracked outside this epic.
