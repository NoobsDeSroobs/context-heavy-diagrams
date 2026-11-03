# 0139: Releases are built by CI from a version tag and published unsigned

## Status
Accepted (2026-11-03).

## Context
The Windows installer ([packaging](../architecture/packaging.md)) was only built by hand, so a person without Node, git and a build could not get the app. The app has no auto-update and makes no network requests ([ADR 0113](0113-enforced-offline-behaviour.md)), so each version has to be downloaded by hand and its provenance has to be checkable. There is no code-signing certificate yet.

## Decision
- **A GitHub Actions workflow builds and publishes the installer when a tag `vMAJOR.MINOR.PATCH` is pushed.** The maintainer still creates and pushes the tag; the workflow only reacts. A manual run for an existing tag is allowed.
- **It refuses to publish** unless the tag equals `v` plus the `package.json` version and the tagged commit is on `master`, and it runs lint and the tests first.
- **What is published:** the installer built from the tagged commit, a `SHA256SUMS` file, and release notes taken from the matching `CHANGELOG.md` section. A version below 1.0.0 is marked a pre-release.
- **electron-builder never publishes** (`--publish never`) and the app keeps no `publish` configuration: the upload is a `gh` command in the workflow, so no update feed exists and no network code enters the app.
- **Least privilege:** the workflow has read access by default and a write token only in the release job, which uses two actions pinned by commit hash and no other third-party code.
- **Unsigned for now.** The release notes and the README tell the reader to choose "More info", then "Run anyway", when Windows warns, and to check the checksum.
- **Windows only.** The Linux and macOS builds are configured but unverified on real hardware, so they are not published.

## Not decided here
Code signing (the options are a free open-source signing programme, a Microsoft service or a purchased certificate), publishing the Linux and macOS builds, a build-provenance attestation, and a smoke test that installs the build on the runner.

## Alternatives considered
- **Upload a locally built installer by hand.** Not reproducible, and nothing links the file to the tagged commit.
- **electron-builder's own publisher.** It brings an update-feed concept and token handling into the build for a feature the app does not have.
- **A third-party release action.** One more piece of code holding a write token for what one command does.

## Consequences
- A release is a tag and nothing else; the notes come from the changelog, so the changelog entry must exist before the tag (a version without one gets a one-line note).
- The workflow cannot be tested before the first tag, so the first release is also its first run.
- Every download triggers a SmartScreen warning until signing exists.
