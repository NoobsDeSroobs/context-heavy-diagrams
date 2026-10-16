<!-- chd-ai-managed: written by Context-Heavy Diagram Tool v{{VERSION}} — safe to delete; re-running "Enable AI assistance" in the app refreshes it -->
# Working with the diagrams in this folder

This folder contains `.chd` diagram files (from the Context-Heavy Diagram Tool). A `.chd` file is plain JSON, but it has format rules that are easy to break by hand — coordinate systems, parent/child ordering, and file paths that are relative to each diagram file.

**Before reading, creating or editing any `.chd` file, read `.claude/skills/chd-diagrams/SKILL.md`** and follow it. It points to the field reference, the authoring guide and the layout guide in the same folder.

Before you write an edited file back, check that it hasn't changed since you read it (read it again, or compare `chd hash <file>`); if it has, re-read it and redo your edit on the fresh content instead of overwriting.

After every edit, validate:

```bash
node .claude/skills/chd-diagrams/scripts/validate_chd.mjs path/to/diagram.chd
```

(If `node` is not installed, skip the script but still check ids, parent ordering and relative paths by hand, as the skill describes.)

{{CLI_NOTE}}

Keep the app's own conventions: don't delete or reformat things you weren't asked to change, and tell the user what you changed.
