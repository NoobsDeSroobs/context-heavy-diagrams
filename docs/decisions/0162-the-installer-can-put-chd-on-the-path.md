# 0162: The installer can put `chd` on the PATH

## Status
Accepted (2026-11-09). Replaces the "No PATH registration for now" decision of [ADR 0106](0106-chd-command-line-tool.md) for the Windows installer.

## Context
The `chd` launcher sits next to the app, so a terminal cannot find it by name. [ADR 0106](0106-chd-command-line-tool.md) left the PATH alone because editing it needed installer scripting that could not be verified. The installer now has an options page ([ADR 0108](0108-chd-file-association-and-single-instance.md)) and that scripting, and the PATH edit can be tested.

## Decision
1. **A third checkbox on the installer's options page** adds `chd` to the user's PATH. It is unticked by default: the other two choices change what the app does, this one changes a variable every program the person starts will read.
2. **Per user only.** The entry is added to `HKCU\Environment\Path`, so no elevation is needed. The PATH keeps its type (`REG_EXPAND_SZ`), so `%USERPROFILE%` entries stay variables. Windows is told the environment changed; terminals that were already open must be reopened, and the page says so.
3. **Only `<install folder>\bin` goes on the PATH,** not the install folder: a PATH entry makes every program in the folder startable by name. `bin\chd.cmd` is one line that calls the launcher one folder up. The launcher stays where it is, so the path written into an `AGENTS.md` and the one the app computes for it remain valid.
4. **The uninstaller removes exactly that entry,** compared without regard to case, and writes the PATH back only if it found one; an emptied PATH value is deleted. Like the file association it is skipped on an update.
5. **A PATH the installer cannot read safely is left alone.** NSIS strings are limited (8192 characters here) and a longer value is read as an empty string, which looks the same as no PATH at all and would be overwritten with just our entry. The installer tells the two apart and does nothing to a PATH that exists but cannot be read, or that is near the limit. The person is not told; `chd` is then reachable by its full path as before.
6. **The functions are tested without touching the real PATH.** `scripts/installerPath.test.mjs` compiles the same NSIS code with the NSIS that electron-builder downloads, against a scratch registry key, and runs it on the shapes that matter (missing, trailing separator, variables, case, only entry, too long). It is skipped where NSIS has not been downloaded.

## Alternatives considered
- **Put the install folder on the PATH.** One fewer file, but exposes the app's executable and the uninstaller by name.
- **Move the launcher into `bin`.** Breaks the launcher path already written into assistants' instruction files and found by the app.
- **A PATH-editing NSIS plugin (EnVar).** Not part of the NSIS that electron-builder ships, and a downloaded binary in the installer build for fifty lines of script.
- **`setx`.** Truncates a PATH at 1024 characters and writes it as a plain string, turning every `%VARIABLE%` into fixed text.
- **Ticked by default,** like the other two choices. A person who does not read the page would have the PATH changed.

## Consequences
- Not covered in the first version: Linux (a deb could link `chd` into `/usr/bin`; an AppImage cannot) and macOS. A person on those systems calls the launcher by its full path.
- A silent install (`/S`) leaves the PATH alone; there is no switch to turn the choice on.
- Changing the choice later means running the installer again or editing the PATH by hand; there is no setting in the app.
- The entry is for the install folder chosen at the time. If the installer ever lets the person choose the folder, an update must move the entry with it.
