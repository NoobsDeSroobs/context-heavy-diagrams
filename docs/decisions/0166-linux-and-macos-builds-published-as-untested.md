# 0166: Linux and macOS builds are published, labelled as untested

## Status
Accepted (2026-11-09). Builds on [ADR 0139](0139-releases-built-by-ci-from-a-version-tag.md) and [ADR 0165](0165-the-release-installs-its-own-installer-and-ships-the-licence.md).

## Context
The release workflow published a Windows installer only; Linux and macOS users had to build from source. Nobody on the project has a Mac, and Linux has not been tried on real hardware either. Holding the builds back until someone has tested them means nobody on those systems can try the tool, and so nobody can report that it works or does not.

## Decision
1. **Publish them, and say what they are.** The release workflow builds a Linux AppImage and deb and a macOS DMG and attaches them to the release. Each asset's display label, the release notes and the README say they have not been tested on real hardware, and ask for reports.
2. **They never block the Windows release.** The Linux and macOS jobs start after the Windows job has published and only add files, so a failure in an untested build cannot stop the tested one; a failed job is re-run from the Actions tab.
3. **CI checks what it can without a display.** `scripts/smoke-packaged.mjs` checks that the licence files are there and that `chd --version` prints the package version, which starts the program as Node. On macOS it also checks that the app holds both architectures and that its signature is valid.
4. **Linux: AppImage and deb.** Snap needs snapcraft in the build; it stays in `electron-builder.yml` for a local build and is left out of CI.
5. **macOS: one universal DMG.** A single file for Apple Silicon and Intel spares a person choosing between two; the price is roughly twice the size of one architecture. The app has no native modules, so the two halves merge without per-file rules.
6. **macOS: ad-hoc signed, not notarised.** An unsigned arm64 build is refused as "damaged" instead of the usual "unidentified developer" prompt, so the app is signed with the ad-hoc identity (`identity: '-'`). The hardened runtime is off, because with an ad-hoc signature it needs the library-validation entitlement and gains nothing without notarisation. Notarisation needs an Apple developer account and is not done; the release notes and the README say how to open the app (right-click, Open; or Privacy & Security, Open Anyway).
7. **Checksums per platform:** `SHA256SUMS-linux` and `SHA256SUMS-macos` next to the Windows `SHA256SUMS`.

## Alternatives considered
- **Hold them back until tested.** Nobody to test them, and no way to find out without people trying them.
- **Two macOS DMGs (arm64 and x64).** A question for the person downloading, for a fading minority of Intel Macs.
- **arm64 only.** Leaves Intel Macs out for the saving of one architecture's weight.
- **A single job that publishes everything.** An untested macOS build could stop the Windows installer from being published.

## Consequences
- Nobody has run the Linux or macOS builds. Likely first-run problems are not handled: a recent Ubuntu may need `libfuse2` for the AppImage or refuse Electron's sandbox, and an Intel Mac is covered only by the universal build's other half.
- With a Developer ID certificate and notarisation, remove `identity` and turn the hardened runtime back on in `electron-builder.yml`; the "not tested" label stays until someone has run the build.
- The `chd` command is not on the PATH of a Linux or macOS install ([ADR 0162](0162-the-installer-can-put-chd-on-the-path.md)); macOS has no launcher next to the app at all.
