# 0149: The extension searches the text of files in process

## Status
Accepted (2026-11-06).

## Context
The Claude Desktop extension reads any file in the folder the user chose ([ADR 0110](0110-claude-desktop-extension.md)), so the folder can hold a whole repository. An assistant can then only find a fact by listing files and reading them whole: in a trial on a large repository, one event name cost a 42 KB read. We cannot assume a shell is available to the assistant, and the extension starts no program of its own except the read-only `git show` ([ADR 0142](0142-the-extension-may-run-git-show-to-read-an-earlier-version.md)).

## Decision
- **`search_files` is a read-only tool that finds lines of text in plain Node,** with no shell and no other program, so it works the same on every system and leaves the extension's promise of what it starts unchanged.
- **It reads exactly what `list_files` lists:** the chosen folder or a subfolder of it, never a symlink, a dot-file or dot-folder, `node_modules`, or a file type `read_file` refuses. It also skips files over 2 MB and files that are not text.
- **The pattern is plain text by default;** a regular expression, ignoring case, a glob over the path (`*.ts` against the file name, `server/**/*.service.ts` against the path), 0 to 5 lines of context and a maximum number of matches are options. `files_only` answers with the files and the number of matching lines in each, to see where something lives before reading.
- **The answer is compact and bounded:** `path:line: text` lines (context lines as `path-line- text`), a line cut around its match at 240 characters so a minified file cannot flood the answer, 50 matches unless asked for more and never more than 300. Files are visited in path order, so the same search gives the same answer. It states when and why it stopped (match cap, 50 000 files, 10 seconds) and what it did not search, so the assistant narrows the search instead of trusting a partial answer.
- **A regular expression cannot hang the extension.** A pattern is limited in length, a line is cut before a regular expression sees it, and each file's scan runs in a script with a time limit (Node's `vm`), which interrupts a pattern that backtracks without end. A file where it is cut off is reported as not searched. The script receives only the text and the pattern; it is a time limit, not a security boundary, and nothing the pattern says is run as code.
- **It is one tool beside `list_files` and `read_file`,** not a mode of either: its arguments and answer are different, and the description is short.

## Alternatives considered
- **Start `grep` or `ripgrep`.** Faster on a huge tree, but it is a second program the extension would start, it is not present on every system (Windows has neither), and it would need its own rules to stay inside the folder.
- **Bundle a search library.** A dependency for what a few dozen lines do within the limits above.
- **Filters on `list_files` only.** Finds a file by name but not a fact inside it, which is what cost the most in the trial.
- **No regular expressions.** Safe, but an assistant looking for "every place an event is emitted" needs a pattern; plain text stays the default.
- **Honour `.gitignore`.** The dot-file rule of ADR 0110 forbids opening it; the skipped folders and the match cap are the bound instead.

## Consequences
- An assistant reads ten lines instead of a file, and a fact in a repository costs a search and a ranged read.
- A search over a very large tree is slower than `grep` and stops at the limits; it says so and can be narrowed.
- One more tool description is read in every conversation, which is a small, constant cost.
- The tool's results go to the AI provider like any other read.
