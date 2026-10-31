# 0158: A name for the Markdown files behind an element

## Status
Not Started. Pinned on 2026-11-01 with **Factsheet** as the front-runner; the maintainer is sleeping on it. Nothing is renamed before the decision (task 1). Search already says `has:notes` (`has:details` is an alias); that follows whatever is chosen.

## Goal
One word for the free-form Markdown file an element opens, used the same way in the app, the docs, the AI material and the website. Today it is "details" in the file format, the folder and the menu, and "notes" in the README and the getting-started guide.

## Where the word shows up today
- **File format:** the node field `details` and the sibling `details/` folder (also in every example and in the format spec).
- **Code:** the `details` feature folder in `main`, `renderer/src` and `shared`, and about 75 files that mention it.
- **UI:** "See details", the details panel, the peek card ([ADR 0093](../../decisions/0093-details-peek-card-on-modifier-hold.md)), "Details file" in Diagnostics.
- **Docs and AI material:** the README and the getting-started guide say "notes panel"; the Claude Desktop extension's instructions, `AGENTS.md` and the skill say "details".

## Why it is hard
Tags, links, images and the Markdown file are all context, documentation and details, so a name taken from the content collides with the rest. What sets the file apart is its form: free-form prose, written by a person, attached to one element. Tags are structured, links drill down, the label is a few words.

## Candidates
Tests: distinct from tags and links, weight enough not to sound humble, works as "Add …" and as a `has:` facet.
- **Factsheet (front-runner).** A concise, skimmable page about one subject; open questions and risks still count as essential information. Reads well next to the tags (the standardised facts) as the custom part, and fits the peek card. Weaknesses: "facts" leans settled and structured, and the peek card (label, tags and prose) is arguably the whole factsheet. Enterprise-architecture tools use the word for the page behind each element.
- **Notes.** No collision with tags, but humble, and the maintainer reads a note as smaller than these files. Also close to the yellow text element.
- **Documentation.** Dropped: everything in a diagram is documentation, the same test "details" failed.
- **Description, Page, Readme, Dossier, Profile, Overview.** Too short, too structured, or the wrong audience.
- **Brief.** Complements the tags, but "Add brief" parses as an adjective and a brief feels one-off.
- **Record.** Reads as a fixed log.
- **"Additional info".** Same collision as "details" (tags are info too); fine as a hint under the name, not as the name.
- **"Add markdown".** Names the format, not the purpose.

## Constraints
- The `details` field can be renamed with a read alias (the reader accepts both keys, the writer uses the new one), and a stored note path stays valid wherever the file lives, so only new notes need a new folder. A build from before the change drops the link in a file saved after it, so the version bump is MAJOR; with no installer out yet, now is the cheap moment. The `details` feature folders in the code stay.
- The `details` feature folder is the same name in three trees by rule; renaming it is a large diff with no user-visible effect, so it can wait or never happen.
- Older ADRs keep the vocabulary of their time.

## Tasks
- [ ] Think-through: confirm the word, decide how far the rename goes (UI and docs only, or folder and code too), and check the collision with the `text` node and any future sticky notes
- [ ] Settle the wording of the verb and panel ("Open notes", "Notes panel", "add a note"), the peek card and the Diagnostics label
- [ ] ADR for the decision, including that the `details` key and folder are kept (or not)
- [ ] Change the UI strings, the docs, the extension instructions, the AI material and the example text to match
- [ ] Document in `docs/file-format.md` that `details` holds the path to the element's note
- [ ] Use the word on the website

## Notes
Raised while planning the website, before the first installers: the cheapest moment to settle vocabulary.
