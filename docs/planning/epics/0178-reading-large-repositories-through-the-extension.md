# 0178: Reading large repositories through the extension

## Status
In Progress: a first set is built (see Tasks); the measurements are done and a design is proposed below, to be confirmed. Logged 2026-11-06; follows [0177](0177-fewer-tokens-for-assistant-diagramming.md) and the opening of reads to every file type ([ADR 0110](../../decisions/0110-claude-desktop-extension.md)).

## Goal
Design how an assistant finds and reads the right files in a folder that holds a whole repository, without a listing or a read that is too large to use. Design first; the build comes after the design is settled.

## Why
Once any file can be read, the folder can be a repository. In the C4 run on the Immich repository (see 0177) `list_files` cost about 12–14k tokens, listed 90 locale files and 35 database schemas, and was cut off at 300 files before `server/` and `web/` appeared. The listing is flat, alphabetical and capped by file count, with no filter, no paging and no folder view. A repository also easily passes the 5 MB limit, for one read or for a listing, and a single large file read in full is mostly wasted context.

## Measured (2026-11-14)
What `list_files` sees, with today's rules (dot entries and `node_modules` skipped):

| Folder | Files | Of which under build or vendor folders | Notes |
|---|---|---|---|
| Immich | 3,547 | 116 | 185 MB is images and test assets; 17 files over 5 MB; 1,249 files in `mobile/`; folders of 70-105 files (`i18n`, migrations, services, changelogs) |
| This repository | 6,198 | 5,359 (`out/`, `dist/`) | all of it ignored by git |
| A web shop (Astro) | 1,120 | 968 (`dist/`) | 934 hashed images in one folder |
| A Godot game | 245 | 0 | 3 files over 5 MB |
| A Rust workspace (several crates) | 104,178 | 78,599 (`target/`) | passes the 50,000-file walk cap, so the listing is cut off by the cap before the source |

- A flat page of 300 files is 36,000-39,000 characters (about 10k tokens), about 120 characters a file; `modified` is 30 of them. The folder view of the same tree is 1,100-2,200 characters, so it is already the cheap first call.
- Build output is the usual noise: on three of five trees most files are in a folder git already ignores, and the alphabetical page ends before `src/`. Every one of those folders is named in `.gitignore`.
- The 300-file page and 50,000-file cap are not the problem; what the walk lets in is.

## Proposed design (to confirm)
- **Ignore rules: read `.gitignore`** (the root file and nested ones) in the server, only to decide what to list and search. The content is never returned and no dot-file becomes readable, so the dot-file rule of [ADR 0110](../../decisions/0110-claude-desktop-extension.md) keeps its purpose; it needs its own ADR, since it is a change to that rule. Ignored folders are not walked (fast on a huge tree) and are named in the answer, so the assistant knows what is left out. A `subfolder` inside an ignored folder lists it, and `read_file` by path is unchanged: only discovery narrows. `node_modules` and dot entries stay skipped with or without git. Use the `ignore` package (MIT, no dependencies, already in the tree through ESLint) rather than a hand-made matcher.
- **No fixed list of build folder names** (`dist`, `target`, ...): a folder without git is rare for a repository, and a name list guesses wrong (`bin` holds scripts).
- **Smaller entries:** drop `modified` and say `writable` only when true; default page 100 files (maximum stays 300). The unit stays files, not bytes: the server cannot count tokens and a file entry is almost constant in size.
- **Search** shares the same rules, as it reads what `list_files` lists ([ADR 0149](../../decisions/0149-the-extension-searches-file-text-in-process.md)).
- **Tool surface:** no new tools; the descriptions say to start with the folder view.
- **Command line:** none. An agent with a shell has `ls`, `grep` and `git ls-files`.
- Reading part of a file is built; the fingerprint stays that of the whole file, and a ranged answer says it is partial.

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

- [x] Measure real repositories: files per folder, sizes, how many are generated or vendored
- [ ] Try a few real tasks by hand against the current tools and note where the assistant gets lost
- [ ] Settle the questions above and write the design
- [ ] ADR for the listing, search and ranged read
- [x] Build it, with tests for the limits, the paging and the folder rules (first set)
- [ ] Re-run the Immich C4 task and compare tokens and misses with the numbers in 0177

## Notes
Raised after the C4 run on the Immich repository. The first change that opened reads to every file type added only a `subfolder` argument to `list_files`; the rest was postponed to this epic.
