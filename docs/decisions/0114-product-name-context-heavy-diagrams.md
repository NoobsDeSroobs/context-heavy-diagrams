# 0114: Product name — Context Heavy Diagrams

## Status
Accepted

## Context
The project had only placeholder names: "context-heavy-diagram-tool" (the repository and package), "electron-scaffold" before that, and "Context-Heavy Diagram Tool (Preview)" in the installer, window title and extension. Naming had been left open while the project's scope was unclear. With the open-source release ([ADR 0111](0111-open-source-release-approach.md)) it needed a real name, and a name that ends in "Tool (Preview)" did not fit a public project.

## Decision
- **The product is called Context Heavy Diagrams** — no hyphens, no "Tool", no "Preview" (the 0.x version already says "early"). The file extension stays `.chd`, and a file is a "Context Heavy Diagram".
- **Technical identifiers follow the name,** so nothing visible still says "diagram tool":
  - package name, executable (`context-heavy-diagrams`), installer file name and the `chd` launchers;
  - `appId` `com.contextheavydiagrams.app`, also used as the Windows app user model id (it was still the scaffold's `com.electron`);
  - the Windows file-type ProgID `ContextHeavyDiagrams.Diagram`;
  - the Claude Desktop extension's display name and the AI material the app writes.
- **The `package.json` author is the author's own name** and feeds the executable's company and copyright properties (see [ADR 0011](0011-software-license-choice.md)). The Linux package maintainer is `Name <noreply address>`, the form Debian expects.
- **Kept on purpose:** the MIME type `application/vnd.context-heavy-diagram+json` (an identifier, nothing visible, and it already reads as the singular document type), and the GitHub repository name and URLs, which change only when the repository itself is renamed on GitHub.

## Alternatives considered
- **Change only the display strings** and keep the old technical identifiers. Avoids every consequence below, but leaves the old name in the executable, the install folder and the registry for good. Rejected: this is the cheapest moment to do it, with almost no installed base.
- **Write a settings migration** from the old data folder to the new one. Rejected as speculative for the number of existing installs (the author and one tester); copying one folder by hand does the same job.

## Consequences
- **Settings move.** Preferences, recent diagrams, style palettes and crash-recovery snapshots live under the app's data folder, which is named after the package. Existing local installs start with a fresh folder (`%APPDATA%\context-heavy-diagrams` on Windows). To keep old settings, rename or copy the old `context-heavy-diagram-tool` folder.
- **The new installer installs next to the old one.** The uninstall entry is keyed on the `appId`, so an old "Context-Heavy Diagram Tool (Preview)" install stays until it is uninstalled by hand, and both register the `.chd` association (the installer's backup logic keeps whichever was there first restorable).
- Any documentation or script that quotes the old executable or installer name needs the new one; the in-repo ones were updated with this change.
- The historical records in `docs/decisions/` and `docs/planning/` keep the names that were current when they were written.
