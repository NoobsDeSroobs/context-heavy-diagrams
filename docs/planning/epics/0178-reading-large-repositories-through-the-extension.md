# 0178: Reading large repositories through the extension

## Status
Not Started. Logged 2026-11-06; follows [0177](0177-fewer-tokens-for-assistant-diagramming.md) and the opening of reads to every file type ([ADR 0110](../../decisions/0110-claude-desktop-extension.md)).

## Goal
Design how an assistant finds and reads the right files in a folder that holds a whole repository, without a listing or a read that is too large to use. Design first; the build comes after the design is settled.

## Why
Once any file can be read, the folder can be a repository. In the C4 run on the Immich repository (see 0177) `list_files` cost about 12–14k tokens, listed 90 locale files and 35 database schemas, and was cut off at 300 files before `server/` and `web/` appeared. The listing is flat, alphabetical and capped by file count, with no filter, no paging and no folder view. A repository also easily passes the 5 MB limit, for one read or for a listing, and a single large file read in full is mostly wasted context.

## What the assistant needs (to be confirmed by trying it)
- To see the shape of the tree before any file names: the folders, with how many files and bytes each holds.
- To narrow by folder, by extension, by name pattern, by size.
- To page through a result that does not fit, and to be told what was left out.
- To find a file by content, not only by name.
- To read part of a large file, not all of it.

## Questions to settle first
- **Listing.** A folder view (immediate children with counts and sizes, then go down one level at a time) against a flat list with filters. Likely both, with the folder view as the first call. Filters: extension, name pattern, size, subfolder (`subfolder` already exists). Sort order. Paging with a cursor or with offset and limit.
- **What the limit counts.** Files, bytes of the answer, or an estimate of tokens; today it is 300 files and a 5 MB read. The server cannot count tokens, so bytes is the likely unit. What the 5 MB read limit means for a text file against a binary one (base64 adds a third).
- **Ignore rules.** Which folders are skipped by default (today dot-folders and `node_modules`; a repository also has `dist`, `build`, virtual environments, vendored code, generated files). Whether to read `.gitignore`, which the dot-file rule of ADR 0110 forbids opening, so that needs a decision of its own.
- **Search.** File names only, or content too (grep-like, results as path, line and a short excerpt). The extension may not start other programs (ADR 0110), so content search has to be in-process; what that costs on a large tree and how to bound it.
- **Reading part of a file.** A line or byte range on `read_file`, and a note in the answer when a file was cut. How that fits the fingerprint of ADR 0109, which is the hash of the whole file.
- **Tool surface.** New tools or new arguments on `list_files` and `read_file`. Every added tool is more description for the assistant to read on every conversation, which is the cost 0177 is about.
- **The command line.** Whether `chd` gets the same listing and search, as the checks are shared ([0166](../completed-epics.md#0166-the-mcp-server-and-the-command-line-share-their-checks)); an agent with a shell has `ls` and `grep`, so this may be extension-only.

## Tasks
A first set was built after the Immich trial in [0165](../completed-epics.md#0165-an-editing-tool-for-assistants): `search_files` in process ([ADR 0149](../../decisions/0149-the-extension-searches-file-text-in-process.md)), `list_files` with a folder view, a glob and paging, and `read_file` by line range. The questions above are open only where this set leaves them: ignore rules beyond dot-folders and `node_modules`, what a limit should count (bytes of the answer rather than files), and the command line.

- [ ] Measure two or three real repositories: files per folder, sizes, how many are generated or vendored
- [ ] Try a few real tasks by hand against the current tools and note where the assistant gets lost
- [ ] Settle the questions above and write the design
- [ ] ADR for the listing, search and ranged read
- [x] Build it, with tests for the limits, the paging and the folder rules (first set)
- [ ] Re-run the Immich C4 task and compare tokens and misses with the numbers in 0177

## Notes
Raised after the C4 run on the Immich repository. The first change that opened reads to every file type added only a `subfolder` argument to `list_files`; the rest was postponed to this epic.
