# 0112: Electron hardening — sandboxed preload, narrow bridge, navigation guard

## Status
Accepted

## Context
A review ahead of the open-source release ([ADR 0111](0111-open-source-release-approach.md)) found four gaps in how the app's windows are set up. Once the project is public, people will open `.chd` files and Markdown notes written by others, so content in a diagram is no longer fully trusted.

1. **`sandbox: false`.** The window's preload ran unsandboxed. The only thing that needed it was the real OS clipboard ([ADR 0049](0049-clipboard-copy-paste.md)): Electron's `clipboard` module is not available to a sandboxed preload.
2. **A broad preload bridge.** `@electron-toolkit/preload` exposed `window.electron` with generic `ipcRenderer.send/invoke/on` for *any* channel, `webFrame`, and a copy of `process.env`. The renderer used exactly one thing from it: `process.platform`.
3. **No navigation guard.** The details panel renders Markdown with react-markdown, so a link in a note is a plain anchor. Clicking it navigated the app window itself to the remote page — in a window that has `window.api` (file read/write over IPC) exposed through the preload. The About dialog's `target="_blank"` link was handled, but ordinary navigation was not. Dropping a file onto the window had the same shape of risk (the browser default is to navigate to it).
4. **No permission policy.** Electron's default grants some permission requests; the app never needs any.

Content Security Policy (`script-src 'self'`), react-markdown's default of not rendering raw HTML, and custom icons rendered through `<img>` rather than inlined SVG already limit script injection; this decision is defence in depth for the cases those do not cover.

## Decision
- **`sandbox: true`.** The preload may use only `contextBridge`, `ipcRenderer` and `webUtils`. The built bundle's only `require` is `electron`.
- **Clipboard through the main process** (`src/main/clipboard.ts`): `ipcRenderer.send('clipboard:writeText', …)` for copy, and `ipcRenderer.sendSync('clipboard:readText')` for paste. Sync is kept deliberately so the synchronous paste handler does not have to become async; reading the clipboard is instant, and this is a narrow targeted change rather than reworking paste.
- **Drop `@electron-toolkit/preload`.** `window.electron` is gone. The renderer gets `window.api.platform` instead, and the dependency is removed.
- **Navigation guard** (`src/main/navigationGuard.ts`, wired in `createWindow`):
  - `will-navigate` is cancelled unless the target is the same page as the current one (ignoring query and hash, since the page is loaded with `?session=` / `?path=`).
  - Cancelled navigations and `window.open` requests are handed to `shell.openExternal` only if the URL is `https:`, `http:` or `mailto:`. `file:`, `smb:`, custom protocols and anything unparseable are dropped.
- **Deny every permission request** on the default session.

## Alternatives considered
- **Keep `sandbox: false`, harden around it.** Rejected: it exists for one small API, and the unsandboxed preload is the larger risk if a renderer is ever compromised.
- **`navigator.clipboard` in the renderer.** Rejected: asynchronous (changes the paste handler) and subject to focus and permission rules.
- **Make paste async over `ipcRenderer.invoke`.** Reasonable, but touches every caller for no practical gain here; can be done later if sync IPC ever shows up as a problem.
- **Open links in-app, or not at all.** Rejected: opening in the user's browser is what people expect, and the app stays offline-by-design for its own traffic.
- **Allow-list by origin only.** Rejected: `file:` URLs all share an opaque origin, so protocol + host + pathname is compared instead.

## Consequences
- A diagram or note can no longer steer the app window to another page or open arbitrary local programs through a link.
- If the sandboxed preload fails to load, `window.api` is undefined and the window is unusable — the first thing to check after any preload change. The preload may not import Node modules.
- Copy/paste behaviour is unchanged for the user; it now takes an IPC hop.
- `window.electron` no longer exists; new renderer code must use `window.api` (add a narrow method rather than re-exposing a generic bridge).
- Not covered here: enforcing that the app makes no outbound network requests at all, auditing IPC handlers that take paths found inside `.chd` files, and dependency vulnerabilities. These are separate steps of the pre-release security pass.
