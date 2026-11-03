# 0140: The Markdown files behind an element are called notes

## Status
Accepted.

## Context
The free-form Markdown file an element opens was called "details" in the file format, the folder and the menus, and "notes" in the README and the getting-started guide. Tags, links, images and the file are all context, so a name taken from the content ("documentation", "details", "info") collides with the rest. What sets the file apart is its form: free-form prose, written by a person, attached to one element.

## Decision
- **The word is "notes"**, everywhere: the app, the docs, the AI material, the website and the file itself. "Open note", the notes panel, "add a note", the search facet `has:notes`. A note is a person's own record: what is known, what is open, and where the long documentation lives. It is the landing page for an element, not the complete documentation of anything.
- **The stored key becomes `data.notes`.** The reader accepts `data.details` as an alias and the writer always writes `notes`, so older files open unchanged and are upgraded on their next save. The alias stays for now; dropping it is a separate decision. `has:details` stays as an alias of `has:notes` ([ADR 0096](0096-search-facets-and-shared-match-predicate.md)).
- **New notes are stored in a `notes/` folder** next to the diagram, where they were in `details/`. A stored path is authoritative wherever the file lives, so notes already in a `details/` folder keep working and are not moved.
- **The code follows:** the `details` feature folders in `main`, `renderer/src` and `shared` become `notes`, since the three trees use the same folder name for a feature.
- **The free-text canvas element is a "textbox"** in the UI and docs and is never called a note. The code keeps calling it `text`.

## Alternatives considered
- **Factsheet.** Reads well beside the tags as the custom part, but "facts" leans settled and structured, and the word describes a finished page, not one that grows as people work.
- **Documentation, Description, Page, Readme, Overview.** Everything in a diagram is documentation, which is the test "details" failed; the others are too short, too structured or aimed at the wrong audience.
- **Brief, Record, Dossier, Profile.** "Add brief" parses as an adjective, a record reads as a fixed log, the rest are too heavy or too structured.
- **Additional info.** The same collision as "details", since tags are info too.
- **Rename the words in the interface and keep the stored key and folder.** No format change, but the file, the code and the people using them would use two words for one thing for good. Rejected.

## Consequences
- **An incompatible file-format change, in one direction:** a build from before it ignores `notes`, and drops the link when it saves a file that carries it. Below 1.0.0 that is a MINOR version with a "File format" entry in the changelog.
- Assistants, the CLI and the Claude Desktop extension write `notes`. Files they wrote with `details` still open.
- "Humble" is the word's weakness; the README and the website describe usage and are free to say more than the interface does.
