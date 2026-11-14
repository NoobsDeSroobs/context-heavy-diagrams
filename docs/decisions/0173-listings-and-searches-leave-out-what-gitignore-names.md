# 0173: Listings and searches leave out what .gitignore names

## Status
Accepted (2026-11-14)
Amends: the dot-file rule of [0110](0110-claude-desktop-extension.md) with one exception; the page size of `list_files` and its entries.
Superseded by: none

## Context
When the folder is a repository, most of what `list_files` and `search_files` meet is build output and dependencies: in five repositories measured, 5,359 of 6,198 files, 968 of 1,120 and 78,599 of 104,178 were in folders git already ignores. A page of 300 files (about 10k tokens) filled with them and ended before the source, and a very large tree hit the walk's file cap. Every one of those folders is named in the repository's `.gitignore`. A fixed list of folder names guesses wrong (`bin` can hold scripts) and misses the rest.

## Decision
- **The server reads `.gitignore` files** (the folder's own and those in the folders below it, each applying from where it sits, nearest first, with `!` rules) to decide what `list_files` and `search_files` leave out. Matching is done by the `ignore` package, case-insensitively on every system so the answers do not differ between them.
- **This is the one dot-file the server opens, and only for that.** Its text is never returned, never searched, never listed; `read_file` and every write still refuse it like any dot-file ([0110](0110-claude-desktop-extension.md)). A `.gitignore` that is a symlink, over 256 KB or unreadable is treated as absent.
- **Only discovery narrows.** `read_file` by path is unchanged. A `subfolder` that a `.gitignore` names is listed and searched when the assistant asks for it by name.
- **The answer says what was left out:** an `ignored` line naming the folders (at most 12, then a count) and how many single files, and that giving one as `subfolder` looks inside. Ignored folders are not walked, so a tree full of build output costs nothing.
- **Not a security boundary.** The rule is about relevance. It cannot keep anything from an assistant that has a shell, which can read any file in the repository, and the dot-file rule is likewise a protection for the extension, where there is no shell. Neither the `chd` command line nor an agent with a shell uses these rules.
- **Smaller answers:** a listing entry is the path and size, with `writable: true` only for the types that can be written (no modified time), and a page is 100 files unless `limit` asks for more (at most 300).

## Alternatives considered
- **A fixed list of folder names** (`dist`, `build`, `target`, ...): wrong in both directions, and out of date as ecosystems change.
- **Read `.gitignore` only at the top:** misses the nested files that large repositories use.
- **A hand-written matcher:** the format has enough corners (anchoring, `**`, negation, trailing slashes) that a maintained package is safer.
- **An argument to switch the rule off:** not needed, since naming the folder as `subfolder` lists it.
- **Count tokens or bytes of the answer instead of files:** the server cannot count tokens, and an entry is nearly constant in size.

## Consequences
- A repository lists and searches as its owner sees it, and an assistant starts from the source instead of the build output.
- A person who ignores a folder they do want diagrammed asks for it by name, or it is read by path.
- The extension bundles one more small dependency.
