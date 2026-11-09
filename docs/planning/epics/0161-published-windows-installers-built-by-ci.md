# 0161: Published Windows installers, built by CI on a version tag

## Status
In Progress. v0.4.0 was tagged and the workflow built and published its release. The installer passed a clean-machine test on 2026-11-03; the open tasks below are follow-ups. **Decided (2026-11-09): publish Linux and macOS builds labelled untested on real hardware** (in the release notes and the file names or descriptions), rather than holding them back.

## Goal
Anyone can download a Windows installer for each released version from the repository's releases page, without Node, git or a build. The installer is built by a GitHub Actions workflow when the maintainer pushes a version tag, so the file on the page is the one built from that tagged commit.

## Where it stands
- `npm run build:win` produces `dist/context-heavy-diagrams-<version>-setup.exe`, a per-user NSIS wizard. It is live-tested on Windows ([packaging](../../architecture/packaging.md)). It is unsigned, so SmartScreen shows "Windows protected your PC".
- `.github/workflows/ci.yml` runs lint, build and tests on Linux and Windows for every push and pull request. Nothing publishes anything and no secrets are used.
- The tags `v0.2.1`, `v0.3.0` and `v0.4.0` exist. `v0.4.0` is the first with a published installer; the earlier two have none.
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
- [x] Decide the scope of the first release: Windows only
- [x] ADR: GitHub Releases built by CI as the distribution channel, unsigned at first, no auto-update ([ADR 0139](../../decisions/0139-releases-built-by-ci-from-a-version-tag.md))
- [x] `release.yml`: tag trigger, version and branch guard, tests, build, checksums, release with notes from the changelog
- [x] `workflow_dispatch` for an existing tag. It cannot publish `v0.3.0` unchanged: that tag lacks the changelog script the workflow runs, and it has no release notes to take
- [x] Pin the actions in the release workflow by commit hash
- [x] First tag: watch the first run of the workflow (`v0.4.0` built and published a release)
- [ ] Silent-install smoke test on the runner (`/S`), then run the app's `chd --version`
- [ ] Build the Linux (AppImage, deb) and macOS (DMG) installers in the release workflow and publish them marked "not tested on real hardware": say so in the release notes, in the README download section and on each asset (name or label), and ask people to report what they find
- [ ] Choose the macOS architecture (arm64, x64 or universal) and say what an unsigned, un-notarised DMG makes the person do on first run
- [x] Research signing options (2026-11-09): SignPath Foundation is free for OSS (OSI licence, public repo, GitHub-hosted build, MFA, a "Code signing policy" page, manual approval of each release, verifiable project reputation; publisher shows as SignPath Foundation); Artifact Signing costs about $9.99 a month and needs a US or Canadian individual or a registered organization in a listed country; Certum is about €49 a year. Plan: apply to SignPath once there are downloads to show
- [ ] Apply to SignPath Foundation: write the code signing policy page and privacy statement, turn on MFA, gather the reputation evidence; then sign the installer in `release.yml` (note: at most 3 re-runs of a build per policy evaluation)
- [ ] Record the signing decision in an ADR once the application is answered
- [ ] Check the licence and notices are inside the installer and the release notes point to the tagged source
- [x] README: a Download section above build-from-source; first-run SmartScreen steps and the checksum
- [x] Update `docs/architecture/packaging.md` (the CI path) and the stale line in `CLAUDE.md` that said no installers are made yet
- [x] Put the first installer through a clean-machine test (no Node, no repo) before announcing it (2026-11-03, v0.4.0: install, first run, save and reopen, association, `chd`, uninstall; no problems)
- [ ] Let the person choose the install folder (`allowToChangeInstallationDirectory` is `false` today). Check what assumes the default: the `chd` launcher, `install-options.json`, the uninstaller and the association

## Notes
Raised after 0.3.0 was released. This is the missing piece for [0160](../completed-epics.md#0160-readme-and-documentation-changes-from-outside-feedback), whose audience cannot build from source.
