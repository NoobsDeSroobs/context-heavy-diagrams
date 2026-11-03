# 0140: The Markdown files behind an element are called notes

## Status
Accepted.

## Context
The free-form Markdown file an element opens was called "details" in the file format, the folder and the menus, and "notes" in the README and the getting-started guide. Tags, links, images and the file are all context, so a name taken from the content ("documentation", "details", "info") collides with the rest. What sets the file apart is its form: free-form prose, written by a person, attached to one element.

## Decision
- **The word is "notes"**, in the app, the docs, the AI material and the website: "Open note", the notes panel, "add a note", the search facet `has:notes`. A note is a person's own record: what is known, what is open, and where the long documentation lives. It is the landing page for an element, not the complete documentation of anything.
- **The free-text canvas element is a "textbox"** in the UI and docs and is never called a note. The code keeps calling it `text`.
- **The stored `details` key and the `details/` folder stay.** The file-format spec says `data.details` holds the path to the element's note. Renaming the key would break any build that predates it on a file saved after it, so it can be revisited at 1.0.0 if ever. The `details` feature folders in the code stay for the same reason: a large diff with no effect for the person using the tool.
- **`has:details` stays as an alias** of `has:notes` ([ADR 0096](0096-search-facets-and-shared-match-predicate.md)).

## Alternatives considered
- **Factsheet.** Reads well beside the tags as the custom part, but "facts" leans settled and structured, and the word describes a finished page, not one that grows as people work.
- **Documentation, Description, Page, Readme, Overview.** Everything in a diagram is documentation, which is the test "details" failed; the others are too short, too structured or aimed at the wrong audience.
- **Brief, Record, Dossier, Profile.** "Add brief" parses as an adjective, a record reads as a fixed log, the rest are too heavy or too structured.
- **Additional info.** The same collision as "details", since tags are info too.
- **Rename the key and folder as well.** A file-format change for a word people see only in menus.

## Consequences
- No change to the file format; older diagrams and assistants that write `details` keep working.
- The code and the format use a different word from the interface (`details` against "notes"). A reader of the code has to know the mapping, which is why the format spec states it.
- "Humble" is the word's weakness; the README and the website describe usage and are free to say more than the interface does.
