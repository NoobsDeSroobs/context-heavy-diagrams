<!-- chd-ai-managed: written by Context-Heavy Diagrams v{{VERSION}} — safe to delete; re-running "Set up a folder for AI agents" in the app refreshes it -->
# Working with the diagrams in this folder

This folder contains `.chd` diagram files (from Context-Heavy Diagrams). A `.chd` file is plain JSON, but it has format rules that are easy to break by hand — coordinate systems, parent/child ordering, and file paths that are relative to each diagram file.

**Before reading, creating or editing any `.chd` file, read `.claude/skills/chd-diagrams/SKILL.md`** and follow it. It points to the field reference, the authoring guide and the layout guide in the same folder.

Build and change diagrams with `chd edit` (or the `edit_diagram` tool, if you have the Context-Heavy Diagrams tools) instead of writing the JSON: you send a list of operations and it answers with what each made and what is wrong with the layout so far. `chd edit --help` explains it; `chd ask inspect <file>` lists the elements as they stand.

Before you write an edited file back, check that it hasn't changed since you read it (read it again, or compare `chd hash <file>`); if it has, re-read it and redo your edit on the fresh content instead of overwriting.

After every edit, validate:

```bash
node .claude/skills/chd-diagrams/scripts/validate_chd.mjs path/to/diagram.chd
```

(If `node` is not installed, skip the script but still check ids, parent ordering and relative paths by hand, as the skill describes.)

{{CLI_NOTE}}

If you tag elements with the file they came from, write the path relative to this folder (forward slashes, never absolute); if you use another base, record it once in the diagram's top-level `metadata` (for example `sourceBase`).

Keep the app's own conventions: don't delete or reformat things you weren't asked to change, and tell the user what you changed.
