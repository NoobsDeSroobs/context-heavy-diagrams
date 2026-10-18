// Pure rule for which requests the app's own windows may make (ADR 0113). Kept
// free of Electron imports so it can be unit-tested with `npm test`.

// Everything the app loads is local: its own bundled page, data:/blob: URLs
// built in the page (PNG export, icon previews), and devtools in development.
const LOCAL_PROTOCOLS = new Set(['file:', 'data:', 'blob:', 'devtools:', 'about:'])

// devServerUrl is the Vite dev server (ELECTRON_RENDERER_URL), only set when
// running `npm run dev`; its pages and hot-reload socket are allowed, nothing
// else on the network is.
export function isRequestAllowed(url: string, devServerUrl?: string): boolean {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return false
  }
  if (LOCAL_PROTOCOLS.has(target.protocol)) return true
  if (!devServerUrl) return false
  try {
    const dev = new URL(devServerUrl)
    const sameHost = target.host === dev.host
    return sameHost && ['http:', 'https:', 'ws:', 'wss:'].includes(target.protocol)
  } catch {
    return false
  }
}
