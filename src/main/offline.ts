import { app, type Session } from 'electron'
import { isRequestAllowed } from './offlinePolicy'

// The app is offline by design; this makes it a guarantee rather than a habit
// (ADR 0113). Two parts:
//
// 1. Chromium's proxy auto-detection resolves the host "wpad" on startup even
//    when the app makes no request at all (seen in a --log-net-log capture).
//    There is no proxy to find, so switch it off. Must run before app ready.
export function disableProxyDiscovery(): void {
  app.commandLine.appendSwitch('no-proxy-server')
}

// 2. Cancel every request from the app's windows that is not local. A future
//    dependency or code path that tries to phone home fails visibly instead of
//    working silently. Links the user clicks go to their browser through
//    shell.openExternal, which never passes through here.
export function enforceOffline(session: Session, devServerUrl: string | undefined): void {
  session.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isRequestAllowed(details.url, devServerUrl)
    if (!allowed) console.warn(`[offline] blocked request: ${details.method} ${details.url}`)
    callback({ cancel: !allowed })
  })
}
