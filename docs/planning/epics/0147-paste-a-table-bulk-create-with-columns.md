# 0147: Paste a table: bulk create with columns

## Status
Not Started. Logged 2026-10-21 from the [comparison with other tools](../../comparison.md). Sparse on purpose: to be reviewed and discussed before any decision to build it.

## Goal
Extend the existing bulk create (right-click an element, paste lines to create one element per line, [ADR 0089](../../decisions/0089-bulk-create-from-text-list.md)) so that a pasted table, for example copied from a spreadsheet or a CMDB export, creates elements with the extra columns as tags or metadata.

## Why
The comparison page lists "no connection to a CMDB, cloud accounts or ticket trackers". A lightweight answer is to make it easy to bring a list of applications or capabilities in with their owner, environment or status already attached, without any integration.

## Open questions
- How columns are mapped: first column is the label and the header row names the tag keys? Or a small mapping step after pasting?
- Tab-separated (from a spreadsheet) versus comma-separated; quoting.
- What happens to values that do not match a required tag's allowed values.
- One undo step for the whole paste.

## Related
[ADR 0089](../../decisions/0089-bulk-create-from-text-list.md).
