# 0158: A name for the Markdown files behind an element

## Status
Not Started. A think-through comes first; nothing is renamed before the decision (task 1).

## Goal
One word for the free-form Markdown file an element opens, used the same way in the app, the docs, the AI material and the website. Today it is "details" in the file format, the folder and the menu, and "notes" in the README and the getting-started guide.

## Where the word shows up today
- **File format:** the node field `details` and the sibling `details/` folder (also in every example and in the format spec).
- **Code:** the `details` feature folder in `main`, `renderer/src` and `shared`, and about 75 files that mention it.
- **UI:** "See details", the details panel, the peek card ([ADR 0093](../../decisions/0093-details-peek-card-on-modifier-hold.md)), "Details file" in Diagnostics.
- **Docs and AI material:** the README and the getting-started guide say "notes panel"; the Claude Desktop extension's instructions, `AGENTS.md` and the skill say "details".

## Why it is hard
Tags, links, images and the Markdown file are all context, documentation and details, so a name taken from the content collides with the rest. What sets the file apart is its form: free-form prose, written by a person, attached to one element. Tags are structured, links drill down, the label is a few words.

## Leaning toward: "notes"
- Tags are not notes, so nothing else collides; "details" fails that test.
- Loose enough for a one-liner or a full write-up; "documentation" promises more, and "document" already means the `.chd` in the code.
- *Context* stays the umbrella word the product name already uses; tags, links and notes are its parts.
- Weakness: it sounds humble. If the files are meant as the authoritative record, it undersells them. "Page" is the alternative that keeps some weight but implies structure the files do not have.

## Constraints
- Renaming the `details` field is an incompatible file-format change, which is a MAJOR version; the folder name is in every existing diagram. The lean is to keep both as they are and document `details` as holding the path to the element's note ([file-format.md](../../file-format.md)).
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
