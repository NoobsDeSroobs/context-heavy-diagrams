# 0109: A way for technical users to see console / process output

## Status

Not Started — parked. Logged 2026-09-04 from a user aside: "since this is a
tool that is also meant for technical people, adding a way to open a
terminal to see the output, or launch through a terminal to see the output
that way, is a nice to have."

## Goal

Give a technically-inclined user a way to see the app's diagnostic output —
main-process logs, renderer `console` errors, uncaught IPC-handler
rejections (the missing-icon ENOENT that prompted [epic 0108](../../completed-epics.md#0108-diagnostics--list-missing-referenced-files)
is a good example) — without attaching a debugger.

## Possible directions (not chosen)

- **"Open DevTools" menu item** — trivial (`webContents.openDevTools()`),
  shows the renderer console immediately. Doesn't show main-process stdout.
- **Launch-from-terminal support** — document / smooth the path for
  starting the packaged app from a shell so stdout/stderr are visible.
  Depends on the packaging story ([epic 0053](../../completed-epics.md#0053-installable-distribution-for-non-technical-users)):
  a GUI app launched from Explorer/dock has no attached console on Windows.
- **An in-app log pane** — capture `console.*` + main logs into a
  scrollable panel (a "Console" tab near Diagnostics). Most work; also the
  most self-contained (no OS terminal needed).
- **A `--verbose` / `CHD_DEBUG` flag** that turns on structured logging to
  a file under `userData/`, plus a "Reveal log file" menu item.

## Notes

Related: epic 0108 added the Diagnostics "missing files" section, which
surfaces *one* class of the errors this would otherwise only show in a
console. This epic is the general-purpose version.
