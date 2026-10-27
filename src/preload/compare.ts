import { contextBridge, ipcRenderer } from 'electron'
import type { CompareSession } from '@shared/compare/session'
import type {
  RevertChange,
  RevertIdMatches,
  RevertKind,
  RevertResult
} from '@shared/compare/revert'
import type { AppPreferences } from '@shared/preferences/preferences'

// The bridge of the compare window, and only of the compare window (src/main/compare/). That
// window draws two versions of a diagram and asks for a revert; it never saves, exports, picks a
// file, writes a preference or opens a diagram, so it is not given the means to. The editor's bridge
// (index.ts) has dozens of methods that can write to disk; a page that drew a hostile diagram
// wrongly would find none of them here (ADR 0112).
//
// Each method has the name and the channel it has in index.ts. A test
// (compare.test.mjs) keeps this list equal to what the compare window's code can reach and the
// channels equal to the editor's, so a new need in that window is a deliberate change here.
const api = {
  // The two versions this window shows, held by the main process under the id in its URL.
  getCompareSession(id: string): Promise<CompareSession | null> {
    return ipcRenderer.invoke('compare:getSession', id)
  },

  // Put one element back as the earlier version has it: done in the editor window of the same
  // diagram, never here.
  revertFromCompare(
    sessionId: string,
    kind: RevertKind,
    id: string,
    change: RevertChange,
    matches?: RevertIdMatches
  ): Promise<RevertResult> {
    return ipcRenderer.invoke('compare:revert', sessionId, kind, id, change, matches)
  },

  // Preferences are read (dimming, zoom limits, palettes) and followed live, never written.
  readPreferences(): Promise<AppPreferences | null> {
    return ipcRenderer.invoke('preferences:read')
  },

  onPreferencesChanged(callback: (preferences: AppPreferences) => void): () => void {
    const listener = (_event: unknown, preferences: AppPreferences): void => callback(preferences)
    ipcRenderer.on('preferences:changed', listener)
    return () => ipcRenderer.off('preferences:changed', listener)
  },

  // A custom icon of an element, read beside its diagram.
  readIconAsDataUrl(diagramPath: string, relativePath: string): Promise<string> {
    return ipcRenderer.invoke('icons:readAsDataUrl', diagramPath, relativePath)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
