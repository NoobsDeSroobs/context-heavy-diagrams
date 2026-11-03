# 0158: A name for the Markdown files behind an element

## Status
Not Started. Pinned on 2026-11-01 with Factsheet as the front-runner; on 2026-11-03 the maintainer moved back to **Notes**, on how the files are used (see Candidates). Nothing is renamed before the decision (task 1). Search already says `has:notes` (`has:details` is an alias).

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
- **Notes (front-runner).** It matches how the files are used: a person jots down facts and thoughts as they go, comes back to tidy them, adds more, and may end with a link to the long documentation or a comparison. They are not the complete documentation of anything; they are the landing page for an element and the jumping-off point that holds or leads to everything relevant, wherever it lives. That is also how an assistant's notes read (what was read, what was not, what conflicts). It makes the search facet short (`has:notes`) and the verbs natural ("add a note"). The concerns, with answers: the canvas element the code calls Text is called a **textbox** in the UI and docs and is never called a note; "humble" matters little because the README and website describe usage and are free to differ from the code's vocabulary (for example "tags and links give the structure, notes hold everything else").
- **Factsheet (runner-up).** A concise, skimmable page about one subject; open questions and risks still count as essential information. Reads well next to the tags (the standardised facts) as the custom part, and fits the peek card. Weaknesses: "facts" leans settled and structured, and it describes a finished page, not one that grows as people work. Enterprise-architecture tools use the word for the page behind each element.
- **Documentation.** Dropped: everything in a diagram is documentation, the same test "details" failed.
- **Description, Page, Readme, Dossier, Profile, Overview.** Too short, too structured, or the wrong audience.
- **Brief.** Complements the tags, but "Add brief" parses as an adjective and a brief feels one-off.
- **Record.** Reads as a fixed log.
- **"Additional info".** Same collision as "details" (tags are info too); fine as a hint under the name, not as the name.
- **"Add markdown".** Names the format, not the purpose.

## Constraints
- The `details` field can be renamed with a read alias (the reader accepts both keys, the writer uses the new one), and a stored note path stays valid wherever the file lives, so only new notes need a new folder. A build from before the change drops the link in a file saved after it, which is an incompatible change: below 1.0.0 that is a MINOR bump with a "File format" entry in the changelog. The cheaper option, recommended, is to rename the word in the app, docs and AI material and keep the stored `details` key and folder, so there is no format change at all; the format spec then says the `details` field holds the path to the element's note, and the key can be revisited at 1.0.0. The `details` feature folders in the code stay.
- The `details` feature folder is the same name in three trees by rule; renaming it is a large diff with no user-visible effect, so it can wait or never happen.
- Older ADRs keep the vocabulary of their time.

## Tasks
- [ ] Think-through: confirm Notes, decide how far the rename goes (UI, docs and AI material only, or the stored key, folder and code too), and settle "textbox" as the name of the canvas Text element in the UI and docs
- [ ] Settle the wording of the verb and panel ("Open notes", "Notes panel", "add a note"), the peek card and the Diagnostics label
- [ ] ADR for the decision, including that the `details` key and folder are kept (or not)
- [ ] Change the UI strings, the docs, the extension instructions, the AI material and the example text to match
- [ ] Document in `docs/file-format.md` that `details` holds the path to the element's note
- [ ] Use the word on the website

## Notes
Raised while planning the website, before the first installers: the cheapest moment to settle vocabulary.
