# 0124: Feature toggle system (enable/disable less-used or advanced features per user)

## Status
Not Started — idea bucket, logged 2026-09-19. Raised by the user as "a great
idea" while discussing whether to add an outline/table view
([epic 0125](0125-outline-and-table-view.md)) that might only appeal to some users.

## Goal
Let each user turn advanced or rarely-used features on/off (Preferences tier —
[glossary](../../../architecture/glossary.md)), so the base app stays lean for
everyone and heavy features (security matrix, isolate, outline view, …) don't
add noise for people who never use them. Extends
[ADR 0054](../../../decisions/0054-progressive-disclosure-for-advanced-features.md)
from "a fresh diagram never gets harder" to "the *app chrome* never gets
harder either."

## Open questions
- What is a "feature" — a menu entry, a dock panel, a mode, a palette category?
- Off = hidden UI only, or also inert data (a diagram containing security data
  opened by a user with that feature off must still round-trip losslessly — cf.
  [epic 0115](../../completed-epics.md#0115-fileapp-version-compatibility-and-data-loss-safety)).
- Registry-based (features declare themselves) vs scattered `if (pref)` checks.
  Same registry idea as [epic 0120](../../completed-epics.md#0120-help--keyboard-shortcuts--gestures-page).
- Should new features default on or off?
