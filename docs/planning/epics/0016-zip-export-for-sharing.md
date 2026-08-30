# 0016: Zip export for sharing

## Status
Not Started

## Goal
Export a diagram (and, if present, its linked children) as a single zipped bundle — for the case a diagram *does* have attachments or linked children and needs to be shared as one artifact anyway. Raised alongside epic 0015's design discussion as the "best of both worlds" complement: single files stay easily shareable in the simple case, zip export covers the rest.

## Tasks
(Not broken down yet — revisit once epic 0015 lands, since this walks the same link graph.)
- [ ] Walk the downward link graph from a chosen diagram, collecting every file it (transitively) references
- [ ] Zip them into one archive, preserving relative paths so the result still opens correctly once unzipped
- [ ] Decide how deep to follow: everything reachable, or a chosen depth
- [ ] If [epic 0104](0104-central-custom-icon-library.md) lands first: an option to fold every referenced central custom icon into the zip (in a conventional subfolder) so the recipient gets a self-contained bundle — design the two together.
