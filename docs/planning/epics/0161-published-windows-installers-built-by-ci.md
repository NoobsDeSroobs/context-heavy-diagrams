# 0161: Published Windows installers, built by CI on a version tag

## Status
Not Started.

## Goal
Anyone can download a Windows installer for each released version from the repository's releases page, without Node, git or a build. The installer is built by a GitHub Actions workflow when the maintainer pushes a version tag, so the file on the page is the one built from that tagged commit.

## Where it stands
- `npm run build:win` produces `dist/context-heavy-diagrams-<version>-setup.exe`, a per-user NSIS wizard. It is live-tested on Windows ([packaging](../../architecture/packaging.md)). It is unsigned, so SmartScreen shows "Windows protected your PC".
- `.github/workflows/ci.yml` runs lint, build and tests on Linux and Windows for every push and pull request. Nothing publishes anything and no secrets are used.
- The tags `v0.2.1` and `v0.3.0` exist. No installer is published; the README says to build from source.
- The app has no auto-update and makes no network requests ([ADR 0113](../../decisions/0113-enforced-offline-behaviour.md)), so a new version means downloading a new installer. There is no `publish` block in `electron-builder.yml`, on purpose.

## Can CI do it on tag creation?
Yes. A second workflow, `release.yml`, triggered by a pushed tag matching `v*.*.*`:
1. Check out the tag on `windows-latest`, Node 24, `npm ci`.
2. Guard: the tag equals `v` plus the `version` in `package.json`, and the tagged commit is on `master`.
3. `npm run lint`, `npm test`, then `npm run build:win` with `--publish never` so electron-builder never tries to upload anything itself.
4. Write `SHA256SUMS` for the installer.
5. Create a GitHub Release for the tag, attach the installer and `SHA256SUMS`, and take the notes from the matching `CHANGELOG.md` section. Mark it a pre-release while the version is below 1.0.0.

The maintainer still creates and pushes the tag; the workflow only reacts to it. A manual run (`workflow_dispatch`, taking an existing tag) lets `v0.3.0` get its installer without moving the tag.

Permissions: the workflow gets `contents: write` only in the release job, and no other secret until signing exists. Because that job holds a write token, the actions it uses are pinned by commit hash.

## Open questions
- **Signing.** Unsigned means a SmartScreen warning on every download and a higher chance of antivirus false positives for an Electron installer. Options to research: a free open-source signing programme (SignPath Foundation is the one I know of), Microsoft's own signing service, or a purchased certificate. Eligibility, cost and whether a cloud-signing step fits the offline-first principle are not checked. Until then the release notes carry the checksum and the "More info, Run anyway" steps.
- **Linux and macOS.** The same workflow can build the AppImage and deb on `ubuntu-latest` (snap needs snapcraft) and a DMG on `macos-latest`. Neither is verified on real hardware. Publish them only labelled unverified, or hold them back. A Mac build also needs the architecture choice (arm64, x64, universal) and, for a clean first run, notarisation, which costs an Apple developer account.
- **Source for the GPL.** Check [licensing](../../licensing.md) for what a binary release must point to, and that the installer carries the licence and the third-party notices.
- **Attestation.** GitHub can attach a build-provenance attestation to the installer. Cheap to add; decide whether it is worth the extra concept for a first release.

## Tasks
- [ ] Decide the scope of the first release (Windows only, or also the Linux and Mac builds as unverified)
- [ ] ADR: GitHub Releases built by CI as the distribution channel, unsigned at first, no auto-update
- [ ] `release.yml`: tag trigger, version and branch guard, tests, build, checksums, release with notes from the changelog
- [ ] `workflow_dispatch` for an existing tag; use it to publish `v0.3.0`
- [ ] Pin the actions in the release workflow by commit hash
- [ ] Silent-install smoke test on the runner (`/S`), then run the app's `chd --version`
- [ ] Research signing options and record the outcome in the ADR
- [ ] Check the licence and notices are inside the installer and the release notes point to the tagged source
- [ ] README: a Download section above build-from-source; first-run SmartScreen steps and the checksum
- [ ] Update `docs/architecture/packaging.md` (Phase 1 now ships; add the CI path) and the stale line in `CLAUDE.md` that says no installers are made yet
- [ ] Fix the packaging doc's Mac paragraph: the camera and microphone entries it warns about are no longer in `electron-builder.yml`
- [ ] Put the first installer through a clean-machine test (no Node, no repo) before announcing it

## Notes
Raised after 0.3.0 was released. This is the missing piece for [0160](0160-readme-and-docs-from-outside-feedback.md), whose audience cannot build from source.
