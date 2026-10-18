# 0113: Enforced offline behaviour

## Status
Accepted

## Context
"Local, offline, no account" is a founding principle and a headline claim of the project. Until now it was true only because nobody had written a network call, confirmed by a grep. For an open-source project that accepts outside contributions and updates its dependencies, that is not enough: one added analytics call, a dependency that phones home, or an auto-updater would break the promise silently.

A capture of the real app with Chromium's `--log-net-log` (20 seconds idle, current build) showed the one place the promise was already untrue: **8 events resolving the host `wpad:80`**. That is Chromium's proxy auto-discovery, which runs at startup whether or not the app makes any request. No URL requests were made. A second capture with a text box focused and misspelled text typed showed no spellcheck dictionary download on Windows.

## Decision
- **Disable proxy auto-discovery** with the `no-proxy-server` switch, set before the app is ready (`src/main/offline.ts`). Re-capture after the change: 141 events down to 12, and no hosts resolved.
- **Cancel every non-local request from the app's windows** with a `webRequest.onBeforeRequest` handler on the default session. Allowed: `file:`, `data:`, `blob:`, `devtools:`, `about:`, and — only when running `npm run dev` — the Vite dev server's own host (pages and hot-reload socket). Everything else is cancelled and logged to the main-process console (`[offline] blocked request: …`). The rule is a pure function (`src/main/offlinePolicy.ts`) with unit tests; a probe Electron session confirmed `https`, `http://127.0.0.1` and image loads are blocked while `data:` still works.
- **A source tripwire test** (`src/offline.test.mjs`) fails if `src/`, `extension/` or `resources/cli/` contain `fetch(`, `net.request`/`net.fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, an auto-updater, `crashReporter` or a Node networking module. The runtime policy cannot see the main process, the `chd` command-line tool or the Claude Desktop extension; this covers them. A deliberate future network feature has to change this test, which forces the conversation (and a privacy review) first.
- **User-initiated links are unaffected.** Clicking a link hands it to the user's own browser via `shell.openExternal` ([ADR 0112](0112-electron-hardening-sandbox-and-navigation.md)); that never passes through the request policy.

## Alternatives considered
- **Only the grep, as before.** Rejected: nothing enforces it and nothing detects Chromium's own background traffic (the `wpad` lookup was invisible to a grep).
- **A `connect-src 'none'` CSP.** Not added: it only covers script-initiated connections from the page, and the request policy already blocks those plus images, fonts and everything else.
- **Disable spellcheck entirely.** Not done: no dictionary download was observed on Windows, and removing spellcheck is a visible feature loss. Linux is unverified (see below).
- **Broader Chromium switches** (`disable-background-networking`, `disable-component-update`, …). Not added: the capture shows nothing for them to prevent. Add one only when a capture shows traffic it would stop.

## Consequences
- The app's offline claim is now backed by a measurement, an enforced policy and a test.
- Any future need for the network (an update check, a hosted gallery) must be an explicit decision that changes the policy and the tripwire, and must be called out in the README.
- The AI integrations stay local: the `chd` CLI and the Claude Desktop extension make no requests themselves. What an AI assistant does with files it is given is outside this app's control and is covered by the warning in the installer.
- **Not verified:** Linux and macOS. In particular, on Linux Chromium may download Hunspell spellcheck dictionaries on first use. To check, run the app with `--log-net-log=<file> --net-log-capture-mode=Everything`, type in a note, quit, and look for URLs or hosts in the file (hosts show up as `"host"` entries, requests as `"url"` entries). If a download appears, either bundle dictionaries or turn spellcheck off on that platform.
